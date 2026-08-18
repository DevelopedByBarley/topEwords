<?php

namespace App\Services;

/**
 * Szó-szövegek normalizálása kereséshez és AI-promptokhoz.
 *
 * A lelet: a valódi szövegekben (különösen EPUB-könyvekben és a legtöbb
 * weboldalon) nem az ASCII aposztróf áll a szavakban, hanem a tipográfiai
 * jobbra dőlő idézőjel (’, U+2019): „couldn’t", nem „couldn't". A szólista, a
 * saját szavak és az AI-promptok bemeneti szűrője viszont ASCII aposztróffal
 * dolgozik, ezért a tipográfiai alak
 *
 *   - a szó-keresésben nem illeszkedett a tárolt „couldn't"-ra (hamis „nincs
 *     találat", majd duplikált saját szó), és
 *   - az AI-végpontokon a `sanitizeWordForPrompt()` szűrőjén elhasalt
 *     („Érvénytelen szó." 422).
 *
 * Az elemzés (`TextAnalysisController::analyze`) ezt eddig is normalizálta —
 * ezért működött a kiemelés, miközben ugyanarra a szóra a keresés és az
 * AI-kitöltés elhasalt. Ez az osztály ennek az egyetlen forrása. Kliens-oldali
 * párja a `tokenKey()` (tokenize-render.ts), ami ugyanezt a három karaktert
 * cseréli le.
 */
class WordText
{
    /**
     * A tipográfiai aposztróf-változatok, amiket ASCII aposztrófra cserélünk:
     * bal/jobb egyszeres idézőjel és a prime.
     *
     * @var array<int, string>
     */
    private const TYPOGRAPHIC_APOSTROPHES = ["\u{2018}", "\u{2019}", "\u{2032}"];

    /** A tipográfiai aposztrófokat ASCII aposztrófra cseréli. */
    public static function normalizeApostrophes(string $word): string
    {
        return str_replace(self::TYPOGRAPHIC_APOSTROPHES, "'", $word);
    }

    /**
     * Egy szó tárolt alakjainak lehetséges aposztróf-változatai.
     *
     * A saját szavak régebben azzal az aposztróffal mentődtek el, amilyennel a
     * felhasználó a szövegben rákattintott, ezért a keresésnek mindkét alakot
     * próbálnia kell — különben a saját „couldn’t" szó a normalizált keresésre
     * láthatatlan lenne.
     *
     * @return array<int, string>
     */
    public static function apostropheVariants(string $word): array
    {
        $normalized = self::normalizeApostrophes($word);
        $variants = [$normalized];

        foreach (self::TYPOGRAPHIC_APOSTROPHES as $apostrophe) {
            $variants[] = str_replace("'", $apostrophe, $normalized);
        }

        return array_values(array_unique($variants));
    }
}
