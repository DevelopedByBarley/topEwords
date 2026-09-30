<x-mail::message>
# Szia!

Meghívást kaptál a **{{ $appName }}** zártkörű tesztelésére. Ez egy angol szótanuló alkalmazás, amit kifejezetten magyaroknak készítünk — és most te is az elsők között próbálhatod ki.

**Ami vár rád:**

- **Flashcardok okos ismétléssel** — az algoritmus figyeli, mikor mit érdemes átismételned, neked csak tanulnod kell.
- **Szövegelemzés** — nézd meg egy cikkről, könyvről vagy YouTube-videóról, mennyit értesz belőle, mielőtt nekiállnál.
- **AI-segítség magyarul** — magyar jelentés és példamondat bármelyik szóhoz, egy kattintással kártyát is készít.
@if ($extensionUrl !== null)
- **Chrome-bővítmény** — YouTube- és Netflix-feliratokon is kikeresheted a szavakat. [Bővítmény telepítése]({{ $extensionUrl }})
@endif

@if ($proDays !== null)
<x-mail::panel>
🎁 **{{ $proDays }} napig ingyen tiéd a Pro csomag**, a teljes AI-kerettel együtt. Ehhez nem kell bankkártyát megadnod — a regisztrációval azonnal indul.
</x-mail::panel>
@endif

<x-mail::button :url="$registerUrl">
Regisztrálok
</x-mail::button>

A meghívókódod (**{{ $code }}**) már benne van a gomb linkjében, nem kell begépelned.@if ($expiresAt !== null) A meghívó eddig érvényes: **{{ $expiresAt }}**.@endif

@if ($showTestCard)
## Kipróbálnád az előfizetést is? Nyugodtan!

Az alkalmazás most **tesztüzemben** fut: a fizetés csak szimuláció, **valódi pénz nem mozdul**, és egyetlen bankkártyát sem terhel senki. Ne a saját kártyádat add meg, hanem ezt a tesztkártyát — a Stripe, a fizetési szolgáltatónk pontosan erre a célra adja ki:

<x-mail::panel>
**Kártyaszám:** 4242 4242 4242 4242<br>
**Lejárat:** bármilyen jövőbeli dátum, pl. 12/34<br>
**CVC:** bármilyen három szám, pl. 123
</x-mail::panel>

Ez a szám nem tartozik senki bankszámlájához, valódi vásárlásra nem is lehet használni. A fizetési oldalon egy teszt-jelzés (pl. „Test mode” vagy „Sandbox”) is mutatja, hogy csak próbáról van szó. A teszt-előfizetést a Beállításokban bármikor lemondhatod.

Ezzel nekünk is sokat segítesz: így tudjuk ellenőrizni, hogy az éles indulásnál a fizetés is gördülékenyen működik.
@endif

Ha hibát találsz vagy ötleted van, írd meg nekünk a [Hibabejelentés]({{ $reportUrl }}) oldalon — minden visszajelzést elolvasunk.

Jó tanulást!<br>
{{ $appName }}
</x-mail::message>
