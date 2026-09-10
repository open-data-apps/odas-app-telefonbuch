/*
 * Diese Funktion ist für die Inhalte der Startseite
 * zuständig.
 *
 * @param {Object} configdata - Alle Konfigurationsdaten der App
 * @returns {string} - darzustellendes HTML
 */

let tbInstanzZaehler = 0;

// Laufzeit-Cleanups pro App-Instanz, je DOM-Container registriert. onPageLeave
// iteriert alle registrierten Cleanups (try/catch) und leert die Registry
// anschliessend — die app/app-base.js ruft onPageLeave beim Seitenwechsel auf.
const tbCleanups = new Map();

function onPageLeave() {
  tbCleanups.forEach((cleanup) => {
    try {
      cleanup();
    } catch (_err) {
      // Ein einzelner Cleanup darf den Seitenwechsel nicht blockieren.
    }
  });
  tbCleanups.clear();
}

function escapeHtml(str) {
  const s = String(str ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isOdasProxyEnabled(configdata = {}) {
  return String(configdata.proxyAktiv || "").trim().toLowerCase() === "ja";
}

// Kanonischer Portfolio-Helper (helpercheck-Vertrag: Anwesenheit + Verhalten).
// Wird app-intern nicht direkt aufgerufen, bleibt aber Bestandteil der
// Proxy-Helfer-Familie.
function extractPathFromUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname + parsedUrl.search;
  } catch (_error) {
    return String(url || "");
  }
}

function getOdasAppBasePath(pathname) {
  let appPath =
    pathname === undefined
      ? typeof window !== "undefined"
        ? window.location.pathname
        : "/"
      : String(pathname || "/");

  if (!appPath.endsWith("/")) {
    const lastSlashIndex = appPath.lastIndexOf("/");
    const lastSegment = appPath.substring(lastSlashIndex + 1);
    if (lastSegment.includes(".")) {
      appPath = appPath.substring(0, lastSlashIndex + 1);
    }
  }

  return appPath.replace(/\/+$/, "");
}

function getOdasProxyEndpoint(targetUrl, pathname) {
  const appPath = getOdasAppBasePath(pathname);
  return `${appPath}/odp-data?path=${encodeURIComponent(targetUrl)}`;
}

async function fetchViaOdasProxy(targetUrl, options = {}) {
  if (typeof isKeineDatenquelleKonfiguriert === "function" && isKeineDatenquelleKonfiguriert(targetUrl)) {
    throw new Error("Keine Datenquelle konfiguriert.");
  } else if (typeof isKeineDatenquelleKonfiguriert !== "function") {
    const v = String(targetUrl || "").trim();
    if (!v || /^\{\{.*\}\}$/.test(v) || /^<.*>$/.test(v)) throw new Error("Keine Datenquelle konfiguriert.");
  }

  const response = await fetch(getOdasProxyEndpoint(targetUrl), {
    method: "POST",
    signal: options && options.signal ? options.signal : undefined,
  });

  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch (_e) {}
    const originHint = /origin not allowed/i.test(body) ? " – URL origin not allowed" : "";
    throw new Error(`ODAS-Proxy-Fehler: HTTP ${response.status}${originHint}`);
  }

  const proxyData = await response.json();
  if (!proxyData || typeof proxyData.content !== "string") {
    throw new Error("ODAS-Proxy-Antwort enthält keinen content-String.");
  }

  return proxyData.content;
}

async function fetchOdasResource(targetUrl, configdata = {}) {
  if (isOdasProxyEnabled(configdata)) {
    return fetchViaOdasProxy(targetUrl);
  }

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
  } catch (error) {
    throw new Error(
      `Direkter Datenabruf fehlgeschlagen (${error.message}). Bitte prüfen Sie die Daten-URL und die CORS-Freigabe der Datenquelle.`,
    );
  }
}

/**
 * Löst eine benannte Datenressource aus configdata.apiurls auf.
 * Neue apiurls-Form (typ: "array"); das frühere skalare apiurl wird nicht mehr gelesen.
 * @returns {string} getrimmte URL, oder "" für den Zustand "keine Quelle konfiguriert"
 */
function getOdasApiUrl(configdata, name) {
  const liste = Array.isArray(configdata && configdata.apiurls) ? configdata.apiurls : [];
  const treffer = liste.find((eintrag) => eintrag && eintrag.name === name);
  return String((treffer && treffer.url) || "").trim();
}

async function fetchOdasJson(targetUrl, configdata = {}) {
  const rawContent = await fetchOdasResource(targetUrl, configdata);
  try {
    return JSON.parse(rawContent);
  } catch (_error) {
    throw new Error(
      `Die konfigurierte Daten-URL liefert kein JSON, sondern ${describeNonJsonPayload(rawContent)}. ` +
        "Bitte in der Instanzkonfiguration den API-Endpunkt der Datenquelle eintragen, " +
        "nicht den Datensatz- oder Download-Link.",
    );
  }
}

function describeNonJsonPayload(rawContent) {
  const text = String(rawContent == null ? "" : rawContent).trim();
  if (!text) return "eine leere Antwort";
  if (text.startsWith("<")) return "eine HTML-Seite";
  const firstLine = text.split(/\r?\n/, 1)[0];
  if (/[,;]/.test(firstLine)) return "eine CSV- oder Textdatei";
  return "unlesbaren Inhalt";
}

// ── DYNAMISCHE VENDOR-LOADER ───────────────────────────────────────────────
// jQuery + DataTables kommen aus app/vendor/ und werden erst bei Bedarf
// geladen — keine statischen Bibliotheks-Tags in app/index.html
// (Template-Konformität). data-fertig markiert abgeschlossene Ladevorgänge,
// damit nebenläufige Instanzen denselben Script-Tag mitbenutzen können.
function ladeVendorSkript(id, src) {
  return new Promise((resolve, reject) => {
    const fehler = () => reject(new Error("Bibliothek konnte nicht geladen werden: " + src));
    const vorhanden = document.getElementById(id);
    if (vorhanden) {
      if (vorhanden.dataset && vorhanden.dataset.fertig === "1") {
        resolve();
        return;
      }
      vorhanden.addEventListener("load", () => resolve());
      vorhanden.addEventListener("error", fehler);
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.onload = () => {
      script.dataset.fertig = "1";
      resolve();
    };
    script.onerror = fehler;
    document.head.appendChild(script);
  });
}

function tbLadeDatatablesPlugin() {
  return ladeVendorSkript("tb-datatables-script", "vendor/datatables/jquery.dataTables.min.js").then(() => {
    const jq = window.jQuery || window.$;
    if (!jq || !jq.fn || !jq.fn.DataTable) {
      throw new Error("DataTables konnte nicht geladen werden.");
    }
    if (!document.getElementById("tb-datatables-css")) {
      const link = document.createElement("link");
      link.id = "tb-datatables-css";
      link.rel = "stylesheet";
      link.href = "vendor/datatables/jquery.dataTables.min.css";
      document.head.appendChild(link);
    }
  });
}

function ensureJqueryDataTables() {
  const jq = window.jQuery || window.$;
  if (typeof jq !== "function") {
    // Kein jQuery vorhanden (Normalfall nach Entfernung der statischen Tags):
    // volle Kette aus app/vendor/ laden.
    return ladeVendorSkript("tb-jquery-script", "vendor/jquery/jquery.min.js")
      .then(() => {
        if (typeof window.jQuery !== "function" && typeof window.$ !== "function") {
          throw new Error("jQuery konnte nicht geladen werden.");
        }
        return tbLadeDatatablesPlugin();
      });
  }
  if (jq.fn && !jq.fn.DataTable) {
    // Echtes Host-jQuery ohne Plugin (z. B. ODAS-Store) — nur Plugin nachladen.
    return tbLadeDatatablesPlugin();
  }
  // Bereits vollständig (dynamisch geladen) oder Test-Stub ohne .fn — der
  // nachfolgende $(...).DataTable(...)-Aufruf entscheidet.
  return Promise.resolve();
}

// ── DATENNORMALISIERUNG (CSV + JSON, Header-Mapping) ───────────────────────
// Spalten werden per Kopfzeilennamen zugeordnet (exakter Treffer,
// kleingeschrieben); positional 0/1/2 ist nur Fallback für kopflose Dateien.
const TB_ALIAS_NAME = ["name", "kontakt", "person", "mitarbeiter", "ansprechpartner", "contact", "fullname", "full name", "displayname", "display name"];
const TB_ALIAS_VORNAME = ["vorname", "first name", "firstname", "given name"];
const TB_ALIAS_NACHNAME = ["nachname", "last name", "lastname", "family name", "surname"];
const TB_ALIAS_STELLE = ["stelle", "position", "funktion", "abteilung", "department", "division", "bereich", "amt", "referat", "rolle", "team", "office", "unit"];
const TB_ALIAS_TELEFON = ["telefon", "telefonnummer", "tel", "phone", "telephone", "mobile", "cell", "rufnummer", "durchwahl", "nummer", "handy", "phone number", "phonenumber"];

function tbFindeSpaltenIndex(kopf, aliase, fallback) {
  const normiert = (kopf || []).map((h) => String(h == null ? "" : h).trim().toLowerCase());
  for (const alias of aliase) {
    const idx = normiert.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return fallback;
}

function tbLeseJsonFeld(objekt, aliase) {
  if (!objekt || typeof objekt !== "object") return "";
  const schluessel = Object.create(null);
  Object.keys(objekt).forEach((k) => {
    schluessel[String(k).trim().toLowerCase()] = k;
  });
  for (const alias of aliase) {
    if (schluessel[alias] !== undefined) {
      const wert = objekt[schluessel[alias]];
      return String(wert == null ? "" : wert).trim();
    }
  }
  return "";
}

function tbNormalisiereJsonEintrag(eintrag) {
  if (!eintrag || typeof eintrag !== "object") return null;
  let name = tbLeseJsonFeld(eintrag, TB_ALIAS_NAME);
  if (!name) {
    // Getrennte Vor-/Nachname-Felder zu „Vorname Nachname" kombinieren.
    name = [tbLeseJsonFeld(eintrag, TB_ALIAS_VORNAME), tbLeseJsonFeld(eintrag, TB_ALIAS_NACHNAME)]
      .filter(Boolean)
      .join(" ");
  }
  if (!name) return null;
  return {
    name,
    stelle: tbLeseJsonFeld(eintrag, TB_ALIAS_STELLE),
    telefon: tbLeseJsonFeld(eintrag, TB_ALIAS_TELEFON),
  };
}

// Eine Spalte lesen: Treffer per Kopfzeile, sonst positional nur wenn gar kein
// Kopfalias gegriffen hat (kopflose Datei, altes Verhalten 0/1/2).
function tbHoleSpalte(colsArr, idx, fallbackIdx, hatKopf) {
  if (idx >= 0) return String(colsArr[idx] == null ? "" : colsArr[idx]).trim();
  if (!hatKopf && fallbackIdx >= 0) {
    return String(colsArr[fallbackIdx] == null ? "" : colsArr[fallbackIdx]).trim();
  }
  return "";
}

// Liefert { kopf, eintraege }: JSON-Arrays (Objekte) und CSV-Texte werden auf
// dieselbe Eintragsform { name, stelle, telefon } abgebildet. Ungeparstes
// fällt auf CSV zurück (nicht umgekehrt), damit kein valider CSV-Text als
// kaputtes JSON fehlschlägt.
function tbNormalisiereDatensaetze(rohtext) {
  const text = String(rohtext == null ? "" : rohtext);
  const getrimmt = text.trim();
  if (getrimmt.startsWith("{") || getrimmt.startsWith("[")) {
    try {
      const json = JSON.parse(getrimmt);
      const liste = Array.isArray(json)
        ? json
        : json.records || json.results || (json.result && json.result.records) || json.data || null;
      if (Array.isArray(liste)) {
        const eintraege = liste.map(tbNormalisiereJsonEintrag).filter(Boolean);
        return { kopf: [], eintraege, uebersprungen: liste.length - eintraege.length };
      }
    } catch (_e) {
      // Kein valides JSON — unten als CSV weiter parsen.
    }
  }
  const rows = parseCsv(text);
  const kopf = rows.length > 0 ? rows[0] : [];
  const idxName = tbFindeSpaltenIndex(kopf, TB_ALIAS_NAME, -1);
  const idxVn = tbFindeSpaltenIndex(kopf, TB_ALIAS_VORNAME, -1);
  const idxNn = tbFindeSpaltenIndex(kopf, TB_ALIAS_NACHNAME, -1);
  const idxStelle = tbFindeSpaltenIndex(kopf, TB_ALIAS_STELLE, -1);
  const idxTelefon = tbFindeSpaltenIndex(kopf, TB_ALIAS_TELEFON, -1);
  const hatKopf = idxName >= 0 || idxVn >= 0 || idxNn >= 0 || idxStelle >= 0 || idxTelefon >= 0;
  const eintraege = [];
  let uebersprungen = 0;
  rows.slice(1).forEach((cols) => {
    const colsArr = Array.isArray(cols) ? cols : [];
    let name = tbHoleSpalte(colsArr, idxName, 0, hatKopf);
    if (!name && (idxVn >= 0 || idxNn >= 0)) {
      name = [tbHoleSpalte(colsArr, idxVn, -1, true), tbHoleSpalte(colsArr, idxNn, -1, true)]
        .filter(Boolean)
        .join(" ");
    }
    if (name === "") {
      uebersprungen++;
      return;
    }
    eintraege.push({
      name,
      stelle: tbHoleSpalte(colsArr, idxStelle, 1, hatKopf),
      telefon: tbHoleSpalte(colsArr, idxTelefon, 2, hatKopf),
    });
  });
  return { kopf, eintraege, uebersprungen };
}

// B3: Anzeige bleibt Rohtext, aber das tel:-Href enthält nur + und Ziffern —
// Leerzeichen, Slashes & Co. brechen Click-to-Call auf Mobilgeräten.
function tbNormalisiereTelHref(telefon) {
  return "tel:" + String(telefon || "").trim().replace(/[^+\d]/g, "");
}

function tbEscapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── DOWNLOADS (vCard, CSV-Export) ──────────────────────────────────────────
function tbLadeDateiHerunter(dateiname, inhalt, mimeTyp) {
  const blob = new Blob([inhalt], { type: mimeTyp + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function tbEscapeVcard(text) {
  return String(text == null ? "" : text).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function tbBaueVcard(eintrag) {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:" + tbEscapeVcard(eintrag.name),
    "N:" + tbEscapeVcard(eintrag.name) + ";;;;",
    eintrag.stelle ? "ORG:" + tbEscapeVcard(eintrag.stelle) : null,
    eintrag.telefon ? "TEL;TYPE=WORK,VOICE:" + tbEscapeVcard(eintrag.telefon) : null,
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function tbEscapeCsvFeld(text) {
  const s = String(text == null ? "" : text);
  return /[";,\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const TYP_BEZEICHNUNG = {
  "ckan-dkan-ds": "Tabellen-API mit Daten-ID",
  "ckan-ps": "Datensatz-API",
  "ckan-dl": "Datei-Download",
  "ods21": "Open-Data-Suche (API v2.1)",
  "wfs": "Kartendienst (WFS)",
  "sparql": "Wissensdatenbank (SPARQL)",
  "csv-zip": "Statische Datei"
};

function validateUrlTypErwartung(url, erwarteterTyp) {
  const u = String(url || "");
  if (!erwarteterTyp || isKeineDatenquelleKonfiguriert(u)) return null;
  const checks = {
    "ckan-dkan-ds": /\/api\/3\/action\/datastore_search\?resource_id=/i,
    "ckan-ps": /\/api\/3\/action\/package_show\?id=/i,
    "ckan-dl": /\/dataset\/.*\/resource\/.*\/download\//i,
    "ods21": /\/api\/explore\/v2\.1\//i,
    "wfs": /service=WFS/i,
    "sparql": /\/api\/ts\/v1\/kg\/sparql/i,
    "csv-zip": /\.(csv|json|zip)(\?|$)/i
  };
  const re = checks[erwarteterTyp];
  if (!re) return null;
  if (!re.test(u)) {
    const soll = TYP_BEZEICHNUNG[erwarteterTyp] || erwarteterTyp;
    return `Typ passt nicht: erwartet „${soll}", erhalten „${u.slice(0, 60)}…". Prüfen Sie den Hilfe-Tooltip bei „URLs zu Datenressourcen".`;
  }
  return null;
}

function classifyOdasFehler(error, kontext = {}) {
  const msg = String((error && error.message) || error || "");
  const url = String(kontext.url || "");
  const label = String(kontext.label || "Datenressource");
  const typLabel = String(kontext.typLabel || TYP_BEZEICHNUNG[kontext.erwarteterTyp] || "Datenquelle");
  if (/Keine Datenquelle konfiguriert/i.test(msg) || isKeineDatenquelleKonfiguriert(url)) {
    return {
      kind: "KEINE_QUELLE",
      titel: "Es ist keine Datenquelle konfiguriert.",
      hinweis: `Prüfen Sie unter „URLs zu Datenressourcen → ${label}" ob eine gültige ${typLabel}-URL eingetragen ist (Hilfe-Tooltip beachten).`,
      detail: msg,
      alertClass: "alert-info"
    };
  }
  if (/Typ passt nicht: erwartet/i.test(msg)) {
    return {
      kind: "TYP_MISMATCH",
      titel: msg,
      hinweis: `Diese App erwartet ${typLabel}. Korrigieren Sie die URL gemäß Hilfe-Tooltip (Beispiel dort).`,
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  if (/URL origin not allowed/i.test(msg)) {
    return {
      kind: "PROXY_ORIGIN",
      titel: "ODAS-Proxy blockiert: Ziel-Origin nicht freigegeben.",
      hinweis: "Tragen Sie die Ziel-Origin als eigenen Eintrag unter „URLs zu Datenressourcen“ ein oder prüfen Sie proxyAktiv.",
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  if (/ODAS-Proxy-Fehler/i.test(msg) || /kein content-String/i.test(msg)) {
    return {
      kind: "PROXY_HTTP",
      titel: msg,
      hinweis: "Prüfen Sie proxyAktiv und Erreichbarkeit im ODAS-Live-System (lokal 404 ist normal).",
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  if (/Direkter Datenabruf fehlgeschlagen/i.test(msg) || /Failed to fetch/i.test(msg)) {
    const corsHint = /Failed to fetch/i.test(msg) ? " – vermutlich CORS blockiert → im ODAS-Live proxyAktiv=ja." : "";
    return {
      kind: "DIREKT_CORS_HTTP",
      titel: msg,
      hinweis: `Prüfen Sie URL und CORS der Quelle${corsHint}`,
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  if (/liefert kein JSON/i.test(msg) || /HTML-Seite|CSV-|leere Antwort|unlesbaren/i.test(msg)) {
    return {
      kind: "PAYLOAD_TYP",
      titel: msg,
      hinweis: "Tragen Sie den passenden Endpunkt ein – nicht die Datensatzseite (/dataset/…) – Hilfe-Tooltip beachten.",
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  if (/CKAN.*Fehler|success:false/i.test(msg)) {
    return {
      kind: "CKAN_API",
      titel: msg,
      hinweis: "Prüfen Sie Daten-ID / Datensatz-ID (existiert die Tabelle/Datei noch auf dem Portal?).",
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  if (/404|Nicht gefunden/i.test(msg)) {
    return {
      kind: "HTTP_404",
      titel: msg,
      hinweis: "Ressource/Datensatz auf dem Portal nicht gefunden (404).",
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  return {
    kind: "UNBEKANNT",
    titel: msg || "Unbekannter Fehler beim Laden.",
    hinweis: "Prüfen Sie Konfiguration und Erreichbarkeit der Quelle.",
    detail: msg,
    alertClass: "alert-danger"
  };
}

function renderOdasFehler(container, error, kontext = {}) {
  if (!container) return;
  // Mehrere akzeptierte URL-Typen (z. B. CKAN-Download oder statische Datei):
  // erst warnen, wenn kein einziger passt.
  const typen = Array.isArray(kontext.erwarteteTypen) && kontext.erwarteteTypen.length
    ? kontext.erwarteteTypen
    : [kontext.erwarteterTyp];
  let typWarn = null;
  for (const t of typen) {
    typWarn = validateUrlTypErwartung(kontext.url, t);
    if (!typWarn) break;
  }
  if (typWarn && !/Typ passt nicht/i.test(String(error && error.message))) {
    error = new Error(typWarn);
  }
  const info = classifyOdasFehler(error, kontext);
  const url = String(kontext.url || "");
  const urlZeile = url ? `<p class="mb-1 small text-muted">Konfigurierte URL: <code>${escapeHtml(url.length > 80 ? url.slice(0, 80) + "…" : url)}</code></p>` : "";
  const titel = kontext.leer ? "Keine Datensätze gefunden." : info.titel;
  const alertClass = kontext.leer ? "alert-info" : info.alertClass;
  container.innerHTML = `<div class="alert ${alertClass}" role="alert"><strong>${escapeHtml(titel)}</strong><p class="mb-1">${escapeHtml(info.hinweis)}</p>${urlZeile}<details class="small"><summary>Details</summary><code>${escapeHtml(info.detail || String(error))}</code></details></div>`;
}

// ── CSV-PARSING ──────────────────────────────────────────────────────────────
// Kommunale Open-Data-CSVs sind häufig Semikolon-getrennt, enthalten gequotete
// Felder und CRLF-Zeilenenden. PapaParse (vendort, RFC 4180, Delimiter-Auto-
// Detect) übernimmt das robuste Parsen. Unten wird weiterhin positional
// (Name/Stelle/Telefonnummer per Spaltenindex) zugegriffen, daher bleibt die
// Ausgabeform Array-of-Arrays inkl. Kopfzeile (header: false) — wie beim
// vorherigen Eigenparser, der ebenfalls rows[0] als Kopfzeile auslieferte.

// PapaParse (CSV-Parsing) dynamisch aus app/vendor laden; Promise-basiert.
function ensurePapaparse() {
  return new Promise((resolve, reject) => {
    if (window.Papa) {
      resolve();
      return;
    }
    const vorhanden = document.getElementById("papaparse-script");
    if (vorhanden) {
      vorhanden.addEventListener("load", () => resolve());
      vorhanden.addEventListener("error", () =>
        reject(new Error("PapaParse konnte nicht geladen werden.")),
      );
      return;
    }
    const script = document.createElement("script");
    script.id = "papaparse-script";
    script.src = "vendor/papaparse/papaparse.min.js";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("PapaParse konnte nicht geladen werden."));
    document.head.appendChild(script);
  });
}

function parseCsv(text) {
  const result = Papa.parse(String(text), {
    header: false,
    skipEmptyLines: "greedy",
  });
  if (result.errors && result.errors.length > 0) {
    console.warn("Telefonbuch: CSV-Parsing-Warnungen:", result.errors);
  }
  return result.data;
}

function renderWeitereInfos(configdata, uid) {
  const links = (configdata.weiterfuehrendeLinks || "").trim();
  if (!links) return "";
  return (
    '<div class="card shadow-sm mt-4"><div class="card-body">' +
    '<button class="tb-toggle btn btn-link text-decoration-none d-flex w-100 justify-content-between align-items-center p-0 collapsed" type="button" ' +
    'data-bs-toggle="collapse" data-bs-target="#tb-weitere-infos-body-' + uid + '" ' +
    'aria-expanded="false" aria-controls="tb-weitere-infos-body-' + uid + '">' +
    '<h5 class="card-title mb-0">Weitere Informationen</h5>' +
    '<span class="tb-chevron" aria-hidden="true">&#9662;</span>' +
    "</button>" +
    '<div id="tb-weitere-infos-body-' + uid + '" class="collapse mt-2">' +
    links +
    "</div>" +
    "</div></div>"
  );
}

function renderMethodikbox(configdata, uid) {
  const hinweis = String(configdata.datenquelleHinweis || "").trim();
  const stand = String(configdata.datenStand || "").trim();
  if (!hinweis && !stand) return "";
  const standZeile = stand
    ? '<p class="text-muted small mb-2">' + escapeHtml(stand) + "</p>"
    : "";
  return (
    '<div class="card shadow-sm mt-4"><div class="card-body">' +
    '<button class="tb-toggle btn btn-link text-decoration-none d-flex w-100 justify-content-between align-items-center p-0 collapsed" type="button" ' +
    'data-bs-toggle="collapse" data-bs-target="#tb-methodik-body-' + uid + '" ' +
    'aria-expanded="false" aria-controls="tb-methodik-body-' + uid + '">' +
    '<h5 class="card-title mb-0">Methodik &amp; Datenquelle</h5>' +
    '<span class="tb-chevron" aria-hidden="true">&#9662;</span>' +
    "</button>" +
    '<div id="tb-methodik-body-' + uid + '" class="collapse mt-2">' +
    standZeile +
    hinweis +
    "</div>" +
    "</div></div>"
  );
}

function app(configData, enclosingHtmlDivElement) {
  const tbUid = "i" + ++tbInstanzZaehler;

  // B1: vorherigen Cleanup desselben Containers zuerst laufen lassen — die
  // Base rendert bei Klick auf die aktive Seite neu, sonst leakt die alte
  // DataTable-Instanz (Listener auf document/window) bei jedem Re-Render.
  const vorherigerCleanup = tbCleanups.get(enclosingHtmlDivElement);
  if (vorherigerCleanup) {
    try {
      vorherigerCleanup();
    } catch (_e) {}
  }

  // Per-Instanz-Laufzeitzustand: wird synchron vor jeglicher DOM- und
  // Async-Arbeit angelegt und je Container in tbCleanups registriert. Alle
  // abzusichernden Ressourcen (hier die DataTable) haengen an diesem Objekt,
  // damit der Cleanup beim Seitenwechsel genau diese Referenz abraeumen kann
  // und verspaetete Promise-Fortsetzungen ihren Wurf ins Leere laufen lassen.
  const runtime = {
    disposed: false,
    dataTable: null,
  };
  tbCleanups.set(enclosingHtmlDivElement, () => {
    runtime.disposed = true;
    if (runtime.dataTable) {
      runtime.dataTable.destroy();
      runtime.dataTable = null;
    }
  });

  enclosingHtmlDivElement.innerHTML = `<div id="tb-status-${tbUid}"></div>
      <div id="tb-toolbar-${tbUid}"></div>
      <div class="table-responsive">
      <table id="tb-phonebook-table-${tbUid}" class="tb-phonebook-table table table-striped table-hover">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Stelle</th>
            <th scope="col">Telefonnummer</th>
            <th scope="col">Kontakt</th>
          </tr>
        </thead>
        <tbody id="tb-phonebook-body-${tbUid}">
        <!-- Dynamische Inhalte werden hier eingefügt -->
        </tbody>
      </table></div>`;
  loadCSV(configData, enclosingHtmlDivElement, tbUid, runtime);
}

function setTelefonbuchStatus(root, uid, html) {
  const status = root && root.querySelector("#tb-status-" + uid);
  if (status) status.innerHTML = html || "";
}

// Funktion zum Laden der CSV-Dateien aus der API
function isKeineDatenquelleKonfiguriert(targetUrl) {
  const quelle = String(targetUrl || "").trim();
  return !quelle || /^\{\{.*\}\}$/.test(quelle) || /^<.*>$/.test(quelle);
}

async function loadCSV(configData, enclosingHtmlDivElement, uid, runtime) {
  const root = enclosingHtmlDivElement;
  const tbQuelle = getOdasApiUrl(configData, "telefonbuch");
  if (isKeineDatenquelleKonfiguriert(tbQuelle)) {
    renderOdasFehler(root, new Error("Keine Datenquelle konfiguriert."), {
      url: tbQuelle,
      label: "Telefonbuch-CSV",
      typLabel: "Datei-Download",
      erwarteteTypen: ["ckan-dl", "csv-zip"],
    });
    const emptyTableBody = root.querySelector("#tb-phonebook-body-" + uid);
    if (emptyTableBody) emptyTableBody.innerHTML = "";
    return;
  }
  // Variante A (F-92): Typprüfung vor dem ersten Fetch. Neben CKAN-Downloads
  // sind statische Datei-URLs (CSV/JSON) zulässig — erst warnen, wenn kein
  // Typmuster passt.
  const tbCkanWarn = validateUrlTypErwartung(tbQuelle, "ckan-dl");
  const tbTypWarn = tbCkanWarn && validateUrlTypErwartung(tbQuelle, "csv-zip") ? tbCkanWarn : null;
  if (tbTypWarn) {
    renderOdasFehler(root, new Error(tbTypWarn), {
      url: tbQuelle,
      label: "Telefonbuch-CSV",
      typLabel: "Datei-Download",
      erwarteteTypen: ["ckan-dl", "csv-zip"],
    });
    const emptyTableBody = root.querySelector("#tb-phonebook-body-" + uid);
    if (emptyTableBody) emptyTableBody.innerHTML = "";
    return;
  }
  try {
    const csvData = await fetchOdasResource(getOdasApiUrl(configData, "telefonbuch"), configData);

    // Seitenwechsel waehrend des Fetch: abbrechen, bevor irgendetwas geparst
    // oder in den DOM geschrieben wird.
    if (runtime.disposed) return;

    await ensurePapaparse();
    if (runtime.disposed) return;

    // CSV- oder JSON-Quelle auf Eintragsform abbilden; unbrauchbare Zeilen
    // werden gezählt, nicht stillschweigend verworfen.
    const daten = tbNormalisiereDatensaetze(csvData);
    const eintraege = daten.eintraege;
    const uebersprungen = daten.uebersprungen;
    const uebernommen = eintraege.length;
    runtime.eintraege = eintraege;

    const tableBody = root.querySelector("#tb-phonebook-body-" + uid);
    const fragment = document.createDocumentFragment();
    eintraege.forEach((eintrag, index) => {
      const tr = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = eintrag.name;
      tr.appendChild(nameCell);

      const stelleCell = document.createElement("td");
      stelleCell.textContent = eintrag.stelle;
      tr.appendChild(stelleCell);

      const telCell = document.createElement("td");
      if (eintrag.telefon) {
        const telLink = document.createElement("a");
        telLink.href = tbNormalisiereTelHref(eintrag.telefon);
        telLink.textContent = eintrag.telefon;
        telLink.className = "tb-tel-link";
        telCell.appendChild(telLink);
      }
      tr.appendChild(telCell);

      const vcardCell = document.createElement("td");
      const vcardBtn = document.createElement("button");
      vcardBtn.type = "button";
      vcardBtn.className = "btn btn-sm btn-outline-secondary tb-vcard-btn";
      vcardBtn.textContent = "vCard";
      vcardBtn.setAttribute("data-tb-index", String(index));
      vcardBtn.setAttribute("aria-label", "Kontakt als vCard laden: " + eintrag.name);
      vcardCell.appendChild(vcardBtn);
      tr.appendChild(vcardCell);

      fragment.appendChild(tr);
    });
    if (tableBody) tableBody.appendChild(fragment);

    // Event-Delegation für vCard-Buttons: genau ein Listener am tbody, der
    // DataTables-Neuzeichnungen (Sortierung, Paginierung) überlebt.
    if (tableBody) {
      tableBody.addEventListener("click", (event) => {
        const btn = event.target && event.target.closest
          ? event.target.closest(".tb-vcard-btn")
          : null;
        if (!btn || runtime.disposed) return;
        const eintrag = (runtime.eintraege || [])[Number(btn.getAttribute("data-tb-index"))];
        if (!eintrag) return;
        const dateiname = eintrag.name.replace(/[^\wäöüÄÖÜß-]+/g, "_").replace(/_+/g, "_") + ".vcf";
        tbLadeDateiHerunter(dateiname, tbBaueVcard(eintrag), "text/vcard");
      });
    }

    if (uebernommen === 0) {
      setTelefonbuchStatus(
        root,
        uid,
        '<div class="alert alert-info" role="alert">Keine Daten gefunden.</div>',
      );
    } else if (uebersprungen > 0) {
      console.warn(
        `Telefonbuch: ${uebersprungen} Zeile(n) ohne verwertbare Spalten übersprungen.`,
      );
      setTelefonbuchStatus(
        root,
        uid,
        '<div class="alert alert-warning" role="alert">' +
          escapeHtml(String(uebersprungen)) +
          " Eintrag/Einträge der Datenquelle konnten nicht gelesen werden und fehlen in dieser Liste.</div>",
      );
    }

    // DataTable initialisieren (jQuery/DataTables erst jetzt dynamisch laden)
    if (runtime.disposed) return;
    await ensureJqueryDataTables();
    if (runtime.disposed) return;
    runtime.dataTable = $(root.querySelector("#tb-phonebook-table-" + uid)).DataTable({
      columnDefs: [{ orderable: false, searchable: false, targets: 3 }],
      language: {
        decimal: ",",
        thousands: ".",
        search: "Suche:",
        lengthMenu: "Zeige _MENU_ Einträge",
        info: "Zeige _START_ bis _END_ von _TOTAL_ Einträgen",
        infoEmpty: "Keine Einträge verfügbar",
        infoFiltered: "(gefiltert von _MAX_ Einträgen)",
        loadingRecords: "Lade...",
        zeroRecords: "Keine passenden Einträge gefunden",
        paginate: {
          first: "|<",
          last: ">|",
          next: ">",
          previous: "<",
        },
        aria: {
          sortAscending: ": aktivieren, um aufsteigend zu sortieren",
          sortDescending: ": aktivieren, um absteigend zu sortieren",
        },
      },
      pagingType: "full",
    });

    tbBaueToolbar(root, uid, runtime);

    const methodikHTML = renderMethodikbox(configData, uid);
    if (methodikHTML) {
      const methodikEl = document.createElement("div");
      methodikEl.innerHTML = methodikHTML;
      root.appendChild(methodikEl);
    }

    const weitereHTML = renderWeitereInfos(configData, uid);
    if (weitereHTML) {
      const weitereEl = document.createElement("div");
      weitereEl.innerHTML = weitereHTML;
      root.appendChild(weitereEl);
    }
  } catch (error) {
    // Nach dem Seitenwechsel keine Status-/DOM-Beschreibung mehr schreiben.
    if (runtime.disposed) return;
    console.error("Fehler beim Laden der CSV-Daten:", error);
    renderOdasFehler(root, error, {
      url: getOdasApiUrl(configData, "telefonbuch"),
      label: "Telefonbuch-CSV",
      typLabel: "Datei-Download",
      erwarteteTypen: ["ckan-dl", "csv-zip"],
    });
    const tableBody = root.querySelector("#tb-phonebook-body-" + uid);
    if (tableBody) tableBody.innerHTML = "";
  }
}

// Toolbar: Stellen-Filter (aus den Daten abgeleitet, keine Config),
// A–Z-Navigation über Namensinitialen, CSV-Export der gefilterten Ansicht.
// Alle Datenwerte laufen über escapeHtml — nie roh in innerHTML.
function tbBaueToolbar(root, uid, runtime) {
  const box = root.querySelector("#tb-toolbar-" + uid);
  if (!box || !runtime.dataTable || runtime.disposed) return;
  const eintraege = runtime.eintraege || [];
  const stellen = [...new Set(eintraege.map((e) => e.stelle).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "de"));
  const initialen = new Set();
  eintraege.forEach((e) => {
    const ch = String(e.name || "").trim().charAt(0).toUpperCase();
    if (/[A-ZÄÖÜ]/.test(ch)) initialen.add(ch);
  });
  const buchstaben = [...initialen].sort((a, b) => a.localeCompare(b, "de"));

  const stellenOptionen = stellen
    .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
    .join("");
  const azButtons = buchstaben
    .map((b) => `<button type="button" class="btn btn-sm btn-outline-secondary tb-az-btn" data-tb-buchstabe="${b}" aria-pressed="false">${b}</button>`)
    .join("");
  box.innerHTML =
    `<div class="tb-toolbar d-flex flex-wrap gap-2 align-items-center mb-3">` +
    `<select id="tb-stelle-filter-${uid}" class="form-select form-select-sm tb-stelle-filter" aria-label="Nach Stelle filtern">` +
    `<option value="">Alle Stellen</option>${stellenOptionen}</select>` +
    `<div class="tb-az btn-group btn-group-sm flex-wrap" role="group" aria-label="Nach Anfangsbuchstabe filtern">` +
    `<button type="button" class="btn btn-sm btn-primary tb-az-btn" data-tb-buchstabe="" aria-pressed="true">Alle</button>${azButtons}</div>` +
    `<button id="tb-csv-export-${uid}" type="button" class="btn btn-sm btn-outline-secondary">CSV-Export</button>` +
    `<button id="tb-reset-${uid}" type="button" class="btn btn-sm btn-outline-secondary">Zurücksetzen</button>` +
    `</div>`;

  const tabelle = runtime.dataTable;
  const stelleFilter = box.querySelector("#tb-stelle-filter-" + uid);
  if (stelleFilter) {
    stelleFilter.addEventListener("change", () => {
      if (runtime.disposed) return;
      const wert = stelleFilter.value;
      tabelle.column(1).search(wert ? "^" + tbEscapeRegExp(wert) + "$" : "", true, false).draw();
    });
  }
  const setzeAzAktiv = (aktiverBtn) => {
    box.querySelectorAll(".tb-az-btn").forEach((btn) => {
      const aktiv = btn === aktiverBtn;
      btn.classList.toggle("btn-primary", aktiv);
      btn.classList.toggle("btn-outline-secondary", !aktiv);
      btn.setAttribute("aria-pressed", aktiv ? "true" : "false");
    });
  };
  box.querySelectorAll(".tb-az-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (runtime.disposed) return;
      const buchstabe = btn.getAttribute("data-tb-buchstabe") || "";
      tabelle.column(0).search(buchstabe ? "^" + buchstabe : "", true, false).draw();
      setzeAzAktiv(btn);
    });
  });
  const resetBtn = box.querySelector("#tb-reset-" + uid);
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (runtime.disposed) return;
      if (stelleFilter) stelleFilter.value = "";
      tabelle.column(1).search("", true, false);
      tabelle.column(0).search("", true, false).draw();
      setzeAzAktiv(box.querySelector('.tb-az-btn[data-tb-buchstabe=""]'));
    });
  }
  const exportBtn = box.querySelector("#tb-csv-export-" + uid);
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      if (runtime.disposed) return;
      const indexe = tabelle.rows({ search: "applied" }).indexes().toArray();
      const zeilen = ["Name;Stelle;Telefonnummer"];
      indexe.forEach((i) => {
        const e = (runtime.eintraege || [])[i];
        if (!e) return;
        zeilen.push([e.name, e.stelle, e.telefon].map(tbEscapeCsvFeld).join(";"));
      });
      tbLadeDateiHerunter("telefonbuch-export.csv", "\uFEFF" + zeilen.join("\r\n"), "text/csv");
    });
  }
}

/*
 * Diese Funktion kann Bibliotheken und benötigte Skripte laden.
 * Sie hängt den zurückgegebenen HTML Code in die Head Section an.
 *
 * @returns {string} - HTML mit script, link, etc. Tags
 */
function addToHead() {
  return ``;
}
