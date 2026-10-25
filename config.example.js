// Blokk-nyilvántartó – konfigurációs minta
//
// Használat:
//   1. Másold le ezt a fájlt config.js néven (ugyanebbe a mappába).
//   2. Töltsd ki a saját adataiddal.
//   3. A config.js-t SOHA ne töltsd fel nyilvános helyre (benne van a .gitignore-ban).

window.APP_CONFIG = {
  // Google AI Studio-ban létrehozott API kulcs
  GEMINI_API_KEY: "IDE_JON_A_GEMINI_API_KULCSOD",

  // Gemini Flash modell neve.
  // Alternatíva: "gemini-flash-latest" – mindig a legújabb Flash modellre mutat.
  GEMINI_MODEL: "gemini-3.6-flash",

  // Google Apps Script Web App URL (a Sheets-mentéshez – később használjuk)
  APPS_SCRIPT_URL: "IDE_JON_AZ_APPS_SCRIPT_WEB_APP_URL",
};
