# Manuális teszt-napló

Ez a fájl azt tartja nyilván, hogy **manuálisan (kézzel, böngészőben)** mely területeket
ellenőriztem. Nem automatizált teszt és nem kód-audit — kizárólag a saját kézi
végigkattintás eredménye.

Jelölések:

- ✅ ellenőrizve, rendben
- ⚠️ ellenőrizve, észrevétel / hiba
- ⬜ még nem ellenőrizve

---

## Admin auth

Utolsó ellenőrzés: 2026-08-12

| # | Mit ellenőriztem | Állapot | Megjegyzés |
|---|---|---|---|
| 1 | Admin belépés érvényes adatokkal | ✅ | |
| 2 | Admin felület elérése nem-admin userrel (tiltva kell lennie) | ✅ | |
| 3 | Admin felület elérése kijelentkezve (login-ra dob) | ✅ | |
| 4 | Admin menüpontok csak adminnak látszanak | ✅ | |
| 5 | Admin kijelentkezés | ✅ | |

**Észrevételek:**

- _(nincs)_

---

## User auth

Utolsó ellenőrzés: 2026-08-12

| # | Mit ellenőriztem | Állapot | Megjegyzés |
|---|---|---|---|
| 1 | Regisztráció új e-mail-lel | ✅ | |
| 2 | E-mail megerősítő levél megérkezik és a link működik | ✅ | |
| 3 | Belépés érvényes adatokkal | ✅ | |
| 4 | Belépés hibás jelszóval (hibaüzenet, nincs beléptetés) | ✅ | |
| 5 | Elfelejtett jelszó → reset levél → új jelszó | ✅ | |
| 6 | Jelszóváltás a beállításokban | ✅ | |
| 7 | Kijelentkezés | ✅ | |
| 8 | Védett oldal elérése kijelentkezve (login-ra dob) | ✅ | |

**Észrevételek:**

- _(nincs)_

---

## Folders (mappák)

Utolsó ellenőrzés: 2026-08-12

| # | Mit ellenőriztem | Állapot | Megjegyzés |
|---|---|---|---|
| 1 | Új mappa létrehozása | ✅ | |
| 2 | Mappa átnevezése | ✅ | |
| 3 | Mappa törlése | ✅ | |
| 4 | Szó hozzáadása mappához / eltávolítása | ✅ | |
| 5 | Mappa tartalmának listázása | ✅ | |
| 6 | Más felhasználó mappája nem érhető el (IDOR) | ✅ | |
| 7 | Üres mappa megjelenése (empty state) | ✅ | |

**Észrevételek:**

- _(nincs)_

---

## Még nem ellenőrzött területek

- ⬜ Words (szavak)
- ⬜ Flashcards
- ⬜ Text analysis (szövegelemző)
- ⬜ Chrome extension
- ⬜ Billing / előfizetés
- ⬜ Dashboard
- ⬜ Settings
