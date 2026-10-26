"use strict";

// --- Elemek ---
const kameraInput = document.getElementById("kameraInput");
const feltoltesInput = document.getElementById("feltoltesInput");
const elonezetKep = document.getElementById("elonezetKep");
const elonezetUres = document.getElementById("elonezetUres");
const fajlInfo = document.getElementById("fajlInfo");
const elemzesGomb = document.getElementById("elemzesGomb");
const allapot = document.getElementById("allapot");

const beallitasok = document.getElementById("beallitasok");
const beallitasForm = document.getElementById("beallitasForm");
const kulcsMezo = document.getElementById("kulcsMezo");
const kulcsMutat = document.getElementById("kulcsMutat");
const modellMezo = document.getElementById("modellMezo");
const kulcsTorles = document.getElementById("kulcsTorles");
const scriptUrlMezo = document.getElementById("scriptUrlMezo");
const tokenMezo = document.getElementById("tokenMezo");
const valaszSzoveg = document.getElementById("valaszSzoveg");
const figyelmeztetesLista = document.getElementById("figyelmeztetesLista");

const elonezetKartya = document.getElementById("elonezetKartya");
const ellenorzesKartya = document.getElementById("ellenorzesKartya");
const kisKep = document.getElementById("kisKep");
const bizalomJelzo = document.getElementById("bizalomJelzo");
const blokkUrlap = document.getElementById("blokkUrlap");
const mezoBolt = document.getElementById("mezoBolt");
const mezoDatum = document.getElementById("mezoDatum");
const mezoFizetes = document.getElementById("mezoFizetes");
const mezoBrutto = document.getElementById("mezoBrutto");
const mezoAfa = document.getElementById("mezoAfa");
const termekTorzs = document.getElementById("termekTorzs");
const termekOsszeg = document.getElementById("termekOsszeg");
const sorHozzaadas = document.getElementById("sorHozzaadas");
const osszegFigyelmeztetes = document.getElementById("osszegFigyelmeztetes");
const mentesGomb = document.getElementById("mentesGomb");
const mentesInfo = document.getElementById("mentesInfo");
const mentesEredmeny = document.getElementById("mentesEredmeny");

// --- Konfiguráció ---
// Elsőbbség: a telefonon mentett beállítás, utána a (helyi) config.js, végül az alapérték.
const GEMINI_API_ALAP = "https://generativelanguage.googleapis.com/v1beta/models";
const ALAP_MODELL = "gemini-3.6-flash";
const TAROLO_KULCS = "blokk.geminiApiKey";
const TAROLO_MODELL = "blokk.geminiModel";
const TAROLO_SCRIPT_URL = "blokk.appsScriptUrl";
const TAROLO_TOKEN = "blokk.apiToken";

function taroloOlvas(nev) {
  try {
    return localStorage.getItem(nev) || "";
  } catch {
    return "";
  }
}

function taroloIr(nev, ertek) {
  try {
    if (ertek) localStorage.setItem(nev, ertek);
    else localStorage.removeItem(nev);
    return true;
  } catch {
    return false;
  }
}

function ervenyesErtek(ertek) {
  return ertek && !String(ertek).startsWith("IDE_JON") ? String(ertek).trim() : "";
}

/** Az aktuális beállítások összegyűjtése. */
function getConfig() {
  const fajlbol = window.APP_CONFIG || {};
  return {
    GEMINI_API_KEY: taroloOlvas(TAROLO_KULCS) || ervenyesErtek(fajlbol.GEMINI_API_KEY),
    GEMINI_MODEL: taroloOlvas(TAROLO_MODELL) || ervenyesErtek(fajlbol.GEMINI_MODEL) || ALAP_MODELL,
    APPS_SCRIPT_URL: taroloOlvas(TAROLO_SCRIPT_URL) || ervenyesErtek(fajlbol.APPS_SCRIPT_URL),
    API_TOKEN: taroloOlvas(TAROLO_TOKEN) || ervenyesErtek(fajlbol.API_TOKEN),
  };
}

// A Gemini beágyazott (inline) képküldésnél a teljes kérés max. ~20 MB lehet,
// a base64 kódolás pedig kb. 33%-kal növeli a méretet – ezért 10 MB a korlát.
const MAX_MERET_MB = 10;

// --- Állapot ---
let kivalasztottFajl = null;
let elonezetUrl = null;

/**
 * Állapotjelző szöveg frissítése.
 * @param {string} szoveg
 * @param {"info"|"siker"|"hiba"|"figyelem"|""} tipus
 */
function allapotBeallitas(szoveg, tipus = "") {
  allapot.textContent = szoveg;
  allapot.className = "allapot" + (tipus ? " " + tipus : "");
}

function meretFormazas(bajt) {
  if (bajt < 1024) return bajt + " B";
  if (bajt < 1024 * 1024) return (bajt / 1024).toFixed(0) + " kB";
  return (bajt / (1024 * 1024)).toFixed(1) + " MB";
}

/** Ellenőrzi, hogy van-e API kulcs. */
function konfigHiba() {
  if (!getConfig().GEMINI_API_KEY) {
    return "Még nincs megadva Gemini API kulcs. Nyisd meg lent a ⚙️ Beállításokat.";
  }
  return null;
}

/** Beállítások mezőinek feltöltése a mentett értékekkel. */
function beallitasokBetoltese() {
  kulcsMezo.value = taroloOlvas(TAROLO_KULCS);
  modellMezo.value = taroloOlvas(TAROLO_MODELL) || getConfig().GEMINI_MODEL;
  scriptUrlMezo.value = taroloOlvas(TAROLO_SCRIPT_URL);
  scriptUrlMezo.placeholder = getConfig().APPS_SCRIPT_URL
    ? "a config.js-ben megadott URL-t használja"
    : "https://script.google.com/macros/s/…/exec";
  tokenMezo.value = taroloOlvas(TAROLO_TOKEN);
}

function beallitasokMentese(esemeny) {
  esemeny.preventDefault();
  const kulcs = kulcsMezo.value.trim();
  const modell = modellMezo.value.trim();
  const scriptUrl = scriptUrlMezo.value.trim();
  const token = tokenMezo.value.trim();

  if (scriptUrl && !ervenyesScriptUrl(scriptUrl)) {
    allapotBeallitas(
      "Az Apps Script URL nem megfelelő. A bevezetéskor kapott, https://script.google.com/macros/s/… kezdetű " +
        "és /exec végű címet másold be.",
      "hiba"
    );
    scriptUrlMezo.focus();
    return;
  }

  if (!kulcs) {
    allapotBeallitas("Add meg az API kulcsot a mentéshez.", "figyelem");
    kulcsMezo.focus();
    return;
  }

  const sikerult =
    taroloIr(TAROLO_KULCS, kulcs) &&
    taroloIr(TAROLO_MODELL, modell && modell !== ALAP_MODELL ? modell : "") &&
    taroloIr(TAROLO_SCRIPT_URL, scriptUrl) &&
    taroloIr(TAROLO_TOKEN, token);

  if (!sikerult) {
    allapotBeallitas(
      "Nem sikerült menteni. A böngésző tiltja a tárolást (pl. privát/inkognitó mód).",
      "hiba"
    );
    return;
  }

  kulcsMutat.checked = false;
  kulcsMezo.type = "password";
  tokenMezo.type = "password";
  beallitasok.open = false;
  if (blokkAllapot) mentesAllapotFrissites();
  allapotBeallitas(
    kivalasztottFajl
      ? "Beállítások elmentve. Nyomd meg az „Elemzés” gombot."
      : "Beállítások elmentve. Most válassz ki vagy fotózz le egy blokkot.",
    "siker"
  );
}

function kulcsTorlese() {
  if (!confirm("Biztosan törlöd az API kulcsot erről a telefonról?")) return;
  taroloIr(TAROLO_KULCS, "");
  kulcsMezo.value = "";
  allapotBeallitas("Az API kulcs törölve erről az eszközről.", "info");
}

/** A kép MIME-típusa; ha a böngésző nem adja meg, a kiterjesztésből találjuk ki. */
function kepTipus(fajl) {
  if (fajl.type) return fajl.type;
  const kit = (fajl.name || "").split(".").pop().toLowerCase();
  const tipusok = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    webp: "image/webp", heic: "image/heic", heif: "image/heif",
  };
  return tipusok[kit] || "";
}

function heicKep(tipus) {
  return tipus === "image/heic" || tipus === "image/heif";
}

/** Kiválasztott kép kezelése (kamerából vagy feltöltésből). */
function kepKezelese(fajl) {
  if (!fajl) return;

  const tipus = kepTipus(fajl);
  if (!tipus.startsWith("image/")) {
    allapotBeallitas("Ez nem képfájl. Kérlek, válassz JPG, PNG vagy WEBP képet.", "hiba");
    return;
  }

  if (fajl.size > MAX_MERET_MB * 1024 * 1024) {
    allapotBeallitas(`A kép túl nagy (max. ${MAX_MERET_MB} MB).`, "hiba");
    return;
  }

  if (elonezetUrl) URL.revokeObjectURL(elonezetUrl);

  kivalasztottFajl = fajl;
  elonezetUrl = URL.createObjectURL(fajl);

  urlapElrejtese();

  elonezetKep.src = elonezetUrl;
  elonezetKep.hidden = false;
  elonezetUres.hidden = true;
  fajlInfo.textContent = `${fajl.name || "kamera-kep"} · ${meretFormazas(fajl.size)}`;

  elemzesGomb.disabled = false;
  allapotBeallitas("A kép betöltve. Nyomd meg az „Elemzés” gombot.", "info");
}

// Ha a böngésző nem tudja megjeleníteni a képet (pl. HEIC Chrome-ban)
function elonezetHiba() {
  elonezetKep.hidden = true;
  elonezetUres.hidden = false;
  if (kivalasztottFajl && heicKep(kepTipus(kivalasztottFajl))) {
    elonezetUres.textContent = "HEIC kép – ez a böngésző nem tud előnézetet mutatni.";
    allapotBeallitas(
      "A kép HEIC formátumú, ezért nincs előnézet. Az elemzés ettől még működhet, " +
      "de iPhone-on a Beállítások → Kamera → Formátumok → „Legkompatibilisebb” opcióval JPG-be fotózhatsz.",
      "figyelem"
    );
  } else {
    elonezetUres.textContent = "A kép nem jeleníthető meg.";
    allapotBeallitas("A kép nem jeleníthető meg ebben a böngészőben. Próbálj JPG vagy PNG képet.", "hiba");
  }
}

function inputValtozas(esemeny) {
  const fajl = esemeny.target.files && esemeny.target.files[0];
  kepKezelese(fajl);
  esemeny.target.value = ""; // ugyanaz a fájl újra kiválasztható legyen
}

/** Kép átalakítása base64-re (data URL előtag nélkül). */
function fajlBase64Re(fajl) {
  return new Promise((resolve, reject) => {
    const olvaso = new FileReader();
    olvaso.onload = () => resolve(String(olvaso.result).split(",")[1]);
    olvaso.onerror = () => reject(new Error("A kép beolvasása sikertelen."));
    olvaso.readAsDataURL(fajl);
  });
}

// --- Gemini: strukturált blokk-felismerés ---

const BIZALOM_ERTEKEK = ["magas", "kozepes", "alacsony"];

/**
 * A termékkategóriák fix listája. Ugyanez a lista van a Code.gs-ben is (a táblázat legördülő
 * listájához) – ha módosítod, mindkét helyen módosítsd.
 */
const KATEGORIAK = ["Élelmiszer", "Ital", "Háztartás", "Drogéria és szépségápolás", "Ruházat és cipő", "Egészség", "Elektronika", "Otthon és kert", "Szabadidő és sport", "Betétdíj", "Egyéb"];
const ALAP_KATEGORIA = "Egyéb";

/** A válasz sémája a Gemini számára (OpenAPI-részhalmaz, ahogy a responseSchema várja). */
const BLOKK_SEMA = {
  type: "OBJECT",
  properties: {
    bolt: { type: "STRING", nullable: true },
    datum: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
    penznem: { type: "STRING", nullable: true, description: "ISO 4217 kód, pl. HUF" },
    brutto_vegosszeg: { type: "NUMBER", nullable: true },
    netto_vegosszeg: { type: "NUMBER", nullable: true },
    afa_osszeg: { type: "NUMBER", nullable: true },
    fizetes_modja: { type: "STRING", nullable: true },
    ocr_bizalom: { type: "STRING", enum: BIZALOM_ERTEKEK },
    termekek: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          termek_nev: { type: "STRING", nullable: true },
          mennyiseg: { type: "NUMBER", nullable: true },
          mennyisegi_egyseg: { type: "STRING", nullable: true },
          egysegar: { type: "NUMBER", nullable: true },
          reszosszeg: { type: "NUMBER", nullable: true },
          kategoria: { type: "STRING", enum: KATEGORIAK },
        },
        required: ["termek_nev", "mennyiseg", "mennyisegi_egyseg", "egysegar", "reszosszeg", "kategoria"],
        propertyOrdering: ["termek_nev", "mennyiseg", "mennyisegi_egyseg", "egysegar", "reszosszeg", "kategoria"],
      },
    },
  },
  required: [
    "bolt", "datum", "penznem", "brutto_vegosszeg", "netto_vegosszeg",
    "afa_osszeg", "fizetes_modja", "ocr_bizalom", "termekek",
  ],
  propertyOrdering: [
    "bolt", "datum", "penznem", "brutto_vegosszeg", "netto_vegosszeg",
    "afa_osszeg", "fizetes_modja", "ocr_bizalom", "termekek",
  ],
};

const BLOKK_UTASITAS = `Ez egy bevásárlási blokk (nyugta vagy egyszerűsített számla) fényképe, jellemzően magyar.
Olvasd ki az adatait, és KIZÁRÓLAG egy JSON objektumot adj vissza, ezekkel a mezőkkel:

{
  "bolt": string | null,              // az üzlet vagy cég neve, ahogy a blokkon áll
  "datum": string | null,             // a vásárlás dátuma YYYY-MM-DD formátumban
  "penznem": string | null,           // ISO kód, pl. "HUF" (Ft esetén "HUF")
  "brutto_vegosszeg": number | null,  // a fizetendő végösszeg (ÖSSZESEN)
  "netto_vegosszeg": number | null,
  "afa_osszeg": number | null,
  "fizetes_modja": string | null,     // pl. "bankkártya", "készpénz", "SZÉP-kártya"
  "ocr_bizalom": "magas" | "kozepes" | "alacsony",
  "termekek": [
    {
      "termek_nev": string | null,
      "mennyiseg": number | null,
      "mennyisegi_egyseg": string | null,   // pl. "db", "kg", "l"
      "egysegar": number | null,
      "reszosszeg": number | null,          // a tétel sorának végösszege
      "kategoria": string                   // a lenti kategórialista egyik eleme
    }
  ]
}

Szabályok:
- Ha egy adat nem olvasható vagy nem szerepel a blokkon, az értéke legyen null.
- Ne találgass és ne számolj ki olyan értéket, ami nincs a blokkon (pl. ha a nettó vagy az ÁFA összege nincs feltüntetve, legyen null).
- A számok sima JSON-számok legyenek: ezres elválasztó és pénznem nélkül, tizedespont használatával (pl. "51 950 Ft" → 51950, "1,250 kg" → 1.25).
- A kedvezményeket, engedményeket, visszáru- és betétdíj-sorokat külön tételként vedd fel, negatív "reszosszeg"-gel, ha a blokkon levonásként szerepelnek.
- A termékkódokat, vonalkódokat, ÁFA-kulcs jelöléseket ne tedd bele a termék nevébe.
- Az "ocr_bizalom" azt mutassa, mennyire biztos a kiolvasás: "magas", ha minden fontos adat jól olvasható; "kozepes", ha néhány adat bizonytalan; "alacsony", ha sok adat olvashatatlan.
- Ha a termékek "reszosszeg" értékeinek összege nem egyezik közelítőleg a "brutto_vegosszeg"-gel, az "ocr_bizalom" legyen "alacsony".

Kategóriák – minden termékhez PONTOSAN EGYET válassz ebből a listából (betűre egyezően):
${KATEGORIAK.map((k) => "- " + k).join("\n")}

Kategorizálási szabályok:
- A termék neve (és a bolt típusa) alapján dönts; a blokkokon a nevek gyakran rövidítettek (pl. "ÍR VAJ" → Élelmiszer, "SZÖRP NARANCS" → Ital, "TOM TAILOR T-SHIRT" → Ruházat és cipő).
- Ital: üdítő, víz, szörp, kávé, tea, sör, bor, szeszes ital. Minden más étel: Élelmiszer.
- Drogéria és szépségápolás: tisztálkodás, kozmetikum, pelenka. Háztartás: tisztítószer, mosószer, papíráru, eldobható eszközök.
- Egészség: gyógyszer, vitamin, gyógyászati termék.
- Betétdíj: üveg- és palackbetétdíj, visszaváltási díj (pl. "Visszav.díj").
- Kedvezmény, engedmény, kupon sorához annak a terméknek a kategóriáját add, amelyikre a kedvezmény vonatkozik (általában a közvetlenül előtte lévő tétel); ha nem egyértelmű, "Egyéb".
- Ha bizonytalan vagy, "Egyéb".`;

/** A válasz szöveges részének kinyerése (a „gondolkodás” részeket kihagyva). */
function valaszSzovege(adat) {
  return (adat?.candidates?.[0]?.content?.parts || [])
    .filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("")
    .trim();
}

/** JSON kiolvasása a válaszszövegből (ha a modell ```json blokkba tenné, azt is kezeli). */
function jsonKinyerese(szoveg) {
  let tiszta = szoveg.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(tiszta);
  } catch {
    const eleje = tiszta.indexOf("{");
    const vege = tiszta.lastIndexOf("}");
    if (eleje !== -1 && vege > eleje) {
      return JSON.parse(tiszta.slice(eleje, vege + 1));
    }
    throw new Error("A Gemini válasza nem érvényes JSON.");
  }
}

/** Szám vagy null: a szövegként érkező számokat is értelmezi, a többit null-ra állítja. */
function szamVagyNull(ertek) {
  if (ertek === null || ertek === undefined || ertek === "") return null;
  if (typeof ertek === "number") return Number.isFinite(ertek) ? ertek : null;
  const szam = Number(String(ertek).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(szam) ? szam : null;
}

function szovegVagyNull(ertek) {
  if (ertek === null || ertek === undefined) return null;
  const s = String(ertek).trim();
  return s ? s : null;
}

/** A nyers JSON egységes formára hozása, a pontos mezőkészlettel és sorrenddel. */
function blokkNormalizalasa(nyers) {
  const termekek = Array.isArray(nyers?.termekek) ? nyers.termekek : [];
  return {
    bolt: szovegVagyNull(nyers?.bolt),
    datum: szovegVagyNull(nyers?.datum),
    penznem: szovegVagyNull(nyers?.penznem),
    brutto_vegosszeg: szamVagyNull(nyers?.brutto_vegosszeg),
    netto_vegosszeg: szamVagyNull(nyers?.netto_vegosszeg),
    afa_osszeg: szamVagyNull(nyers?.afa_osszeg),
    fizetes_modja: szovegVagyNull(nyers?.fizetes_modja),
    ocr_bizalom: BIZALOM_ERTEKEK.includes(nyers?.ocr_bizalom) ? nyers.ocr_bizalom : "alacsony",
    termekek: termekek.map((t) => ({
      termek_nev: szovegVagyNull(t?.termek_nev),
      mennyiseg: szamVagyNull(t?.mennyiseg),
      mennyisegi_egyseg: szovegVagyNull(t?.mennyisegi_egyseg),
      egysegar: szamVagyNull(t?.egysegar),
      reszosszeg: szamVagyNull(t?.reszosszeg),
      kategoria: KATEGORIAK.includes(t?.kategoria) ? t.kategoria : ALAP_KATEGORIA,
    })),
  };
}

/** Érvényes, valós naptári dátum-e YYYY-MM-DD formában. */
function ervenyesDatum(datum) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return false;
  const [e, h, n] = datum.split("-").map(Number);
  const d = new Date(Date.UTC(e, h - 1, n));
  return d.getUTCFullYear() === e && d.getUTCMonth() === h - 1 && d.getUTCDate() === n;
}

/**
 * Ellenőrzések a szabályok szerint. A Gemini döntését nem hisszük el vakon:
 * ha a részösszegek nem egyeznek a végösszeggel, itt is „alacsony”-ra állítjuk.
 * @returns {{szoveg: string, osszeg?: boolean}[]} figyelmeztetések a felhasználónak
 *   (az „osszeg: true” jelölésűt az űrlap élőben, sárgán mutatja)
 */
function blokkEllenorzese(blokk) {
  const figyelmeztetesek = [];

  if (blokk.datum !== null && !ervenyesDatum(blokk.datum)) {
    figyelmeztetesek.push({ szoveg: `A dátum („${blokk.datum}”) nem volt YYYY-MM-DD formátumú, ezért üresen hagytam – add meg kézzel.` });
    blokk.datum = null;
  }

  const reszek = blokk.termekek.map((t) => t.reszosszeg);
  const hianyzoResz = reszek.some((r) => r === null);
  const osszeg = Math.round(reszek.reduce((s, r) => s + (r || 0), 0) * 100) / 100;

  if (blokk.brutto_vegosszeg === null) {
    figyelmeztetesek.push({ szoveg: "A bruttó végösszeg nem volt olvasható – add meg kézzel." });
  } else if (blokk.termekek.length === 0) {
    figyelmeztetesek.push({ szoveg: "Nem sikerült termékeket kiolvasni – a „Sor hozzáadása” gombbal felveheted őket." });
    blokk.ocr_bizalom = "alacsony";
  } else {
    // Közelítő egyezés: 1% vagy legalább 5 egység eltérés (pl. kerekítés miatt) elfogadható
    const tures = Math.max(5, Math.abs(blokk.brutto_vegosszeg) * 0.01);
    const elteres = Math.abs(osszeg - blokk.brutto_vegosszeg);
    if (hianyzoResz || elteres > tures) {
      const ok = hianyzoResz ? "néhány tétel részösszege hiányzik" : `eltérés: ${elteres}`;
      figyelmeztetesek.push({
        osszeg: true,
        szoveg: `A tételek összege (${osszeg}) nem egyezik a bruttó végösszeggel (${blokk.brutto_vegosszeg}) – ${ok}.`,
      });
      blokk.ocr_bizalom = "alacsony";
    }
  }

  return figyelmeztetesek;
}

/** Tartalék modellek, ha a beállított modell túlterhelt (az első, ami nem egyezik a beállítottal). */
const TARTALEK_MODELLEK = ["gemini-3.5-flash", "gemini-2.5-flash"];

/** Ezeknél a hibáknál érdemes újrapróbálni: túlterhelés, kvóta, szerverhiba, hálózat. */
const UJRAPROBALHATO_STATUSZOK = [429, 500, 502, 503, 504];

/** Alap várakozás az újrapróbálás előtt (ms), és a legtöbb, amennyit kivárunk. */
const UJRAPROBALAS_VARAKOZAS_MS = 5000;
const MAX_VARAKOZAS_MS = 20000;

function varakozas(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** A Gemini által javasolt várakozási idő (pl. "17s" a RetryInfo-ban), ms-ben – ha van. */
function javasoltVarakozas(adat) {
  const reszletek = adat?.error?.details || [];
  for (const d of reszletek) {
    const m = /^(\d+(?:\.\d+)?)s$/.exec(d?.retryDelay || "");
    if (m) return Math.ceil(Number(m[1]) * 1000);
  }
  return null;
}

/** A Gemini hibakódjának magyar, érthető megfogalmazása. */
function geminiHibaUzenet(status, apiUzenet, modell) {
  const u = apiUzenet || "";
  if (status === 503) {
    return `A Gemini szervere most túlterhelt (503). Ez átmeneti – próbáld újra pár perc múlva.`;
  }
  if (status === 429) {
    return /quota|per day|daily/i.test(u)
      ? "Elérted a Gemini ingyenes keretét (429). Várj egy kicsit (vagy holnapig, ha a napi keret fogyott el), majd próbáld újra."
      : "Túl sok kérés ment rövid idő alatt a Geminihez (429). Várj egy percet, majd próbáld újra.";
  }
  if (status === 500 || status === 502 || status === 504) {
    return `A Gemini szervere hibát jelzett (${status}). Ez általában átmeneti – próbáld újra kicsit később.`;
  }
  if (status === 400 && /api key|API_KEY/i.test(u)) {
    return "A Gemini API kulcs érvénytelen. Ellenőrizd, és másold be újra a ⚙️ Beállításokban.";
  }
  if (status === 403) {
    return "A Gemini megtagadta a hozzáférést (403). Ellenőrizd az API kulcsot és annak korlátozásait a Google AI Studióban.";
  }
  if (status === 404) {
    return `A(z) „${modell}” modell nem található (404). Ellenőrizd a modell nevét a ⚙️ Beállításokban.`;
  }
  if (status === 400) {
    return `A Gemini nem tudta feldolgozni a kérést (400): ${u}`;
  }
  return `A Gemini hívás sikertelen (${status}): ${u}`;
}

/** Egy Gemini-kérés elküldése a megadott modellnek; hibánál kivételt dob, sikernél a nyers választ adja vissza. */
async function geminiKeres(keres, modell) {
  const cfg = getConfig();
  const url = `${GEMINI_API_ALAP}/${encodeURIComponent(modell)}:generateContent`;

  let valasz;
  try {
    valasz = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": cfg.GEMINI_API_KEY,
      },
      body: JSON.stringify(keres),
    });
  } catch (halozatiHiba) {
    const hiba = new Error(
      navigator.onLine === false
        ? "Nincs internetkapcsolat. Kapcsold be a netet, majd próbáld újra."
        : "Nem sikerült elérni a Gemini szervert. Ellenőrizd az internetkapcsolatot."
    );
    hiba.halozati = true;
    throw hiba;
  }

  const adat = await valasz.json().catch(() => null);
  console.log(`Gemini nyers válasz (${modell}):`, adat);

  if (!valasz.ok) {
    const apiUzenet = adat?.error?.message || `HTTP ${valasz.status}`;
    console.error("Gemini hiba:", valasz.status, adat);
    const hiba = new Error(geminiHibaUzenet(valasz.status, apiUzenet, modell));
    hiba.status = valasz.status;
    hiba.apiUzenet = apiUzenet;
    hiba.varakozasMs = javasoltVarakozas(adat);
    throw hiba;
  }

  return adat;
}

/** Egy modell kipróbálása: először sémával, ha azt nem fogadja el, sima JSON-módban. */
async function elemzesModellel(tartalom, modell) {
  try {
    return await geminiKeres(
      {
        contents: tartalom,
        generationConfig: { responseMimeType: "application/json", responseSchema: BLOKK_SEMA },
      },
      modell
    );
  } catch (h) {
    // Ha a modell/API a sémát nem fogadja el, sima JSON-módban próbáljuk újra
    // (a mezőket az utasítás így is pontosan leírja).
    const semaHiba =
      h.status === 400 && /schema|responseSchema|Unknown name|Invalid JSON payload/i.test(h.apiUzenet || "");
    if (!semaHiba) throw h;
    console.warn("A séma nem lett elfogadva, újrapróbálás sima JSON-módban:", h.apiUzenet);
    return geminiKeres({ contents: tartalom, generationConfig: { responseMimeType: "application/json" } }, modell);
  }
}

function ujraprobalhato(hiba) {
  return hiba.halozati || UJRAPROBALHATO_STATUSZOK.includes(hiba.status);
}

/**
 * Kép elküldése a Gemini Flash API-nak, strukturált JSON-választ kérve.
 * Túlterhelés/kvóta/szerverhiba esetén egyszer újrapróbálja ugyanazzal a modellel,
 * majd ha az sem sikerül, egy tartalék modellel. (Az elemzésnél ez biztonságos:
 * nem ment semmit, így nem keletkezhet duplikátum.)
 * @param {File} imageFile
 * @param {(szoveg: string) => void} [jelzes] – folyamatjelzés a felületnek
 * @returns {Promise<{nyers: object, blokk: object, figyelmeztetesek: {szoveg: string, osszeg?: boolean}[], modell: string, tartalek: boolean}>}
 */
async function sendToGemini(imageFile, jelzes = () => {}) {
  const hiba = konfigHiba();
  if (hiba) throw new Error(hiba);

  const base64 = await fajlBase64Re(imageFile);
  const tartalom = [
    {
      parts: [
        { inline_data: { mime_type: kepTipus(imageFile) || "image/jpeg", data: base64 } },
        { text: BLOKK_UTASITAS },
      ],
    },
  ];

  const fomodell = getConfig().GEMINI_MODEL;
  const tartalekModell = TARTALEK_MODELLEK.find((m) => m !== fomodell);

  let nyers;
  let hasznaltModell = fomodell;
  try {
    nyers = await elemzesModellel(tartalom, fomodell);
  } catch (elsoHiba) {
    if (!ujraprobalhato(elsoHiba)) throw elsoHiba;

    // 1. újrapróbálás ugyanazzal a modellel, rövid várakozás után
    const varakozasMs = Math.min(elsoHiba.varakozasMs || UJRAPROBALAS_VARAKOZAS_MS, MAX_VARAKOZAS_MS);
    const ok = elsoHiba.status === 503 ? "túlterhelt" : elsoHiba.status === 429 ? "korlátozza a kéréseket" : "nem válaszolt rendesen";
    jelzes(`A Gemini most ${ok}, ${Math.round(varakozasMs / 1000)} mp múlva újrapróbálom…`);
    console.warn(`Gemini hiba (${elsoHiba.status || "hálózat"}), újrapróbálás ${varakozasMs} ms múlva.`);
    await varakozas(varakozasMs);

    try {
      jelzes("Újrapróbálás…");
      nyers = await elemzesModellel(tartalom, fomodell);
    } catch (masodikHiba) {
      if (!ujraprobalhato(masodikHiba) || masodikHiba.halozati || !tartalekModell) throw masodikHiba;

      // 2. tartalék modell
      jelzes(`Még mindig nem megy, a tartalék modellel próbálom (${tartalekModell})…`);
      console.warn(`Átváltás tartalék modellre: ${tartalekModell}`);
      try {
        nyers = await elemzesModellel(tartalom, tartalekModell);
        hasznaltModell = tartalekModell;
      } catch (tartalekHiba) {
        // A felhasználónak az eredeti modell hibája az informatívabb
        console.error("A tartalék modell is hibát adott:", tartalekHiba);
        masodikHiba.message += " (A tartalék modell sem válaszolt.)";
        throw masodikHiba;
      }
    }
  }

  const szoveg = valaszSzovege(nyers);
  if (!szoveg) {
    const ok = nyers?.promptFeedback?.blockReason || nyers?.candidates?.[0]?.finishReason;
    throw new Error("A Gemini nem adott választ" + (ok ? ` (${ok}).` : "."));
  }
  console.log("Gemini szöveges válasz:\n" + szoveg);

  const blokk = blokkNormalizalasa(jsonKinyerese(szoveg));
  const geminiBizalom = blokk.ocr_bizalom;
  const figyelmeztetesek = blokkEllenorzese(blokk);
  if (geminiBizalom !== blokk.ocr_bizalom) {
    console.log(`ocr_bizalom: Gemini szerint „${geminiBizalom}”, ellenőrzés után „${blokk.ocr_bizalom}”.`);
  }
  console.log("Feldolgozott blokk:", blokk);

  return { nyers, blokk, figyelmeztetesek, modell: hasznaltModell, tartalek: hasznaltModell !== fomodell };
}

// --- Ellenőrző űrlap ---

/** Az űrlapon szerkesztett blokk aktuális állapota (a Gemini JSON-jából indul). */
let blokkAllapot = null;

const SZAM_FORMATUM = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 });
const BIZALOM_FELIRAT = {
  magas: "OCR-bizalom: magas",
  kozepes: "OCR-bizalom: közepes",
  alacsony: "OCR-bizalom: alacsony",
};

function kerekit2(szam) {
  return Math.round(szam * 100) / 100;
}

function szamFormazas(szam) {
  return szam === null ? "–" : SZAM_FORMATUM.format(szam);
}

/** Szám a beviteli mezőbe: ezres elválasztó nélkül, tizedesvesszővel. */
function szamMezobe(szam) {
  return szam === null || szam === undefined ? "" : String(szam).replace(".", ",");
}

/**
 * Beírt szám értelmezése. Elfogadja: „1250”, „1 250”, „1,25”, „1.25”, „1.250,50”, „1250 Ft”.
 * @returns {{ertek: number|null, hibas: boolean}}
 */
function mezoSzam(szoveg) {
  let t = String(szoveg).trim().replace(/\s/g, "").replace(/(ft|huf)$/i, "");
  if (!t) return { ertek: null, hibas: false };
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const ertek = Number(t);
  return Number.isFinite(ertek) ? { ertek, hibas: false } : { ertek: null, hibas: true };
}

/** A blokk pénznemére érvényes eltérési tűrés (forintnál a kerekítés miatt 2 Ft). */
function osszegTures() {
  const penznem = (blokkAllapot?.penznem || "HUF").toUpperCase();
  return penznem === "HUF" ? 2 : 0.01;
}

/** Az űrlap feltöltése a felismert adatokkal és megjelenítése. */
function urlapMegjelenitese(blokk, figyelmeztetesek) {
  blokkAllapot = structuredClone(blokk);

  kisKep.src = elonezetUrl;
  kepNagyitas(false);

  bizalomJelzo.textContent = BIZALOM_FELIRAT[blokk.ocr_bizalom] || "";
  bizalomJelzo.className = "bizalom " + (blokk.ocr_bizalom || "");

  mezoBolt.value = blokk.bolt || "";
  mezoDatum.value = blokk.datum || "";
  mezoFizetes.value = blokk.fizetes_modja || "";
  mezoBrutto.value = szamMezobe(blokk.brutto_vegosszeg);
  mezoAfa.value = szamMezobe(blokk.afa_osszeg);
  blokkUrlap.querySelectorAll("input.hibas").forEach((el) => el.classList.remove("hibas"));

  const penznemJel = blokk.penznem ? `(${blokk.penznem})` : "";
  document.querySelectorAll(".penznem-jel").forEach((el) => (el.textContent = penznemJel));

  // Az összeg-eltérést az űrlap élőben jelzi, ezért azt itt nem ismételjük
  const egyeb = figyelmeztetesek.filter((f) => !f.osszeg);
  figyelmeztetesLista.replaceChildren(
    ...egyeb.map((f) => Object.assign(document.createElement("li"), { textContent: f.szoveg }))
  );
  figyelmeztetesLista.hidden = egyeb.length === 0;

  termekekKirajzolasa();
  mentesInfo.textContent = "";
  mentesEredmenyTorles();
  urlapFrissites();

  elonezetKartya.hidden = true;
  ellenorzesKartya.hidden = false;
  ellenorzesKartya.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** A kis kép nagyítása/kicsinyítése (paraméter nélkül vált). */
function kepNagyitas(nagy) {
  const legyenNagy = typeof nagy === "boolean" ? nagy : !kisKep.classList.contains("nagy");
  kisKep.classList.toggle("nagy", legyenNagy);
  kisKep.closest(".ellenorzes-fej").classList.toggle("nagyitva", legyenNagy);
}

function urlapElrejtese() {
  blokkAllapot = null;
  ellenorzesKartya.hidden = true;
  elonezetKartya.hidden = false;
}

function szamInput(mezo, ertek, cimke) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.dataset.termek = mezo;
  input.dataset.szam = "";
  input.value = szamMezobe(ertek);
  input.setAttribute("aria-label", cimke);
  return input;
}

function cella(osztaly, ...tartalom) {
  const td = document.createElement("td");
  td.className = osztaly;
  td.append(...tartalom);
  return td;
}

/** Egy terméksor elkészítése. */
function termekSor(termek, index) {
  const tr = document.createElement("tr");
  tr.dataset.index = String(index);
  const sorszam = index + 1;

  const nev = document.createElement("input");
  nev.type = "text";
  nev.dataset.termek = "termek_nev";
  nev.value = termek.termek_nev || "";
  nev.setAttribute("aria-label", `${sorszam}. termék neve`);

  const mennyCella = cella("oszlop-menny", szamInput("mennyiseg", termek.mennyiseg, `${sorszam}. termék mennyisége`));
  if (termek.mennyisegi_egyseg) {
    mennyCella.append(Object.assign(document.createElement("span"), {
      className: "egyseg-jel",
      textContent: termek.mennyisegi_egyseg,
    }));
  }

  const kategoria = document.createElement("select");
  kategoria.dataset.termek = "kategoria";
  kategoria.setAttribute("aria-label", `${sorszam}. termék kategóriája`);
  const lista = KATEGORIAK.includes(termek.kategoria) || !termek.kategoria
    ? KATEGORIAK
    : [termek.kategoria, ...KATEGORIAK];
  kategoria.append(...lista.map((k) => new Option(k, k)));
  kategoria.value = termek.kategoria || ALAP_KATEGORIA;

  const torles = document.createElement("button");
  torles.type = "button";
  torles.className = "sor-torles";
  torles.dataset.torles = "";
  torles.textContent = "🗑️";
  torles.title = "Sor törlése";
  torles.setAttribute("aria-label", `${sorszam}. sor törlése`);

  tr.append(
    cella("oszlop-nev", nev),
    cella("oszlop-kat", kategoria),
    mennyCella,
    cella("oszlop-ar", szamInput("egysegar", termek.egysegar, `${sorszam}. termék egységára`)),
    cella("oszlop-resz", szamInput("reszosszeg", termek.reszosszeg, `${sorszam}. termék részösszege`)),
    cella("oszlop-torles", torles)
  );
  return tr;
}

function termekekKirajzolasa() {
  const sorok = blokkAllapot.termekek.map(termekSor);
  if (sorok.length === 0) {
    const tr = document.createElement("tr");
    const td = cella("ures-tabla", "Nincs termék. A „Sor hozzáadása” gombbal vehetsz fel újat.");
    td.colSpan = 6;
    tr.append(td);
    sorok.push(tr);
  }
  termekTorzs.replaceChildren(...sorok);
}

/** Bármely mező változásakor: állapot frissítése és újraszámolás. */
function urlapValtozas(esemeny) {
  const mezo = esemeny.target;
  if (!blokkAllapot || (mezo.tagName !== "INPUT" && mezo.tagName !== "SELECT")) return;

  if (mezo.dataset.mezo) {
    // Fejléc-mezők (bolt, dátum, fizetési mód, bruttó, ÁFA)
    if ("szam" in mezo.dataset) {
      const { ertek, hibas } = mezoSzam(mezo.value);
      mezo.classList.toggle("hibas", hibas);
      blokkAllapot[mezo.dataset.mezo] = ertek;
    } else {
      blokkAllapot[mezo.dataset.mezo] = mezo.value.trim() || null;
    }
  } else if (mezo.dataset.termek) {
    // Terméksor mezői
    const tr = mezo.closest("tr");
    const termek = blokkAllapot.termekek[Number(tr.dataset.index)];
    const kulcs = mezo.dataset.termek;

    if ("szam" in mezo.dataset) {
      const { ertek, hibas } = mezoSzam(mezo.value);
      mezo.classList.toggle("hibas", hibas);
      termek[kulcs] = ertek;

      // Mennyiség vagy egységár módosításakor a részösszeg automatikusan frissül
      if ((kulcs === "mennyiseg" || kulcs === "egysegar") && termek.mennyiseg !== null && termek.egysegar !== null) {
        termek.reszosszeg = kerekit2(termek.mennyiseg * termek.egysegar);
        const reszMezo = tr.querySelector('[data-termek="reszosszeg"]');
        reszMezo.value = szamMezobe(termek.reszosszeg);
        reszMezo.classList.remove("hibas");
      }
    } else {
      termek[kulcs] = mezo.value.trim() || null;
    }
  }

  mentesInfo.textContent = "";
  urlapFrissites();
}

/** Összeg, figyelmeztetés, mentés gomb és fejlesztői JSON frissítése. */
function urlapFrissites() {
  osszegFrissites();
  mentesAllapotFrissites();
  valaszSzoveg.textContent = JSON.stringify(mentendoAdat(), null, 2);
}

function osszegFrissites() {
  const termekek = blokkAllapot.termekek;
  const osszeg = kerekit2(termekek.reduce((s, t) => s + (t.reszosszeg ?? 0), 0));
  const hianyzo = termekek.filter((t) => t.reszosszeg === null).length;
  const brutto = blokkAllapot.brutto_vegosszeg;

  termekOsszeg.textContent = szamFormazas(osszeg);

  const elteres = brutto === null ? 0 : kerekit2(osszeg - brutto);
  const elter = brutto !== null && Math.abs(elteres) > osszegTures();

  if (elter || (brutto !== null && hianyzo > 0)) {
    const penznem = blokkAllapot.penznem ? " " + blokkAllapot.penznem : "";
    let uzenet =
      `⚠️ A termékek összege (${szamFormazas(osszeg)}${penznem}) ` +
      (elter
        ? `eltér a bruttó végösszegtől (${szamFormazas(brutto)}${penznem}), különbség: ${elteres > 0 ? "+" : ""}${szamFormazas(elteres)}${penznem}.`
        : `egyezik a bruttó végösszeggel, de nem minden tételnek van részösszege.`);
    if (hianyzo > 0) uzenet += ` ${hianyzo} tételnél hiányzik a részösszeg.`;
    if (elter) uzenet += " Ellenőrizd a tételeket, a kedvezményeket és a hiányzó sorokat.";
    osszegFigyelmeztetes.textContent = uzenet;
    osszegFigyelmeztetes.hidden = false;
  } else {
    osszegFigyelmeztetes.hidden = true;
  }
}

/** A „Mentés a Sheets-be” gomb csak akkor aktív, ha van bolt, érvényes dátum és bruttó végösszeg. */
function mentesAllapotFrissites() {
  const hianyzik = [];
  if (!blokkAllapot.bolt) hianyzik.push("bolt");
  if (!blokkAllapot.datum || !ervenyesDatum(blokkAllapot.datum)) hianyzik.push("dátum");
  if (blokkAllapot.brutto_vegosszeg === null) hianyzik.push("bruttó végösszeg");
  const hibasMezok = blokkUrlap.querySelectorAll("input.hibas").length;

  mentesGomb.disabled = mentesFolyamatban || hianyzik.length > 0 || hibasMezok > 0;

  if (hianyzik.length) {
    mentesGomb.title = `A mentéshez hiányzik: ${hianyzik.join(", ")}`;
    if (!mentesInfo.textContent) mentesInfo.textContent = `A mentéshez add meg: ${hianyzik.join(", ")}.`;
  } else if (hibasMezok) {
    mentesGomb.title = "Javítsd a hibás számokat";
    if (!mentesInfo.textContent) mentesInfo.textContent = "Javítsd a pirossal jelölt mezőket (nem érvényes szám).";
  } else {
    mentesGomb.title = "";
  }
}

/** A mentésre kész adatok: a teljesen üres terméksorok nélkül. */
function mentendoAdat() {
  if (!blokkAllapot) return null;
  return {
    ...blokkAllapot,
    termekek: blokkAllapot.termekek.filter(
      (t) => t.termek_nev || t.reszosszeg !== null || t.egysegar !== null
    ),
  };
}

function sorHozzaadasa() {
  if (!blokkAllapot) return;
  blokkAllapot.termekek.push({
    termek_nev: null,
    mennyiseg: 1,
    mennyisegi_egyseg: null,
    egysegar: null,
    reszosszeg: null,
    kategoria: ALAP_KATEGORIA,
  });
  termekekKirajzolasa();
  urlapFrissites();
  const ujSor = termekTorzs.lastElementChild;
  ujSor.scrollIntoView({ behavior: "smooth", block: "nearest" });
  ujSor.querySelector('[data-termek="termek_nev"]').focus({ preventScroll: true });
}

function sorTorleseKattintas(esemeny) {
  const gomb = esemeny.target.closest("[data-torles]");
  if (!gomb || !blokkAllapot) return;
  const index = Number(gomb.closest("tr").dataset.index);
  blokkAllapot.termekek.splice(index, 1);
  termekekKirajzolasa();
  urlapFrissites();
}

// --- Mentés a Google Sheets-be (Apps Script Web App) ---

/** Mennyi ideig várunk az Apps Script válaszára (ms). */
const MENTES_IDOKORLAT_MS = 60000;

/** Folyamatban lévő mentés – amíg igaz, a gomb nem nyomható meg újra. */
let mentesFolyamatban = false;

/** Érvényes Apps Script Web App URL-e (…/macros/s/…/exec). */
function ervenyesScriptUrl(url) {
  return /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[A-Za-z0-9_-]+\/exec\/?$/.test(url);
}

/**
 * Egyedi blokkazonosító a blokk tartalmából (SHA-256).
 * Ugyanazzal a módszerrel számol, mint az Apps Script (Code.gs → blokkAzonosito_),
 * így ugyanaz a blokk mindig ugyanazt az azonosítót kapja, és a szerver kiszűri a duplikátumot.
 * Ha a böngésző nem tud SHA-256-ot számolni, null – ekkor a szerver képzi az azonosítót.
 */
async function blokkAzonositoSzamitasa(adat) {
  if (!window.crypto || !crypto.subtle || !adat.datum) return null;
  const normal = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const ujjlenyomat = JSON.stringify([
    adat.datum,
    normal(adat.bolt),
    adat.brutto_vegosszeg,
    adat.termekek.map((t) => [normal(t.termek_nev), t.mennyiseg, t.egysegar, t.reszosszeg]),
  ]);
  try {
    const kivonat = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ujjlenyomat))
    );
    const hex = Array.from(kivonat.slice(0, 6), (b) => b.toString(16).padStart(2, "0")).join("");
    return `B-${adat.datum.replace(/-/g, "")}-${hex.toUpperCase()}`;
  } catch {
    return null;
  }
}

/** Mentési hiba, a felhasználónak szóló üzenettel. */
function mentesiHiba(uzenet, reszletek = [], bizonytalan = false) {
  const hiba = new Error(uzenet);
  hiba.reszletek = reszletek;
  hiba.bizonytalan = bizonytalan; // lehet, hogy a szerver mégis elmentette
  return hiba;
}

/**
 * Egyetlen POST kérés az Apps Script Web App-nak. Szándékosan NINCS automatikus újrapróbálás,
 * hogy ne keletkezzen duplikátum.
 * @returns {Promise<object>} a szerver JSON-válasza (siker: true esetén)
 */
async function kuldesAppsScriptnek(url, adat) {
  const megszakito = new AbortController();
  const idozito = setTimeout(() => megszakito.abort(), MENTES_IDOKORLAT_MS);

  let valasz;
  try {
    valasz = await fetch(url, {
      method: "POST",
      // text/plain: így a böngésző nem küld előzetes (preflight) CORS-kérést,
      // amit az Apps Script nem tud kezelni. A törzs ettől még JSON.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(adat),
      redirect: "follow",
      signal: megszakito.signal,
    });
  } catch (h) {
    if (h.name === "AbortError") {
      throw mentesiHiba(
        `Nem érkezett válasz ${MENTES_IDOKORLAT_MS / 1000} másodpercen belül.`, [], true
      );
    }
    if (navigator.onLine === false) {
      throw mentesiHiba("Nincs internetkapcsolat. Kapcsold be a netet, majd nyomd meg újra a mentést.");
    }
    throw mentesiHiba(
      "Hálózati hiba: nem sikerült elérni az Apps Scriptet.",
      [
        "Ellenőrizd az internetkapcsolatot.",
        "Ellenőrizd, hogy a Beállításokban jó-e a Web App URL (…/exec a vége).",
        "A bevezetésnél a „Ki férhet hozzá” legyen „Bárki”.",
      ],
      true
    );
  } finally {
    clearTimeout(idozito);
  }

  if (valasz.status === 429) {
    throw mentesiHiba(
      "Túl sok kérés (429): a Google átmenetileg korlátozza a mentést. Várj 1–2 percet, majd nyomd meg újra."
    );
  }
  if (valasz.status >= 500) {
    throw mentesiHiba(
      `A Google szervere hibát jelzett (${valasz.status}). Várj egy kicsit, majd próbáld újra.`,
      [],
      true
    );
  }
  if (!valasz.ok) {
    throw mentesiHiba(
      `Az Apps Script hibával válaszolt (HTTP ${valasz.status}).`,
      valasz.status === 401 || valasz.status === 403 || valasz.status === 404
        ? ["Ellenőrizd a Web App URL-t, és hogy a bevezetésnél a hozzáférés „Bárki”."]
        : []
    );
  }

  const szoveg = await valasz.text();
  let json;
  try {
    json = JSON.parse(szoveg);
  } catch {
    console.error("Apps Script nem JSON választ adott:", szoveg.slice(0, 500));
    throw mentesiHiba(
      "Az Apps Script nem a várt választ adta (nem JSON).",
      [
        "Ellenőrizd, hogy a URL a …/exec végű Web App cím-e.",
        "A bevezetésnél a „Ki férhet hozzá” legyen „Bárki”.",
        "Kódmódosítás után új verziót kell bevezetni (Bevezetések kezelése → ✏️ → Új verzió).",
      ],
      true
    );
  }

  console.log("Apps Script válasz:", json);

  if (!json || json.siker !== true) {
    throw mentesiHiba(json?.uzenet || "Ismeretlen hiba történt a mentéskor.", json?.reszletek || []);
  }
  return json;
}

/** Eredmény/hiba megjelenítése a mentés gomb alatt. */
function mentesEredmenyBeallitas(szoveg, tipus, reszletek = []) {
  mentesEredmeny.replaceChildren(document.createTextNode(szoveg));
  if (reszletek.length) {
    const lista = document.createElement("ul");
    reszletek.forEach((r) => lista.append(Object.assign(document.createElement("li"), { textContent: r })));
    mentesEredmeny.append(lista);
  }
  mentesEredmeny.className = "allapot mentes-eredmeny " + tipus;
  mentesEredmeny.hidden = false;
}

function mentesEredmenyTorles() {
  mentesEredmeny.hidden = true;
  mentesEredmeny.replaceChildren();
}

/** Sikeres mentés után: az űrlap és a kiválasztott kép törlése, készen a következő blokkra. */
function urlapTorlese() {
  urlapElrejtese();
  mentesEredmenyTorles();
  if (elonezetUrl) URL.revokeObjectURL(elonezetUrl);
  elonezetUrl = null;
  kivalasztottFajl = null;
  elonezetKep.removeAttribute("src");
  elonezetKep.hidden = true;
  kisKep.removeAttribute("src");
  elonezetUres.textContent = "Még nincs kiválasztott kép.";
  elonezetUres.hidden = false;
  fajlInfo.textContent = "";
  elemzesGomb.disabled = true;
  blokkUrlap.reset();
  termekTorzs.replaceChildren();
  valaszSzoveg.textContent = "";
}

/** „Mentés a Sheets-be” gomb. */
async function mentesSheetsbe(esemeny) {
  esemeny.preventDefault();
  if (mentesFolyamatban) return; // dupla koppintás ellen
  mentesAllapotFrissites();
  if (mentesGomb.disabled) return;

  const cfg = getConfig();
  if (!cfg.APPS_SCRIPT_URL) {
    mentesEredmenyBeallitas(
      "Még nincs megadva az Apps Script Web App URL. Add meg lent a ⚙️ Beállításokban.",
      "figyelem"
    );
    beallitasok.open = true;
    scriptUrlMezo.focus();
    return;
  }

  const kuldottBlokk = blokkAllapot;
  const adat = mentendoAdat();
  const blokkAzonosito = await blokkAzonositoSzamitasa(adat);
  const kuldendo = { ...adat };
  if (blokkAzonosito) kuldendo.blokk_azonosito = blokkAzonosito;
  if (cfg.API_TOKEN) kuldendo.token = cfg.API_TOKEN;

  console.log("Mentés az Apps Scriptbe:", { ...kuldendo, token: kuldendo.token ? "***" : undefined });

  mentesFolyamatban = true;
  const eredetiFelirat = mentesGomb.textContent;
  mentesGomb.disabled = true;
  mentesGomb.textContent = "⏳ Mentés folyamatban…";
  mentesInfo.textContent = "";
  mentesEredmenyBeallitas("Mentés folyamatban, várj a válaszra…", "info");

  try {
    const json = await kuldesAppsScriptnek(cfg.APPS_SCRIPT_URL, kuldendo);

    // Ha mentés közben a felhasználó már új blokkot választott, azt ne töröljük
    if (blokkAllapot === kuldottBlokk) urlapTorlese();

    if (json.duplikalt) {
      allapotBeallitas(
        `Ez a blokk már korábban mentve volt (${json.blokk_azonosito}), ezért nem került be újra. ` +
          "Jöhet a következő blokk.",
        "figyelem"
      );
    } else {
      allapotBeallitas(
        `✅ Sikeresen mentve: ${json.mentett_sorok} sor a táblázatba (${json.blokk_azonosito}). ` +
          "Jöhet a következő blokk.",
        "siker"
      );
    }
    allapot.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (hiba) {
    console.error("Mentési hiba:", hiba);
    const reszletek = [...(hiba.reszletek || [])];
    if (hiba.bizonytalan) {
      reszletek.push(
        "Lehet, hogy a mentés mégis megtörtént – nézd meg a táblázatot. Ha nincs benne, nyomd meg újra " +
          "a mentést: ugyanazt a blokkot a rendszer nem írja be kétszer."
      );
    }
    mentesEredmenyBeallitas("❌ Mentés sikertelen: " + hiba.message, "hiba", reszletek);
    allapotBeallitas("A mentés nem sikerült – a részleteket lent, a mentés gomb alatt látod.", "hiba");
  } finally {
    mentesFolyamatban = false;
    mentesGomb.textContent = eredetiFelirat;
    if (blokkAllapot) mentesAllapotFrissites();
  }
}

/** Elemzés gomb kezelése. */
async function elemzes() {
  if (!kivalasztottFajl) {
    allapotBeallitas("Először válassz ki egy képet.", "figyelem");
    return;
  }

  const hianyzik = konfigHiba();
  if (hianyzik) {
    allapotBeallitas(hianyzik, "figyelem");
    beallitasok.open = true;
    kulcsMezo.focus();
    return;
  }

  elemzesGomb.disabled = true;
  allapotBeallitas("Elemzés folyamatban… (Gemini)", "info");

  try {
    const { blokk, figyelmeztetesek, modell, tartalek } = await sendToGemini(
      kivalasztottFajl,
      (szoveg) => allapotBeallitas(szoveg, "figyelem")
    );
    urlapMegjelenitese(blokk, figyelmeztetesek);

    const tetelSzam = blokk.termekek.length;
    const tartalekMegj = tartalek ? ` (A tartalék modell – ${modell} – végezte az elemzést.)` : "";
    if (blokk.ocr_bizalom === "alacsony" || figyelmeztetesek.length) {
      allapotBeallitas(
        `Elemzés kész (${tetelSzam} tétel), de a kiolvasás bizonytalan – ellenőrizd az adatokat lent!${tartalekMegj}`,
        "figyelem"
      );
    } else {
      allapotBeallitas(`Elemzés kész: ${tetelSzam} tétel. Ellenőrizd az adatokat lent.${tartalekMegj}`, "siker");
    }
  } catch (hiba) {
    console.error(hiba);
    allapotBeallitas("❌ " + hiba.message, "hiba");
  } finally {
    elemzesGomb.disabled = false;
  }
}

// --- Eseménykezelők ---
kameraInput.addEventListener("change", inputValtozas);
feltoltesInput.addEventListener("change", inputValtozas);
elemzesGomb.addEventListener("click", elemzes);
elonezetKep.addEventListener("error", elonezetHiba);

blokkUrlap.addEventListener("input", urlapValtozas);
blokkUrlap.addEventListener("change", urlapValtozas);
blokkUrlap.addEventListener("submit", mentesSheetsbe);
sorHozzaadas.addEventListener("click", sorHozzaadasa);
termekTorzs.addEventListener("click", sorTorleseKattintas);
kisKep.addEventListener("click", kepNagyitas);

// Jelzés az index.html-nek, hogy a szkript betöltődött
window.BLOKK_APP_BETOLTVE = true;

// Induláskor jelezzük, ha hiányzik a beállítás
beallitasForm.addEventListener("submit", beallitasokMentese);
kulcsTorles.addEventListener("click", kulcsTorlese);
kulcsMutat.addEventListener("change", () => {
  kulcsMezo.type = kulcsMutat.checked ? "text" : "password";
  tokenMezo.type = kulcsMutat.checked ? "text" : "password";
});

beallitasokBetoltese();
const indulasiHiba = konfigHiba();
if (indulasiHiba) {
  allapotBeallitas(indulasiHiba, "figyelem");
  beallitasok.open = true;
}
