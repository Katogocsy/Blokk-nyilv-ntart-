# 🧾 Blokk-nyilvántartó

Egyszerű, mobilbarát webalkalmazás bevásárlási blokkok nyilvántartására.

**Tervezett működés:** a blokkot lefotózod → a Gemini felismeri az adatait → ellenőrzöd → Google Sheets-be mented.

## Jelenlegi állapot

Ez az első, alap verzió:

- 📷 **Blokk fotózása** – mobilon közvetlenül a hátsó kamerát nyitja meg
- 📁 **Blokk feltöltése** – meglévő kép kiválasztása
- 🖼️ **Kép előnézet** fájlnévvel és mérettel
- 🔍 **Elemzés** gomb – egyelőre csak szimulált (a képet base64-re alakítja elő)
- ℹ️ **Állapotjelző** szöveg

A Gemini API és a Google Sheets integráció **még nincs** bekötve.

## Fájlok

| Fájl | Tartalom |
|------|----------|
| `index.html` | A felület szerkezete |
| `style.css` | Mobilbarát megjelenés, sötét mód támogatással |
| `app.js` | Képkezelés, előnézet, állapotjelzés |
| `README.md` | Ez a leírás |

## Futtatás

Nincs szükség telepítésre. Két lehetőség:

1. Nyisd meg az `index.html`-t böngészőben.
2. Vagy indíts helyi szervert a mappában:
   ```bash
   python3 -m http.server 8000
   ```
   majd nyisd meg: `http://localhost:8000`

> Mobilon a kamera eléréséhez a legjobb HTTPS-en keresztül futtatni (pl. GitHub Pages).

## Következő lépések

- [ ] Gemini API bekötése (`app.js` → `elemzes()` függvény, `TODO` jelölésnél)
- [ ] Felismert adatok szerkeszthető űrlapon (bolt, dátum, tételek, végösszeg)
- [ ] Mentés Google Sheets-be
