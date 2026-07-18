/**
 * Self-destruct service worker (SW-2, last_audit/fazis-4.md).
 *
 * A PWA-build ki lett vezetve: a `vite-plugin-pwa` már nincs a projektben, sem
 * SW-regisztráció, sem manifest-link nem létezik (ellenőrizve: a `registerSW.js`
 * és a `manifest.webmanifest` sem áll elő build-kor). Az itt korábban
 * verzió-követett generált kimenet ezért generátor nélkül maradt build-artefakt
 * volt: olyan előtöltési listára hivatkozott, aminek MINDEN asset-je 404 (a
 * hash-elt fájlnevek rég lecserélődtek), a navigációs oldal-stratégia pedig
 * denylist nélkül a BEJELENTKEZETT oldalak HTML-válaszait is lemezre írta —
 * megosztott gépen kijelentkezés után is olvasható maradvány.
 *
 * Miért tombstone és nem egyszerű fájl-törlés (az elvetett alternatíva):
 * a böngésző egy már telepített service workert 404-es válaszra NEM deregisztrál,
 * csak a frissítést hagyja ki — a régi példány és a tárolt oldal-válaszok tehát
 * határozatlan ideig életben maradnának a korábbi látogatók gépén. A puszta
 * törlés a szerverről takarítana, a felhasználók böngészőjéből nem. Ezért a
 * fájlnak ugyanazon az URL-en kell maradnia, de olyan tartalommal, ami takarít
 * és kivezeti önmagát; ez a bevett `self-destroying` service worker minta.
 *
 * Ez a fájl szándékosan minimális, és NEM build-ből regenerálódik. Ha valaha
 * visszatér a PWA, a generált service worker váltja fel ezt a tombstone-t.
 */

self.addEventListener('install', () => {
    // Nem várunk a régi példány leállására: a takarítás minél előbb lépjen életbe.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            // 1. MINDEN korábbi cache törlése (oldal-, betűtípus- és előtöltési).
            //    Nevesített lista helyett teljes kulcs-bejárás: az előtöltési cache
            //    neve build-hash-től függött, így nem hardcode-olható megbízhatóan.
            //    Az egyes törlések hibája nem buktathatja a többit, ezért allSettled.
            const cacheKeys = await caches.keys();
            await Promise.allSettled(cacheKeys.map((key) => caches.delete(key)));

            // 2. Önmaga deregisztrálása — ezután a böngésző már nem tölti be újra.
            await self.registration.unregister();

            // 3. A nyitott fülek újratöltése, hogy azonnal service worker nélküli,
            //    friss hálózati választ kapjanak. E nélkül a már futó kliens a fül
            //    bezárásáig a most törölt cache-re épülő állapotban maradna.
            const clients = await self.clients.matchAll({ type: 'window' });
            clients.forEach((client) => client.navigate(client.url));
        })()
    );
});
