# Blokk-nyilvántartó

**Az alkalmazás elköltözött.** A 2. verziótól a felület és a Gemini-hívás is a
saját Google Apps Script projektemben fut („Csak én” hozzáféréssel), a
Gemini API-kulcs pedig a szerveren, a Szkripttulajdonságok között van.

Ez a GitHub Pages oldal már csak egy kivezető oldalt szolgál ki. Megnyitáskor
törli a böngészőben maradt régi beállításokat (API-kulcs, token, Apps Script
URL). Az új cím szándékosan nem szerepel itt.

## Forráskód (2. verzió)

Az `apps-script-v2` mappában (ha feltöltöd ide):

| Fájl | Szerep |
|---|---|
| `Code.gs` | Szerveroldal: Gemini-proxy, validáció, mentés, összesítők, napló |
| `Index.html` | Az oldal váza |
| `Stilus.html` | Stílusok |
| `Szkript.html` | Kliensoldali JavaScript (`google.script.run`) |
| `appsscript.json` | Manifeszt: minimális jogosultságok, „Csak én” hozzáférés |

Telepítés: lásd a „Blokk-nyilvántartó – átállás a 2. verzióra” útmutatót.

Az API-kulcsot soha ne töltsd fel ebbe a repóba.
