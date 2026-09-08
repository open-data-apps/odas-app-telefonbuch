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
  const typWarn = validateUrlTypErwartung(kontext.url, kontext.erwarteterTyp);
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

function isLeerErgebnis(json) {
  if (!json) return true;
  if (Array.isArray(json) && json.length === 0) return true;
  if (Array.isArray(json.records) && json.records.length === 0) return true;
  if (Array.isArray(json.results) && json.results.length === 0) return true;
  if (json.result && Array.isArray(json.result.records) && json.result.records.length === 0) return true;
  return false;
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
      <div class="table-responsive">
      <table id="tb-phonebook-table-${tbUid}" class="tb-phonebook-table table table-striped table-hover">
        <thead>
          <tr>
            <th>Name</th>
            <th>Stelle</th>
            <th>Telefonnummer</th>
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
      erwarteterTyp: "ckan-dl",
    });
    const emptyTableBody = root.querySelector("#tb-phonebook-body-" + uid);
    if (emptyTableBody) emptyTableBody.innerHTML = "";
    return;
  }
  // Variante A (F-92): Typprüfung vor dem ersten Fetch.
  const tbTypWarn = validateUrlTypErwartung(tbQuelle, "ckan-dl");
  if (tbTypWarn) {
    renderOdasFehler(root, new Error(tbTypWarn), {
      url: tbQuelle,
      label: "Telefonbuch-CSV",
      typLabel: "Datei-Download",
      erwarteterTyp: "ckan-dl",
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

    const rows = parseCsv(csvData);

    const tableBody = root.querySelector("#tb-phonebook-body-" + uid);
    // Kopfzeile überspringen; Zeilen mit zu wenigen Spalten werden gezählt,
    // nicht stillschweigend verworfen.
    const datenzeilen = rows.slice(1);
    let uebersprungen = 0;
    let uebernommen = 0;

    datenzeilen.forEach((cols) => {
      const name = (cols[0] || "").trim();
      if (cols.length < 3 || name === "") {
        uebersprungen++;
        return;
      }
      uebernommen++;
      const tr = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = name;
      tr.appendChild(nameCell);

      const stelleCell = document.createElement("td");
      stelleCell.textContent = (cols[1] || "").trim();
      tr.appendChild(stelleCell);

      const telefon = (cols[2] || "").trim();
      const telCell = document.createElement("td");
      const telLink = document.createElement("a");
      telLink.href = `tel:${telefon}`;
      telLink.textContent = telefon;
      telLink.style.textDecoration = "underline";
      telCell.appendChild(telLink);
      tr.appendChild(telCell);

      tableBody.appendChild(tr);
    });

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

    // DataTable initialisieren
    if (runtime.disposed) return;
    runtime.dataTable = $(root.querySelector("#tb-phonebook-table-" + uid)).DataTable({
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
      drawCallback: function (settings) {
        if (window.innerWidth <= 576) {
          // Nur die eigene Instanz umsortieren — kein fremdes DataTables-
          // Wrapper-Element auf der Seite anfassen (Instanzisolation F-42)
          const wrapper = $(settings.nTable).closest(".dataTables_wrapper");
          const lengthMenu = wrapper.find(".dataTables_length");
          const paginateMenu = wrapper.find(".dataTables_paginate");

          lengthMenu.insertAfter(paginateMenu);
        }
      },
    });

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
      erwarteterTyp: "ckan-dl",
    });
    const tableBody = root.querySelector("#tb-phonebook-body-" + uid);
    if (tableBody) tableBody.innerHTML = "";
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
