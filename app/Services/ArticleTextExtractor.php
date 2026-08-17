<?php

namespace App\Services;

use Dom\Element;
use Dom\HTMLDocument;

/**
 * A letöltött weboldal HTML-jéből a cikk-törzs kinyerése.
 *
 * A korábbi megoldás regexszel az ELSŐ `<article>`-t vágta ki, `strip_tags()`-gel
 * szöveggé alakította, és egy 35 karakteres SORSZŰRŐVEL próbálta kidobni a
 * menüket. Ez három ponton hibázott:
 *
 *  1. a hírportálok minden ajánló-kártyát `<article>`-be tesznek, így a
 *     DOM-sorrendben első találat gyakran egy kártya, nem a cikk;
 *  2. a `strip_tags()` nem tesz határolót a blokkelemek helyére, ezért ott a
 *     szavak összeragadnak („HomePoliticsSport") — ez HAMIS tokeneket gyárt a
 *     szóelemzőnek, nem csak zajt;
 *  3. a sorszűrő sorokra dolgozik, a mai HTML viszont minifikált (nincs benne
 *     sortörés), így az egész lap egyetlen sorként átcsúszik rajta.
 *
 * Helyette HTML5-parserrel dolgozunk (PHP 8.4 `Dom\HTMLDocument`, külső csomag
 * nélkül): eldobjuk a biztosan nem cikk-részeket, a törzset pontozással
 * választjuk ki, és blokk-tudatosan alakítjuk szöveggé.
 *
 * BIZTONSÁG. A bemenet távoli, tehát ellenséges is lehet. Ezért:
 *  • Kizárólag `textContent`-et adunk vissza — markup szerkezetileg nem juthat
 *    ki, így a hívási lánc XSS-felülete nem nő.
 *  • HTML5-parser, nem `loadXML`: a HTML5-nek nincs DTD-entitás mechanizmusa,
 *    ezért XXE és „billion laughs" nem alkalmazható (mérve: a `&x;` szövegként
 *    marad, az entitás-bomba 3 karakter).
 *  • Minden lépés LINEÁRIS a dokumentum méretében. A pontozás nem jelöltenként
 *    járja be a részfákat (az kvadratikus lenne), hanem a szöveg-blokkokból
 *    felfelé összegez; a `<body>` hosszát egyszer számoljuk ki. Mérve: a naiv,
 *    kvadratikus változat egy 305 KB-os lapon 2504 ms volt, ez 2 ms.
 *  • Elem-szám és attribútum-hossz sapka, hogy egy szándékosan patologikus lap
 *    (pl. 50 000 szintű beágyazás) ne köthesse le a PHP-munkást.
 */
class ArticleTextExtractor
{
    /**
     * Sosem cikk-tartalom: a teljes részfa törlődik. A `svg`/`iframe` azért van
     * itt, mert az SVG-be írt `<text>` a `textContent`-ben megjelenne.
     *
     * @var list<string>
     */
    private const DROP_SELECTORS = [
        'script', 'style', 'noscript', 'template', 'svg', 'iframe', 'object', 'embed',
        'nav', 'header', 'footer', 'aside', 'form', 'button', 'select', 'textarea',
        '[role=navigation]', '[role=banner]', '[role=contentinfo]', '[role=complementary]',
        '[role=search]', '[aria-hidden=true]', '[hidden]',
    ];

    /**
     * Boilerplate-re utaló class/id minta. Szövegrészletre illeszkedik, ezért
     * CSAK a strukturális elemeken kívül és méret-guard mögött alkalmazható —
     * a Wikipédia `<html>`-jén például ott van a
     * `vector-feature-main-menu-pinned-…` osztály, és a benne lévő `-menu-`
     * miatt a naiv változat a TELJES dokumentumot törölte.
     */
    private const DROP_PATTERN = '/(^|[-_\s])(nav|navbar|menu|sidebar|footer|header|comments?|related|recommend|share|social|cookie|consent|gdpr|banner|promo|subscribe|newsletter|advert|ads?|sponsor|breadcrumb|pagination|tag-?list|author-?box|byline|toolbar|widget|popup|modal|overlay|skip)([-_\s]|$)/i';

    /** Ezeket soha nem töröljük: a szülőjük a dokumentum, tehát mindent elvinnének. */
    private const STRUCTURAL_TAGS = ['HTML', 'HEAD', 'BODY'];

    /**
     * A pontozás itt áll meg felfelé. A `<body>` SZÁNDÉKOSAN nincs benne: ha
     * minden bekezdés a saját `div`-jében áll közvetlenül a body alatt, akkor a
     * body a valódi tartalom-keret, és nyernie kell. (Enélkül a 4000 bekezdéses
     * próbalapból egyetlen bekezdés jött ki: minden `div` külön, egyenlő pontú
     * jelölt lett.) Mély lapokon a body-t a MAX_SCORE_DEPTH sapka tartja távol.
     *
     * @var list<string>
     */
    private const SCORE_ROOT_TAGS = ['HTML', 'HEAD'];

    /** Szöveget hordozó blokkelemek — a pontozás és a szöveggé alakítás alapja. */
    private const BLOCK_SELECTOR = 'p, li, blockquote, h1, h2, h3, h4, h5, h6, dd, dt, pre, td, figcaption';

    /** A pontozáshoz figyelembe vett blokkelemek (a rövid címkéket kizárjuk). */
    private const SCORED_SELECTOR = 'p, li, blockquote, h1, h2, h3';

    /** Ennél rövidebb blokk jellemzően címke vagy gomb-szöveg, nem próza. */
    private const MIN_BLOCK_LENGTH = 25;

    /** Efölötti link-arány menüre/ajánló-listára utal, nem folyó szövegre. */
    private const MAX_LINK_DENSITY = 0.5;

    /**
     * Nyitó-tag sapka a HTML5-parser előtt (DoS-korlát).
     *
     * A libxml HTML-parser költsége a BEÁGYAZÁSI MÉLYSÉGBEN kvadratikus, nem a
     * tag-számban. Mérve, ugyanezen a gépen: egy valódi 2 MB-os Wikipédia-cikk
     * 49 ms, egy 50 000 szint mélyre ágyazott 537 KB-os lap viszont 2478 ms —
     * miközben a régi regex-lánc ugyanazon 4 ms volt. A végpont hitelesített
     * felhasználótól percenként 30 kérést engedhet (`throttle:30,1,ta-fetch`),
     * tehát fék nélkül ez PHP-munkás CPU-t kötne le.
     *
     * A mélység sosem nagyobb a nyitó tagek számánál, ezért azt korlátozzuk —
     * a számolás egyetlen `preg_match_all`, 2 MB-on 1 ms. A mért valódi
     * maximum 16 852 nyitó tag (a letöltési sapkán lévő cikk), így a 25 000-es
     * korlát a valódi lapokat nem érinti, a parse-költséget viszont ~600 ms-ra
     * fogja. A sapka fölött a lap nem elemzés nélkül marad: a `fallbackText()`
     * regex-alapú, lineáris úton adja vissza a szöveget.
     */
    private const MAX_OPENING_TAGS = 25000;

    /** A class/id egyeztetés előtt ennyi karakterre vágjuk az attribútumot. */
    private const MAX_ATTRIBUTE_LENGTH = 512;

    /**
     * Ennyi szinten megyünk felfelé a blokkelemtől, amikor a szülőkre osztjuk a
     * pontot. Efölött már a lap-keret jön, ami minden jelöltre ugyanannyit adna.
     */
    private const MAX_SCORE_DEPTH = 8;

    /**
     * A cikk-törzs sima szövegként, bekezdésenként üres sorral elválasztva.
     * Üres stringet ad, ha a lapon nincs értelmezhető szöveg (pl. JS-ből
     * renderelt váz) — a hívó ilyenkor dönt a hibaüzenetről.
     */
    public function extract(string $html): string
    {
        // A DoS-fék a parser ELŐTT fut: a parse-költség a beágyazási mélységben
        // kvadratikus, tehát a mélységet felülről becslő nyitó-tag számra kell
        // korlátoznunk, még mielőtt a dokumentum felépülne.
        if (preg_match_all('/<[a-zA-Z]/', $html) > self::MAX_OPENING_TAGS) {
            return $this->fallbackText($html);
        }

        $document = HTMLDocument::createFromString($html, LIBXML_NOERROR);

        if ($document->body === null) {
            return '';
        }

        $this->dropBoilerplate($document);

        $body = $document->body;

        if ($body === null) {
            return '';
        }

        return $this->toText($this->pickMainContent($document) ?? $body);
    }

    /**
     * Tartalék út a nyitó-tag sapka fölött: DOM nélkül, lineáris regexekkel.
     *
     * A blokk-záró tagek helyére sortörés kerül, mert a `strip_tags()` önmagában
     * összeragasztja a szomszédos blokkok szövegét („HomePoliticsSport"), és a
     * hamis tokenek rontanák a szóelemzést. Boilerplate-szűrés itt nincs — ezt
     * az út csak a szándékosan patologikus lapokat érinti.
     */
    private function fallbackText(string $html): string
    {
        $html = preg_replace('#<(script|style|noscript|template)\b[^>]*>.*?</\1\s*>#si', ' ', $html) ?? $html;
        $html = preg_replace('#<br\s*/?>|</(p|div|li|h[1-6]|section|article|tr|blockquote|dd|dt|td)\s*>#i', "\n", $html) ?? $html;

        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $lines = array_filter(
            array_map(
                fn (string $line): string => $this->normalizeWhitespace($line),
                explode("\n", $text),
            ),
            fn (string $line): bool => $line !== '',
        );

        return implode("\n\n", $lines);
    }

    /**
     * A biztosan nem cikk-részek eltávolítása: előbb tag/ARIA-role szerint,
     * majd class/id minta szerint.
     */
    private function dropBoilerplate(HTMLDocument $document): void
    {
        foreach (self::DROP_SELECTORS as $selector) {
            foreach (iterator_to_array($document->querySelectorAll($selector)) as $node) {
                $node->parentNode?->removeChild($node);
            }
        }

        // A body hosszát EGYSZER számoljuk ki: node-onkénti újraszámolása a
        // dokumentum méretében kvadratikus lenne (mérve: 2504 ms vs 2 ms).
        $bodyLength = mb_strlen($this->normalizeWhitespace($document->body?->textContent ?? ''));

        foreach (iterator_to_array($document->querySelectorAll('[class],[id]')) as $node) {
            if (! $node instanceof Element || ! $node->isConnected) {
                continue;
            }

            if (in_array($node->nodeName, self::STRUCTURAL_TAGS, true)) {
                continue;
            }

            if (! $this->looksLikeBoilerplate($node)) {
                continue;
            }

            // Ha a jelölt a lap szövegének nagy részét tartalmazza, akkor nem
            // widget, hanem a tartalom kerete — a minta ilyenkor téved.
            if ($bodyLength > 0 && mb_strlen($this->normalizeWhitespace($node->textContent)) / $bodyLength > 0.5) {
                continue;
            }

            $node->parentNode?->removeChild($node);
        }
    }

    private function looksLikeBoilerplate(Element $node): bool
    {
        $haystack = mb_substr(
            $node->getAttribute('class').' '.$node->getAttribute('id'),
            0,
            self::MAX_ATTRIBUTE_LENGTH,
        );

        return preg_match(self::DROP_PATTERN, $haystack) === 1;
    }

    /**
     * A cikk-törzs kiválasztása pontozással: minden érdemi szöveg-blokk a
     * hosszával pontozza a szülőit, és a legtöbb pontot gyűjtő elem nyer.
     *
     * A pontokat a blokkokból FELFELÉ összegezzük, nem jelöltenként lefelé
     * bejárva: utóbbi minden `<div>` részfáját újra végigolvasná, ami a
     * dokumentum méretében kvadratikus. Így a munka a blokkok számával és a
     * mélység-sapkával lineáris.
     */
    private function pickMainContent(HTMLDocument $document): ?Element
    {
        /** @var array<int, array{node: Element, score: float}> $scores */
        $scores = [];

        foreach ($document->querySelectorAll(self::SCORED_SELECTOR) as $block) {
            $text = $this->normalizeWhitespace($block->textContent);
            $length = mb_strlen($text);

            if ($length < self::MIN_BLOCK_LENGTH || $this->linkDensity($block) >= self::MAX_LINK_DENSITY) {
                continue;
            }

            $depth = 0;

            for ($node = $block->parentNode; $node instanceof Element && $depth < self::MAX_SCORE_DEPTH; $node = $node->parentNode) {
                if (in_array($node->nodeName, self::SCORE_ROOT_TAGS, true)) {
                    break;
                }

                $key = spl_object_id($node);
                $scores[$key] ??= ['node' => $node, 'score' => 0.0];

                // A közvetlen szülő kapja a teljes pontot, a távolabbi ősök
                // csökkenő részt — így a legszűkebb valódi keret nyer, nem a
                // lap-váz, ami minden blokkot tartalmaz.
                $scores[$key]['score'] += $length / ($depth + 1);
                $depth++;
            }
        }

        $best = null;
        $bestScore = 0.0;

        foreach ($scores as $candidate) {
            if ($candidate['score'] <= $bestScore) {
                continue;
            }

            if ($this->linkDensity($candidate['node']) >= 0.35) {
                continue;
            }

            $best = $candidate['node'];
            $bestScore = $candidate['score'];
        }

        return $best;
    }

    /**
     * A linkekben álló szöveg aránya az elem teljes szövegéhez. Menü, ajánló-
     * lista és címke-felsorolás értéke magas, folyó szövegé alacsony.
     */
    private function linkDensity(Element $node): float
    {
        $total = mb_strlen($this->normalizeWhitespace($node->textContent));

        if ($total === 0) {
            return 1.0;
        }

        $linked = 0;

        foreach ($node->querySelectorAll('a') as $anchor) {
            $linked += mb_strlen($this->normalizeWhitespace($anchor->textContent));
        }

        return $linked / $total;
    }

    /**
     * Blokk-tudatos szöveggé alakítás: minden blokkelem külön bekezdés lesz,
     * így a `strip_tags()`-nél tapasztalt szó-összeragadás nem fordulhat elő.
     */
    private function toText(Element $root): string
    {
        $paragraphs = [];

        foreach ($root->querySelectorAll(self::BLOCK_SELECTOR) as $node) {
            // Egymásba ágyazott blokknál csak a legbelső kell, különben a
            // külső elem szövege másodszor is bekerülne.
            if ($node->querySelector(self::BLOCK_SELECTOR) !== null) {
                continue;
            }

            $text = $this->normalizeWhitespace($node->textContent);

            if ($text === '' || $this->linkDensity($node) >= self::MAX_LINK_DENSITY) {
                continue;
            }

            $paragraphs[] = $text;
        }

        // Blokkelem nélküli lap (nyers szöveg egy `div`-ben): a teljes szöveg,
        // normalizált szóközökkel — üres kimenetnél ez is jobb.
        if ($paragraphs === []) {
            return $this->normalizeWhitespace($root->textContent);
        }

        return implode("\n\n", $paragraphs);
    }

    private function normalizeWhitespace(string $text): string
    {
        return trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
    }
}
