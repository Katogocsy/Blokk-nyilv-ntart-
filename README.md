# 🧾 Blokk-nyilvántartó

Egyszerű, mobilbarát webalkalmazás bevásárlási blokkok nyilvántartására.

**Tervezett működés:** a blokkot lefotózod → a Gemini felismeri az adatait → ellenőrzöd → Google Sheets-be mented.

## Jelenlegi állapot

- 📷 **Blokk fotózása** – mobilon közvetlenül a hátsó kamerát nyitja meg
- 📁 **Blokk feltöltése** – meglévő kép kiválasztása
- 🖼️ **Kép előnézet** fájlnévvel és mérettel
- 🔍 **Elemzés** – a képet elküldi a Gemini Flash API-nak, a nyers választ a böngésző konzoljára írja
- ℹ️ **Állapotjelző** szöveg

Strukturált (JSON) adatkinyerés és Google Sheets mentés **még nincs**.

## Fájlok

| Fájl | Tartalom |
|------|----------|
| `index.html` | A felület szerkezete |
| `style.css` | Mobilbarát megjelenés, sötét mód támogatással |
| `app.js` | Képkezelés, előnézet, `sendToGemini()` |
| `config.example.js` | Konfigurációs minta (API kulcs, modell, Apps Script URL) |
| `.gitignore` | Kizárja a saját `config.js`-t a verziókezelésből |

## Beállítás

1. Másold le a `config.example.js` fájlt **`config.js`** néven.
2. Írd be a Gemini API kulcsodat a `GEMINI_API_KEY` mezőbe.
3. A `GEMINI_MODEL` alapértéke `gemini-3.6-flash`. Ha mindig a legújabb Flash modellt szeretnéd, írd át `gemini-flash-latest`-re.
4. Az `APPS_SCRIPT_URL` most még maradhat helyőrző.

## Gemini API kulcs szerzése (Google AI Studio)

1. Nyisd meg: <https://aistudio.google.com> és jelentkezz be Google-fiókkal.
2. A bal oldali menüben válaszd a **Get API key** (API-kulcs) menüpontot.
3. Kattints a **Create API key** gombra. Ha kéri, válassz vagy hozz létre egy Google Cloud projektet.
4. Másold ki a kulcsot (`AIza…` kezdetű), és illeszd be a `config.js`-be.

Az ingyenes szint személyes használatra általában elég, de napi/percenkénti korlátai vannak.

### ⚠️ Biztonság

Az API kulcs a böngészőben fut, tehát aki eléri az oldalt, az a kulcsot is láthatja.

- A `config.js`-t ne töltsd fel GitHubra (a `.gitignore` ezt kizárja).
- Az oldalt ne tedd nyilvánosan elérhetővé a kulccsal együtt.
- Az AI Studio / Google Cloud Console-ban érdemes a kulcsot korlátozni (pl. csak a Generative Language API-ra).
- Ha a kulcs kiszivárog, töröld és hozz létre újat.

## Futtatás

A `config.js` betöltése miatt helyi szerverrel a legmegbízhatóbb:

```bash
python3 -m http.server 8000
```

majd nyisd meg: `http://localhost:8000`

Teszteléshez nyisd meg a böngésző fejlesztői konzolját (F12 → Console), válassz egy blokkfotót, és nyomd meg az **Elemzés** gombot. A konzolon megjelenik a Gemini nyers válasza és a kiolvasott szöveg.

> Mobilon a kamera eléréséhez HTTPS ajánlott.

## Következő lépések

- [x] Gemini Flash API hívás (`sendToGemini`)
- [ ] Strukturált JSON válasz kérése (bolt, dátum, tételek, végösszeg)
- [ ] Felismert adatok szerkeszthető űrlapon
- [ ] Mentés Google Sheets-be Apps Script Web App-on keresztül
