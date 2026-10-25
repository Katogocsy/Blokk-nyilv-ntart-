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
const valaszDoboz = document.getElementById("valaszDoboz");
const valaszSzoveg = document.getElementById("valaszSzoveg");
const figyelmeztetesLista = document.getElementById("figyelmeztetesLista");

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
 * @returns {string[]} figyelmeztetések a felhasználónak
 */
function blokkEllenorzese(blokk) {
  const figyelmeztetesek = [];

  if (blokk.datum !== null && !ervenyesDatum(blokk.datum)) {
    figyelmeztetesek.push(`A dátum („${blokk.datum}”) nem YYYY-MM-DD formátumú, ezért null lett.`);
    blokk.datum = null;
  }

  const reszek = blokk.termekek.map((t) => t.reszosszeg);
  const hianyzoResz = reszek.some((r) => r === null);
  const osszeg = Math.round(reszek.reduce((s, r) => s + (r || 0), 0) * 100) / 100;

  if (blokk.brutto_vegosszeg === null) {
    figyelmeztetesek.push("A bruttó végösszeg nem olvasható, az összegek nem ellenőrizhetők.");
  } else if (blokk.termekek.length === 0) {
    figyelmeztetesek.push("Nem sikerült termékeket kiolvasni.");
    blokk.ocr_bizalom = "alacsony";
  } else {
    // Közelítő egyezés: 1% vagy legalább 5 egység eltérés (pl. kerekítés miatt) elfogadható
    const tures = Math.max(5, Math.abs(blokk.brutto_vegosszeg) * 0.01);
    const elteres = Math.abs(osszeg - blokk.brutto_vegosszeg);
    if (hianyzoResz || elteres > tures) {
      const ok = hianyzoResz ? "néhány tétel részösszege hiányzik" : `eltérés: ${elteres}`;
      figyelmeztetesek.push(
        `A tételek összege (${osszeg}) nem egyezik a bruttó végösszeggel (${blokk.brutto_vegosszeg}) – ${ok}.`
      );
      blokk.ocr_bizalom = "alacsony";
    }
  }

  return figyelmeztetesek;
}

/**
 * Kép elküldése a Gemini Flash API-nak, strukturált JSON-választ kérve.
 * A nyers választ a konzolra írja; hibánál kivételt dob.
 * @param {File} imageFile
 * @returns {Promise<{nyers: object, blokk: object, figyelmeztetesek: string[]}>}
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
  valaszDoboz.hidden = true;
  allapotBeallitas("Elemzés folyamatban… (Gemini)", "info");

  try {
    const { blokk, figyelmeztetesek } = await sendToGemini(kivalasztottFajl);

    // Ideiglenes megjelenítés ellenőrzéshez
    valaszSzoveg.textContent = JSON.stringify(blokk, null, 2);
    figyelmeztetesLista.replaceChildren(
      ...figyelmeztetesek.map((f) => Object.assign(document.createElement("li"), { textContent: f }))
    );
    figyelmeztetesLista.hidden = figyelmeztetesek.length === 0;
    valaszDoboz.hidden = false;

    const tetelSzam = blokk.termekek.length;
    if (blokk.ocr_bizalom === "alacsony" || figyelmeztetesek.length) {
      allapotBeallitas(
        `Elemzés kész (${tetelSzam} tétel), de a kiolvasás bizonytalan – ellenőrizd az adatokat!`,
        "figyelem"
      );
    } else {
      allapotBeallitas(`Elemzés kész: ${tetelSzam} tétel, OCR-bizalom: ${blokk.ocr_bizalom}.`, "siker");
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
