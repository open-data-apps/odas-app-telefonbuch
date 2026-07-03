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

function renderWeitereInfos(configdata) {
  const links = (configdata.weiterfuehrendeLinks || "").trim();
  if (!links) return "";
  return (
    '<section class="tb-weitere-infos mt-4">' +
    '<h2 class="h5 mb-3">Weitere Informationen</h2>' +
    '<div class="tb-weitere-infos-content">' +
    links +
    "</div></section>"
  );
}

function extractDatenStand(proxyResponse) {
  const raw = proxyResponse?.lastModified || null;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString("de-DE");
}

function app(configData, enclosingHtmlDivElement) {
  loadCSV(configData);
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
}
// Funktion zum Laden der CSV-Dateien aus der API
async function loadCSV(configData) {
  try {
    // Aktuellen Pfad extrahieren, z. B. /view/odpname/appname/instanzid
    const fullPath = window.location.pathname.replace(/\/+$/, "");

    // Proxy-Endpunkt zusammensetzen
    const proxyEndpoint = `${fullPath}/odp-data?path=${configData.apiurl}`;

    const response = await fetch(proxyEndpoint, {
      method: "POST",
    });

    if (!response.ok) {
      console.error(`Fehler beim Abrufen der Daten vom Proxy-Endpunkt`);
      return;
    }

    const result = await response.json();
    if (result.contentType !== "text/csv") {
      console.error("Die geladene Datei ist keine CSV-Datei.");
      return;
    }

    let stand = extractDatenStand(result);
    if (!stand) {
      const cfgStand = String(configData.datenStand || "").trim();
      stand = cfgStand || null;
    }
    if (stand) {
      const mainContent = document.getElementById("main-content");
      if (mainContent) {
        const frischeEl = document.createElement("div");
        frischeEl.className = "text-muted small text-end mb-2";
        frischeEl.textContent = "Aktualisiert: " + stand;
        mainContent.insertBefore(frischeEl, mainContent.firstChild);
      }
    }

    const csvData = result.content;
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
