<?php

namespace App\Services;

/**
 * Egy EPUB spine-fájl (X)HTML-jéből olvasható könyvszöveg kinyerése.
 *
 * Korábban ez a `TextAnalysisController` két privát metódusa volt
 * (`htmlToCleanText()` + `cleanExtractedText()`). Az onnan hozott hibák — mérve
 * a Gutenberg-féle Pride and Prejudice-on (728 106 karakter) és az Ender's
 * Game-en:
 *
 *  1. EGYETLEN entitás-dekódolás. A forrásban duplán kódolt entitás is van
 *     (`&amp;#8217;`), ezért a kimenetben `Ender&#8217;s` maradt, és a
 *     szóelemző „Ender" + „s" tokent kapott az „Ender's" helyett.
 *  2. A `<head>` nem volt a drop-listán, így a `<title>` MINDEN fejezet elejére
 *     beszivárgott („Pride and prejudice | Project Gutenberg").
 *  3. A `<br>` szóközzé olvadt, a forrás ~70 karakteres TÖRDELÉSE viszont
 *     sortörésként ment tovább — pont fordítva, mint kellett volna: a
 *     `<br/>`-rel tördelt előzéklapok egyetlen szövegfallá folytak össze, a
 *     valódi bekezdések meg fél mondatos hamis bekezdésekre estek szét (11 231
 *     sortörés, de csak 14 valódi bekezdés-határ; a könyv első lapjából a
 *     frontend 79 külön `<p>`-t rendert).
 *  4. A 15 karakteres sorszűrő valódi szöveget dobott el („He was silent." = 14
 *     karakter), és a hamis sortörések miatt a bekezdés-farkakat is.
 *  5. Az előzéklap jogi szövege, a szögletes zárójeles kolofón-feliratok és a
 *     teljes Gutenberg-licenc bent maradt.
 *
 * A javítások SORRENDJE lényeges: a blokk-tudatos szöveggé alakítás
 * (`toBlockAwareText()`) előfeltétele a sorszűrőnek — előbb kell összeállnia a
 * valódi bekezdésnek, különben a szűrő a bekezdés-farkakat vágja le.
 *
 * BIZTONSÁG ÉS TERHELÉS. A webes ág (`ArticleTextExtractor`) HTML5-parserrel
 * dolgozik, ez az ág SZÁNDÉKOSAN nem, és ezzel a korábbi terhelési profil
 * változatlan marad:
 *  • Minden lépés LINEÁRIS a bemenet méretében (regex-lánc, visszalépés-mentes
 *    minták). A libxml HTML-parser költsége viszont a beágyazási MÉLYSÉGBEN
 *    kvadratikus, és itt nem egy lapot, hanem kérésenként akár 500 spine-elemet
 *    (elemenként max 5 MB) dolgozunk fel — a parser-út tehát elem-szintű
 *    nyitó-tag sapkát és tartalék ágat is igényelne. A zip-bomba-költségvetést
 *    (`MAX_EPUB_ENTRY_BYTES` / `MAX_EPUB_TOTAL_BYTES` / `MAX_EPUB_SPINE_ITEMS`)
 *    így nem kell újraszabni.
 *  • A dekódolás továbbra is a `strip_tags()` UTÁN fut, ezért a dekódolt `<`/`>`
 *    karakterekből markup nem épülhet vissza: a kimenet sima szöveg, amit a
 *    frontend escape-elve rendel (nincs `dangerouslySetInnerHTML` az útvonalon).
 *  • Az ismételt dekódolás kör-sapkával fut, hogy egy sokszorosan kódolt fájl ne
 *    tudja körbefuttatni.
 *
 * Mérve, 5 MB-os bemeneten: valódi próza 204 ms, 200 000 szint mélyre ágyazott
 * `div` 51 ms (a parser-út itt másodperces lenne), szándékosan `<br>`-rel
 * spammelt fájl 406 ms. Az utolsó a lánc leglassabb alakja, mert minden `<br>`
 * külön sort hoz létre a sorszűrőnek — a régi lánc ezen 23 ms volt, mert a
 * `<br>`-t szóközzé olvasztotta. A 40 MB-os spine-költségvetéssel és a feltöltés
 * `throttle:10,1,ta-books` fékével ez kérésenként ~3 s CPU felső korlátot ad.
 */
class BookTextExtractor
{
    /**
     * Sosem próza: a teljes elem törlődik. A `head` azért van itt, mert a
     * `<title>` egyébként minden fejezet első „bekezdése" lenne.
     *
     * A `(?=[\s/>])` a tag-név után NEM elhagyható: nélküle a `head`
     * alternatíva a `<header>`-re is illeszkedne, és a lezáró `</head>`-ig
     * mindent elvinne.
     */
    private const DROP_ELEMENT_PATTERN = '#<(head|script|style|figure|figcaption|nav|header|footer|aside|svg|math)(?=[\s/>])[^>]*>.*?</\1\s*>#si';

    /** Tartalom nélküli elemek: a helyükön szóköz áll (szóösszeragadás ellen). */
    private const VOID_ELEMENT_PATTERN = '#<(?:img|hr|input|source|col|link|meta)(?=[\s/>])[^>]*>#si';

    /** Kézi sortörés: VALÓDI sorhatár (előzéklap, blurb, cím-lista tördelése). */
    private const LINE_BREAK_PATTERN = '#<br(?=[\s/>])[^>]*>#i';

    /** Ezek zárótagja az EGYETLEN másik valódi bekezdés-határ. */
    private const BLOCK_END_PATTERN = '#</(?:p|div|li|h[1-6]|blockquote|section|article|tr|td|th|dd|dt|pre)\s*>#i';

    /** Ennyiszer próbáljuk újra a dekódolást (duplán kódolt entitás + kör-fék). */
    private const MAX_ENTITY_DECODE_ROUNDS = 3;

    /** Ennél rövidebb sor jellemzően címke vagy képfelirat, nem próza. */
    private const MIN_LINE_LENGTH = 15;

    /**
     * Előzéklap / copyright-oldal tipikus sorai. Szövegrészletre illeszkedik,
     * ezért csak rövid sorokra alkalmazzuk (`MAX_LEGAL_LINE_LENGTH`): egy valódi
     * bekezdés, ami mellékesen tartalmazza a „first edition" fordulatot, így nem
     * esik ki.
     */
    private const LEGAL_LINE_PATTERN = '/all rights reserved|\bisbn\b|cataloging-in-publication|printed in the united states|first edition|a tor book|work of fiction|library of congress/i';

    /** A jogi kulcsszó-szűrő efölött már nem szólhat bele (lásd feljebb). */
    private const MAX_LEGAL_LINE_LENGTH = 200;

    /**
     * A Gutenberg-kiadások törzsét ez a két marker fogja közre; kívül a teljes
     * licencszöveg áll, ami több ezer szónyi nem-könyv tartalom.
     *
     * @var list<string>
     */
    private const GUTENBERG_START_MARKERS = [
        'START OF THE PROJECT GUTENBERG EBOOK',
        'START OF THIS PROJECT GUTENBERG EBOOK',
    ];

    /** @var list<string> */
    private const GUTENBERG_END_MARKERS = [
        'END OF THE PROJECT GUTENBERG EBOOK',
        'END OF THIS PROJECT GUTENBERG EBOOK',
    ];

    /**
     * A fejezet szövege, bekezdésenként sortöréssel elválasztva. Üres stringet
     * ad, ha a fájlban nincs próza (borító, TOC, kolofón).
     */
    public function extract(string $html): string
    {
        $text = $this->toBlockAwareText($html);
        $text = $this->decodeEntities($text);
        $text = $this->trimGutenbergLicense($text);

        return $this->cleanLines($text);
    }

    /**
     * Szöveggé alakítás úgy, hogy sortörést KIZÁRÓLAG valódi blokk-határ adjon:
     * a `<br>` és a blokkelemek zárótagja. A forrás saját tördelése előbb
     * szóközzé olvad, így a bekezdés egyetlen sorként áll össze.
     */
    private function toBlockAwareText(string $html): string
    {
        $html = preg_replace(self::DROP_ELEMENT_PATTERN, ' ', $html) ?? $html;
        $html = preg_replace(self::VOID_ELEMENT_PATTERN, ' ', $html) ?? $html;

        // A HTML-ben a sortörés jelentés nélküli whitespace. Ezt MÉG a
        // blokk-határok megjelölése előtt olvasztjuk szóközzé, különben a
        // forrás ~70 karakteres tördelései hamis bekezdés-határok lennének.
        // A minta szándékosan `/u` nélküli: a `\s` így bájt-szintű ASCII
        // whitespace-t jelent, tehát egy nem-UTF-8 fejezeten sem hasal el
        // (a többbájtos karakterek minden bájtja > 0x7F).
        $html = preg_replace('/\s+/', ' ', $html) ?? $html;

        $html = preg_replace(self::LINE_BREAK_PATTERN, "\n", $html) ?? $html;
        $html = preg_replace(self::BLOCK_END_PATTERN, "\n", $html) ?? $html;

        return strip_tags($html);
    }

    /**
     * Entitás-dekódolás addig ismételve, amíg változik — de legfeljebb
     * `MAX_ENTITY_DECODE_ROUNDS` körben.
     *
     * A duplán kódolt `&amp;#8217;`-ből egyetlen kör után `&#8217;` MARADNA
     * szövegként, és a szóelemző „Ender" + „s" tokent kapna az „Ender's"
     * helyett. A kör-sapka a végtelen ciklust és a sokszorosan kódolt
     * (dekóder-bomba jellegű) fájlt zárja.
     */
    private function decodeEntities(string $text): string
    {
        for ($round = 0; $round < self::MAX_ENTITY_DECODE_ROUNDS; $round++) {
            $decoded = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');

            if ($decoded === $text) {
                break;
            }

            $text = $decoded;
        }

        return $text;
    }

    /**
     * A Gutenberg-markereken kívüli licencszöveg levágása.
     *
     * Fájlonként fut, ezért mindkét irány külön kezelendő: a `START` jellemzően
     * az előzéklap-fájlban van (előtte minden eldobható), az `END` az utolsó
     * fájlban (utána minden eldobható). `stripos()`-szal keresünk, nem
     * regexszel, hogy a költség biztosan lineáris maradjon.
     */
    private function trimGutenbergLicense(string $text): string
    {
        foreach (self::GUTENBERG_START_MARKERS as $marker) {
            $position = stripos($text, $marker);

            if ($position === false) {
                continue;
            }

            $lineEnd = strpos($text, "\n", $position);
            $text = $lineEnd === false ? '' : substr($text, $lineEnd + 1);
            break;
        }

        foreach (self::GUTENBERG_END_MARKERS as $marker) {
            $position = stripos($text, $marker);

            if ($position === false) {
                continue;
            }

            $lineStart = strrpos(substr($text, 0, $position), "\n");
            $text = $lineStart === false ? '' : substr($text, 0, $lineStart);
            break;
        }

        return $text;
    }

    /**
     * Sorszűrés: URL-ek, díszítő sorok, jogi boilerplate és kolofón-feliratok
     * eldobása. Csak a `toBlockAwareText()` UTÁN futhat, mert egy sor itt már
     * egy teljes bekezdés — a nyers forráson a bekezdés-farkakat vágná le.
     */
    private function cleanLines(string $text): string
    {
        $clean = [];

        foreach (explode("\n", $text) as $line) {
            $line = trim($line);

            if ($line === '') {
                continue;
            }

            // URL-nek vagy fájlútvonalnak látszó sorok
            if (preg_match('/^https?:\/\/\S+$/i', $line) || preg_match('/^www\.\S+$/i', $line)) {
                continue;
            }

            // Teljes egészében szögletes zárójelben álló sor: kolofón,
            // copyright-felirat, illusztráció-jelölés — nem a könyv szövege.
            if (preg_match('/^\[.*\]$/', $line)) {
                continue;
            }

            if (mb_strlen($line) <= self::MAX_LEGAL_LINE_LENGTH && preg_match(self::LEGAL_LINE_PATTERN, $line)) {
                continue;
            }

            // Sorok, ahol a karakterek kevesebb mint 50 %-a betű
            // („* * *", „- - -", oldalszámok, ISBN-sorok stb.)
            $letterCount = preg_match_all('/[a-zA-Z]/u', $line);
            $totalCount = mb_strlen($line);
            if ($totalCount > 0 && ($letterCount / $totalCount) < 0.5) {
                continue;
            }

            // Rövid sorok eldobása (fejezetcím, képfelirat, címke) — de a
            // párbeszéd-kezdet és a MONDATVÉGI írásjelre végződő sor marad,
            // különben a „He was silent." (14 karakter) némán elvész.
            if (mb_strlen($line) < self::MIN_LINE_LENGTH
                && ! preg_match('/^["“”‘’«—]/u', $line)
                && ! preg_match('/[.!?]["”’»)\]]?$/u', $line)) {
                continue;
            }

            $clean[] = $line;
        }

        $result = implode("\n", $clean);

        // Üres sorok és többszörös szóközök összevonása
        $result = preg_replace('/(\s*\n\s*){3,}/', "\n\n", $result) ?? $result;
        $result = preg_replace('/[ \t]+/', ' ', $result) ?? $result;

        return trim($result);
    }
}
