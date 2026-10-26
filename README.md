# 🧾 Blokk-nyilvántartó

Egyszerű, mobilbarát webalkalmazás bevásárlási blokkok nyilvántartására.

**Tervezett működés:** a blokkot lefotózod → a Gemini felismeri az adatait → ellenőrzöd → Google Sheets-be mented.

## Jelenlegi állapot

- 📷 **Blokk fotózása** – mobilon közvetlenül a hátsó kamerát nyitja meg
- 📁 **Blokk feltöltése** – meglévő kép kiválasztása
- 🖼️ **Kép előnézet** fájlnévvel és mérettel
- 🔍 **Elemzés** – a Gemini Flash strukturált JSON-ban adja vissza a blokk adatait (bolt, dátum, pénznem, összegek, fizetési mód, OCR-bizalom, termékek); a JSON ideiglenesen a képernyőn is megjelenik
- ✅ **Ellenőrzés** – ha a tételek összege nem egyezik a bruttó végösszeggel, vagy a dátum nem YYYY-MM-DD, figyelmeztet, és az OCR-bizalmat „alacsony”-ra állítja
- 📝 **Ellenőrző űrlap** – a felismert adatok szerkeszthetők (bolt, dátum, bruttó végösszeg, ÁFA, fizetési mód), a termékek táblázatban (név, mennyiség, egységár, részösszeg), sor hozzáadása/törlése; a blokk képe kis előnézetben látszik (koppintásra nagyítható)
- ➕ **Automatikus összegzés** – a termékek összege azonnal újraszámolódik; mennyiség vagy egységár módosításakor a részösszeg is; eltérés esetén sárga figyelmeztetés
- 📤 **Mentés a Sheets-be** – csak akkor aktív, ha van bolt, dátum és bruttó végösszeg; az adatokat a blokkazonosítóval együtt elküldi az Apps Script Web App-nak, sikeres mentés után törli az űrlapot. Hibánál (hálózat, 429, 500, elutasítás) kiírja az okát. Automatikusan nem küldi újra; a kézi újraküldés biztonságos, mert ugyanaz a blokk nem kerül be kétszer.
- ℹ️ **Állapotjelző** szöveg


## Fájlok

| Fájl | Tartalom |
|------|----------|
| `index.html` | A felület szerkezete |
| `style.css` | Mobilbarát megjelenés, sötét mód támogatással |
| `app.js` | Képkezelés, előnézet, `sendToGemini()` |
| `config.example.js` | Konfigurációs minta (API kulcs, modell, Apps Script URL, token) |
| `apps-script/Code.gs` | A Google Sheets oldali Web App (ezt az Apps Scriptbe kell bemásolni) |
| `apps-script/UTMUTATO.md` | Az Apps Script beállítása lépésről lépésre |
| `.gitignore` | Kizárja a saját `config.js`-t a verziókezelésből |

## Beállítás

### GitHub Pages / telefon (ajánlott)

1. Nyisd meg az oldalt, és lent a **⚙️ Beállítások** részbe illeszd be a Gemini API kulcsot.
2. A modell alapértéke `gemini-3.6-flash`. Ha mindig a legújabb Flash modellt szeretnéd, írd át `gemini-flash-latest`-re.
3. Az **Apps Script Web App URL** mezőbe másold be a bevezetéskor kapott, `…/exec` végű címet (lásd `apps-script/UTMUTATO.md`).
4. Ha az Apps Scriptben `API_TOKEN`-t állítottál be, írd be a **Hozzáférési token** mezőbe is.
5. Nyomd meg a **Mentés** gombot.

A kulcs, az URL és a token csak az adott telefon böngészőjében tárolódik (localStorage), a GitHubra nem kerül fel. Inkognitó módban nem marad meg. Ha másik eszközt vagy böngészőt használsz, ott újra meg kell adni.

### Helyi fejlesztés (opcionális)

A saját gépeden a `config.example.js` **másolatát** elmentheted `config.js` néven, és beírhatod a kulcsot, az `APPS_SCRIPT_URL`-t és (opcionálisan) az `API_TOKEN`-t. A `config.js`-t soha ne töltsd fel – a `.gitignore` kizárja. A Beállításokban mentett érték elsőbbséget élvez a `config.js`-sel szemben.

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
- [x] Strukturált JSON válasz kérése
- [x] Felismert adatok szerkeszthető űrlapon
- [x] Mentés Google Sheets-be Apps Script Web App-on keresztül
