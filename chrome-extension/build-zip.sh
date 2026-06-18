#!/usr/bin/env bash
# Tiszta, Chrome Web Store-ba feltölthető zip készítése a bővítményből.
# Használat: ./build-zip.sh
set -euo pipefail

cd "$(dirname "$0")"

# Verzió kiolvasása a manifestből (a zip nevéhez)
VERSION=$(grep -m1 '"version"' manifest.json | sed -E 's/.*"version" *: *"([^"]+)".*/\1/')
OUT="topwords-extension-${VERSION}.zip"

# Csak a bővítményhez tartozó fájlok kerülnek a csomagba
FILES=(
    manifest.json
    background.js
    content.js
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

# Stabil nevű másolat a publikus letöltéshez (a landing oldal innen kínálja).
PUBLIC_DIR="../public/downloads"
mkdir -p "$PUBLIC_DIR"
cp "$OUT" "$PUBLIC_DIR/topwords-extension.zip"

echo ""
echo "Kész: $(pwd)/$OUT"
echo "Publikus letöltés: $(cd "$PUBLIC_DIR" && pwd)/topwords-extension.zip"
echo "Töltsd fel a CWS-zip-et ($OUT) a Chrome Web Store Developer Dashboardon."
