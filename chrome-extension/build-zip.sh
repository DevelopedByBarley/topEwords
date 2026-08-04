#!/usr/bin/env bash
# Tiszta, Chrome Web Store-ba feltölthető zip készítése a bővítményből.
# Használat: ./build-zip.sh
set -euo pipefail

cd "$(dirname "$0")"

# Verzió kiolvasása a manifestből (a zip nevéhez)
VERSION=$(grep -m1 '"version"' manifest.json | sed -E 's/.*"version" *: *"([^"]+)".*/\1/')
OUT="topwords-extension-${VERSION}.zip"

# Csak a bővítményhez tartozó fájlok kerülnek a csomagba.
# A content script több, fókuszált modulra van bontva a src/ alatt — a betöltési
# sorrendet a manifest.json content_scripts.js tömbje rögzíti.
#
# A src/page-highlight.js SZÁNDÉKOSAN nincs a listán: az 1.29-cel kivezettük az
# `<all_urls>` content scriptet, és vele az oldal-kiemelést, ezért ez a modul nem
# töltődik be sehol. A fájl a repóban marad, hogy a visszahozás egy manifest-
# bejegyzés legyen (a teljes 1.28-as állapot: `ext-1.28-all-urls` tag).
FILES=(
    manifest.json
    background.js
    src/shared.js
    src/styles.js
    src/tokenizer.js
    src/lookup-popup.js
    src/search-modal.js
    src/flashcard-modal.js
    src/youtube.js
    src/netflix.js
    popup.html
    popup.css
    popup.js
    icon16.png
    icon48.png
    icon128.png
)

# Hiányzó fájl ellenőrzése
for f in "${FILES[@]}"; do
    if [[ ! -f "$f" ]]; then
        echo "HIBA: hiányzó fájl: $f" >&2
        exit 1
    fi
done

rm -f "$OUT"
# -X: extra attribútumok (pl. macOS .DS_Store, resource fork) kihagyása
zip -X "$OUT" "${FILES[@]}"

# Stabil nevű másolat a letöltéshez. A fájl a PRIVÁT diskre megy: a
# DownloadController streameli hitelesítés után, a public/ alól nem elérhető.
DOWNLOAD_DIR="../storage/app/private/downloads"
mkdir -p "$DOWNLOAD_DIR"
cp "$OUT" "$DOWNLOAD_DIR/topwords-extension.zip"

echo ""
echo "Kész: $(pwd)/$OUT"
echo "Letöltés (privát disk): $(cd "$DOWNLOAD_DIR" && pwd)/topwords-extension.zip"
echo "Töltsd fel a CWS-zip-et ($OUT) a Chrome Web Store Developer Dashboardon."
