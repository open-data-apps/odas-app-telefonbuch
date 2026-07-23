/*
 * Diese Funktion ist für die Inhalte der Startseite
 * zuständig.
 *
 * @param {Object} configdata - Alle Konfigurationsdaten der App
 * @returns {string} - darzustellendes HTML
 */

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
  return `${appPath}/odp-data?path=${encodeURIComponent(
    extractPathFromUrl(targetUrl),
  )}`;
}

async function fetchViaOdasProxy(targetUrl) {
  const response = await fetch(getOdasProxyEndpoint(targetUrl), {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`ODAS-Proxy-Fehler: HTTP ${response.status}`);
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

async function fetchOdasJson(targetUrl, configdata = {}) {
  return JSON.parse(await fetchOdasResource(targetUrl, configdata));
}

function renderWeitereInfos(configdata) {
  const links = (configdata.weiterfuehrendeLinks || "").trim();
  if (!links) return "";
  return (
    '<div class="card shadow-sm mt-4"><div class="card-body">' +
    '<button class="tb-toggle btn btn-link text-decoration-none d-flex w-100 justify-content-between align-items-center p-0 collapsed" type="button" ' +
    'data-bs-toggle="collapse" data-bs-target="#tb-weitere-infos-body" ' +
    'aria-expanded="false" aria-controls="tb-weitere-infos-body">' +
    '<h5 class="card-title mb-0">Weitere Informationen</h5>' +
    '<span class="tb-chevron" aria-hidden="true">&#9662;</span>' +
    "</button>" +
    '<div id="tb-weitere-infos-body" class="collapse mt-2">' +
    links +
    "</div>" +
    "</div></div>"
  );
}

function renderMethodikbox(configdata) {
  const hinweis = String(configdata.datenquelleHinweis || "").trim();
  const stand = String(configdata.datenStand || "").trim();
  if (!hinweis && !stand) return "";
  const standZeile = stand
    ? '<p class="text-muted small mb-2">' + escapeHtml(stand) + "</p>"
    : "";
  return (
    '<div class="card shadow-sm mt-4"><div class="card-body">' +
    '<button class="tb-toggle btn btn-link text-decoration-none d-flex w-100 justify-content-between align-items-center p-0 collapsed" type="button" ' +
    'data-bs-toggle="collapse" data-bs-target="#tb-methodik-body" ' +
    'aria-expanded="false" aria-controls="tb-methodik-body">' +
    '<h5 class="card-title mb-0">Methodik &amp; Datenquelle</h5>' +
    '<span class="tb-chevron" aria-hidden="true">&#9662;</span>' +
    "</button>" +
    '<div id="tb-methodik-body" class="collapse mt-2">' +
    standZeile +
    hinweis +
    "</div>" +
    "</div></div>"
  );
}

function app(configData, enclosingHtmlDivElement) {
  enclosingHtmlDivElement.innerHTML = `<div class="table-responsive">
      <table id="phonebook-table" class="table table-striped table-hover">
        <thead>
          <tr>
            <th>Name</th>
            <th>Stelle</th>
            <th>Telefonnummer</th>
          </tr>
        </thead>
        <tbody id="phonebook-body">
        <!-- Dynamische Inhalte werden hier eingefügt -->
        </tbody>
      </table></div>`;
  loadCSV(configData);
}
// Funktion zum Laden der CSV-Dateien aus der API
async function loadCSV(configData) {
  try {
    const csvData = await fetchOdasResource(configData.apiurl, configData);
    const rows = csvData.split("\n").slice(1);

    const tableBody = document.getElementById("phonebook-body");
    rows.forEach((row) => {
      const cols = row.split(",");
      if (cols.length === 3 && cols[0].trim() !== "") {
        const tr = document.createElement("tr");

        const nameCell = document.createElement("td");
        nameCell.textContent = cols[0].trim();
        tr.appendChild(nameCell);

        const stelleCell = document.createElement("td");
        stelleCell.textContent = cols[1].trim();
        tr.appendChild(stelleCell);

        const telCell = document.createElement("td");
        const telLink = document.createElement("a");
        telLink.href = `tel:${cols[2].trim()}`;
        telLink.textContent = cols[2].trim();
        telLink.style.textDecoration = "underline";
        telCell.appendChild(telLink);
        tr.appendChild(telCell);

        tableBody.appendChild(tr);
      }
    });

    // DataTable initialisieren
    $("#phonebook-table").DataTable({
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
          const lengthMenu = $(".dataTables_length");
          const paginateMenu = $(".dataTables_paginate");

          lengthMenu.insertAfter(paginateMenu);
        }
      },
    });

    const methodikHTML = renderMethodikbox(configData);
    if (methodikHTML) {
      const mainContent = document.getElementById("main-content");
      if (mainContent) {
        const methodikEl = document.createElement("div");
        methodikEl.innerHTML = methodikHTML;
        mainContent.appendChild(methodikEl);
      }
    }

    const weitereHTML = renderWeitereInfos(configData);
    if (weitereHTML) {
      const mainContent = document.getElementById("main-content");
      if (mainContent) {
        const weitereEl = document.createElement("div");
        weitereEl.innerHTML = weitereHTML;
        mainContent.appendChild(weitereEl);
      }
    }
  } catch (error) {
    console.error("Fehler beim Laden der CSV-Daten:", error);
    const tableBody = document.getElementById("phonebook-body");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="3" class="text-danger"><strong>Fehler beim Laden:</strong> ${escapeHtml(
        error.message,
      )}</td></tr>`;
    }
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
