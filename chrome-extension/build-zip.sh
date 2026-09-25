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

if command -v zip >/dev/null 2>&1; then
    # -X: extra attribútumok (pl. macOS .DS_Store, resource fork) kihagyása
    zip -X "$OUT" "${FILES[@]}"
else
    # Windows (Git Bash): nincs zip, de a rendszer tar.exe-je bsdtar, ami a
    # kiterjesztésből (-a) zip-et ír, perjeles útvonalakkal. (A PowerShell
    # Compress-Archive-ja nem jó: az 5.1-es backslash-es útvonalakat ír.)
    BSDTAR=""

    for candidate in bsdtar /c/Windows/System32/tar.exe; do
        if command -v "$candidate" >/dev/null 2>&1 && "$candidate" --version 2>/dev/null | grep -q bsdtar; then
            BSDTAR="$candidate"
            break
        fi
    done

    if [[ -z "$BSDTAR" ]]; then
        echo "HIBA: sem zip, sem bsdtar nem érhető el" >&2
        exit 1
    fi

    "$BSDTAR" -a -cf "$OUT" "${FILES[@]}"
fi

# Kicsomagolt, bitre azonos másolat (a .gitignore szerint build-kimenet). Az
# ExtensionContentScriptScopeTest md5-tel veti össze a forrással, hogy a
# feltöltött csomag ne maradhasson el a repótól.
PACKAGE_DIR="topwords-extension-${VERSION}"
rm -rf "$PACKAGE_DIR"

for f in "${FILES[@]}"; do
    mkdir -p "$PACKAGE_DIR/$(dirname "$f")"
    cp "$f" "$PACKAGE_DIR/$f"
done

# Stabil nevű másolat a letöltéshez. A fájl a PRIVÁT diskre megy: a
# DownloadController streameli hitelesítés után, a public/ alól nem elérhető.
DOWNLOAD_DIR="../storage/app/private/downloads"
mkdir -p "$DOWNLOAD_DIR"
cp "$OUT" "$DOWNLOAD_DIR/topwords-extension.zip"

echo ""
echo "Kész: $(pwd)/$OUT"
echo "Letöltés (privát disk): $(cd "$DOWNLOAD_DIR" && pwd)/topwords-extension.zip"
echo "Töltsd fel a CWS-zip-et ($OUT) a Chrome Web Store Developer Dashboardon."
