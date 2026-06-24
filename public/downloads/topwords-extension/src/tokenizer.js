// Közös szó/kifejezés-tokenizálás (oldal-kiemelés + YouTube + Netflix).

// ── Közös szó/kifejezés tokenizálás ─────────────────────────────────────────
// Ugyanaz a logika, mint a webes szövegelemzőben (buildRenderTokens): a szöveget
// szó/elválasztó darabokra bontja, és a leghosszabb ismert kifejezést illeszti
// elsőként (max 3 szó, közöttük csak whitespace), így a kifejezés egy egységként
// jelölhető. A kifejezéseket a státusztérkép kulcsában lévő szóköz árulja el.

const MAX_PHRASE_WORDS = 3;
const HL_WORD_SPLIT = /([a-zA-Z]+(?:['’][a-zA-Z]+)*)/;
const phraseFlagCache = new WeakMap();

function hlKey(word) {
    return word.toLowerCase().replace(/[‘’′]/g, "'");
}

/** Igaz, ha a térkép tartalmaz legalább egy több szavas kifejezést. Map-enként cache-elt. */
function mapHasPhrases(map) {
    if (!map) {
        return false;
    }

    if (phraseFlagCache.has(map)) {
        return phraseFlagCache.get(map);
    }

    const value = [...map.keys()].some((key) => key.includes(' '));
    phraseFlagCache.set(map, value);

    return value;
}

function lookupWordStatus(map, key) {
    // Birtokos eset visszaesés: "john's" → "john".
    return map.get(key) ?? map.get(key.split("'")[0]);
}

/**
 * Tokenekre bontja a szöveget: { kind: 'sep' | 'word' | 'phrase', text, status }.
 * A státusszal rendelkező 'word'/'phrase' tokeneket kell kiemelni.
 */
function buildHlTokens(text, map, hasPhrases) {
    const parts = text.split(HL_WORD_SPLIT);
    const tokens = [];
    let i = 0;

    while (i < parts.length) {
        // Az elválasztók a páros indexeken vannak.
        if (i % 2 === 0) {
            if (parts[i] !== '') {
                tokens.push({ kind: 'sep', text: parts[i] });
            }

            i += 1;

            continue;
        }

        let matched = false;

        if (hasPhrases) {
            for (let n = MAX_PHRASE_WORDS; n >= 2; n -= 1) {
                const lastWordIdx = i + (n - 1) * 2;

                if (lastWordIdx >= parts.length) {
                    continue;
                }

                const words = [];
                let adjacent = true;

                for (let k = 0; k < n; k += 1) {
                    words.push(parts[i + k * 2]);

                    // A kifejezés szavai között csak whitespace állhat.
                    if (
                        k < n - 1 &&
                        !/^\s+$/.test(parts[i + k * 2 + 1] ?? '')
                    ) {
                        adjacent = false;

                        break;
                    }
                }

                if (!adjacent) {
                    continue;
                }

                const status = map.get(words.map(hlKey).join(' '));

                if (status) {
                    tokens.push({
                        kind: 'phrase',
                        text: parts.slice(i, lastWordIdx + 1).join(''),
                        status,
                    });
                    i = lastWordIdx + 1;
                    matched = true;

                    break;
                }
            }
        }

        if (matched) {
            continue;
        }

        tokens.push({
            kind: 'word',
            text: parts[i],
            status: lookupWordStatus(map, hlKey(parts[i])),
        });
        i += 1;
    }

    return tokens;
}
