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

// --- Konfiguráció ---
// Elsőbbség: a telefonon mentett beállítás, utána a (helyi) config.js, végül az alapérték.
const GEMINI_API_ALAP = "https://generativelanguage.googleapis.com/v1beta/models";
const ALAP_MODELL = "gemini-3.6-flash";
const TAROLO_KULCS = "blokk.geminiApiKey";
const TAROLO_MODELL = "blokk.geminiModel";

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
    APPS_SCRIPT_URL: ervenyesErtek(fajlbol.APPS_SCRIPT_URL),
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
}

function beallitasokMentese(esemeny) {
  esemeny.preventDefault();
  const kulcs = kulcsMezo.value.trim();
  const modell = modellMezo.value.trim();

  if (!kulcs) {
    allapotBeallitas("Add meg az API kulcsot a mentéshez.", "figyelem");
    kulcsMezo.focus();
    return;
  }

  const sikerult =
    taroloIr(TAROLO_KULCS, kulcs) &&
    taroloIr(TAROLO_MODELL, modell && modell !== ALAP_MODELL ? modell : "");

  if (!sikerult) {
    allapotBeallitas(
      "Nem sikerült menteni. A böngésző tiltja a tárolást (pl. privát/inkognitó mód).",
      "hiba"
    );
    return;
  }

  kulcsMutat.checked = false;
  kulcsMezo.type = "password";
  beallitasok.open = false;
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
        },
        required: ["termek_nev", "mennyiseg", "mennyisegi_egyseg", "egysegar", "reszosszeg"],
        propertyOrdering: ["termek_nev", "mennyiseg", "mennyisegi_egyseg", "egysegar", "reszosszeg"],
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
      "reszosszeg": number | null           // a tétel sorának végösszege
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
- Ha a termékek "reszosszeg" értékeinek összege nem egyezik közelítőleg a "brutto_vegosszeg"-gel, az "ocr_bizalom" legyen "alacsony".`;

/** Egy Gemini-kérés elküldése; hibánál kivételt dob, sikernél a nyers választ adja vissza. */
async function geminiKeres(keres) {
  const cfg = getConfig();
  const url = `${GEMINI_API_ALAP}/${encodeURIComponent(cfg.GEMINI_MODEL)}:generateContent`;

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
    throw new Error("Nem sikerült elérni a Gemini szervert. Ellenőrizd az internetkapcsolatot.");
  }

  const adat = await valasz.json().catch(() => null);
  console.log("Gemini nyers válasz:", adat);

  if (!valasz.ok) {
    const uzenet = adat?.error?.message || `HTTP ${valasz.status}`;
    console.error("Gemini hiba:", valasz.status, adat);
    const hiba = new Error(`A Gemini hívás sikertelen (${valasz.status}): ${uzenet}`);
    hiba.status = valasz.status;
    hiba.apiUzenet = uzenet;
    throw hiba;
  }

  return adat;
}

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

/**
 * Kép elküldése a Gemini Flash API-nak, strukturált JSON-választ kérve.
 * A nyers választ a konzolra írja; hibánál kivételt dob.
 * @param {File} imageFile
 * @returns {Promise<{nyers: object, blokk: object, figyelmeztetesek: {szoveg: string, osszeg?: boolean}[]}>}
 */
async function sendToGemini(imageFile) {
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

  let nyers;
  try {
    nyers = await geminiKeres({
      contents: tartalom,
      generationConfig: { responseMimeType: "application/json", responseSchema: BLOKK_SEMA },
    });
  } catch (h) {
    // Ha a modell/API a sémát nem fogadja el, sima JSON-módban próbáljuk újra
    // (a mezőket az utasítás így is pontosan leírja).
    const semaHiba = h.status === 400 && /schema|responseSchema|Unknown name|Invalid JSON payload/i.test(h.apiUzenet || "");
    if (!semaHiba) throw h;
    console.warn("A séma nem lett elfogadva, újrapróbálás sima JSON-módban:", h.apiUzenet);
    nyers = await geminiKeres({
      contents: tartalom,
      generationConfig: { responseMimeType: "application/json" },
    });
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

  return { nyers, blokk, figyelmeztetesek };
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
  urlapFrissites();
  mentesInfo.textContent = "";

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

  const torles = document.createElement("button");
  torles.type = "button";
  torles.className = "sor-torles";
  torles.dataset.torles = "";
  torles.textContent = "🗑️";
  torles.title = "Sor törlése";
  torles.setAttribute("aria-label", `${sorszam}. sor törlése`);

  tr.append(
    cella("oszlop-nev", nev),
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
    td.colSpan = 5;
    tr.append(td);
    sorok.push(tr);
  }
  termekTorzs.replaceChildren(...sorok);
}

/** Bármely mező változásakor: állapot frissítése és újraszámolás. */
function urlapValtozas(esemeny) {
  const mezo = esemeny.target;
  if (!blokkAllapot || mezo.tagName !== "INPUT") return;

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

  mentesGomb.disabled = hianyzik.length > 0 || hibasMezok > 0;

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

/** Mentés – a Sheets-integráció a következő lépésben kerül ide. */
function mentesSheetsbe(esemeny) {
  esemeny.preventDefault();
  mentesAllapotFrissites();
  if (mentesGomb.disabled) return;

  const adat = mentendoAdat();
  console.log("Mentésre kész adatok:", adat);
  // TODO: elküldés az Apps Script Web App-nak (APPS_SCRIPT_URL)
  mentesInfo.textContent =
    "✅ Az adatok rendben vannak. A Google Sheets-mentés a következő lépésben kerül bekötésre.";
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
    const { blokk, figyelmeztetesek } = await sendToGemini(kivalasztottFajl);
    urlapMegjelenitese(blokk, figyelmeztetesek);

    const tetelSzam = blokk.termekek.length;
    if (blokk.ocr_bizalom === "alacsony" || figyelmeztetesek.length) {
      allapotBeallitas(
        `Elemzés kész (${tetelSzam} tétel), de a kiolvasás bizonytalan – ellenőrizd az adatokat lent!`,
        "figyelem"
      );
    } else {
      allapotBeallitas(`Elemzés kész: ${tetelSzam} tétel. Ellenőrizd az adatokat lent.`, "siker");
    }
  } catch (hiba) {
    console.error(hiba);
    allapotBeallitas("Hiba: " + hiba.message, "hiba");
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
});

beallitasokBetoltese();
const indulasiHiba = konfigHiba();
if (indulasiHiba) {
  allapotBeallitas(indulasiHiba, "figyelem");
  beallitasok.open = true;
}
