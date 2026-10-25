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

/**
 * Kép elküldése a Gemini Flash API-nak.
 * Egyelőre egyszerű szöveges választ kér, és a nyers választ a konzolra írja.
 * @param {File} imageFile
 * @returns {Promise<object>} a Gemini nyers JSON válasza
 */
async function sendToGemini(imageFile) {
  const hiba = konfigHiba();
  if (hiba) throw new Error(hiba);

  const base64 = await fajlBase64Re(imageFile);

  const keres = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: kepTipus(imageFile) || "image/jpeg",
              data: base64,
            },
          },
          {
            text:
              "Ez egy magyar bevásárlási blokk fényképe. " +
              "Olvasd ki és írd le a tartalmát: bolt neve, dátum, tételek árral, végösszeg.",
          },
        ],
      },
    ],
  };

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
    throw new Error(`A Gemini hívás sikertelen (${valasz.status}): ${uzenet}`);
  }

  const szoveg = adat?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();

  if (szoveg) {
    console.log("Gemini szöveges válasz:\n" + szoveg);
  } else {
    console.warn("A Gemini nem adott szöveges választ.", adat?.promptFeedback);
  }

  return adat;
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
    const adat = await sendToGemini(kivalasztottFajl);
    const szoveg = adat?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim();
    valaszSzoveg.textContent = szoveg || "(Nem érkezett szöveges válasz.)";
    valaszDoboz.hidden = false;
    allapotBeallitas(
      "Az elemzés kész. A teljes nyers válasz a böngésző konzoljában is megtalálható.",
      "siker"
    );
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
