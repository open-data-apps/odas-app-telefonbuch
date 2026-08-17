# Changelog


## 1.21.0 - 2026-08-17
- `fetchOdasJson()` wirft jetzt bei nicht-JSON-Antworten (CSV, HTML, leerer Body) eine sprechende Konfigurationsfehlermeldung statt der rohen `JSON.parse`-Parserfehlermeldung (F-66)
- `urlDaten` zeigte auf einen nicht mehr existierenden Host (`offenedaten.esslingen.de`/`open-data-esslingen.de`, NXDOMAIN) bzw. auf den Platzhalter `.../testdaten` (HTTP 404) — jetzt auf die reale Datensatz-Landingpage der tatsächlich konfigurierten `apiurl`-Quelle verweisend, live per HTTP-Abruf verifiziert (F-67)

## 1.20.0 - 2026-08-17
- **CHG:** `instanz-config`-`category`-Vokabular auf Deutsch umgestellt (`allgemein`, `beschreibung`, `datenherkunft`, `kontakt-rechtliches`, `sonstiges`); die entfallenen Kategorien `metrics` und `advanced` wurden auf `beschreibung` bzw. `sonstiges` verteilt

## 1.19.0 - 2026-08-13
- FIX: Lifecycle-Cleanup (F-57): je App-Instanz laufzeitgebundene DataTable-Referenz; `onPageLeave` raeumt beim Seitenwechsel die DataTable per `.destroy()` ab und registrierte Cleanups sind pro Container gekapselt; verspaetete CSV-Erfolge/-Fehler nach dem Seitenwechsel bleiben wirkungslos (keine Zeilen, keine DataTable-Initialisierung, keine Karten, kein Status/DOM-Ueberschreiben)

## 1.18.0 - 2026-08-12
- FIX: `app/index.html` auf den Template-Stand gebracht; die Vendor-Zeilen aus dem F-36-Fix bleiben in der Reihenfolge jQuery → DataTables → app.js erhalten (F-47)

## 1.17.0 - 2026-08-12
- FIX: `app/app.css` wird wieder eingebunden und der dort gerenderte mobile Block wirkt (F-54)
- FIX: Tote ID-Selektoren `#tb-phonebook-table` auf Klassen-Selektoren umgestellt — die Regeln greifen nach der instanzeindeutigen ID-Umstellung wieder (F-54)

## 1.16.0 - 2026-08-11
- FIX: Laufzeitzustand pro App-Instanz isoliert (F-42): Status-, Tabellen- und Body-IDs instanzeindeutig (`tb-status-<uid>`, `tb-phonebook-table-<uid>`, `tb-phonebook-body-<uid>`); `drawCallback` sortiert nur das eigene Wrapper-Element um (`$(settings.nTable).closest(".dataTables_wrapper")` + `.find(...)` statt globaler `$(".dataTables_length")`/`$(".dataTables_paginate")`-Selektoren) — mehrere Instanzen auf einer Seite tauschen ihre Menü-Zeilen nicht mehr

## 1.15.0 - 2026-08-11
- FIX: jQuery 3.6.0 und DataTables 1.11.5 lokal vendored (F-36) — die Bibliotheken werden aus `app/vendor/jquery/` bzw. `app/vendor/datatables/` ausgeliefert statt von `code.jquery.com`/`cdn.datatables.net` geladen; keine externen Server fuer Programmbibliotheken beim Aufruf

## 1.14.0 - 2026-08-07
- FIX: Bootstrap-Ziele instanzeindeutig machen (F-32): `data-bs-target`, `aria-controls` und die div-IDs der Methodik-Box (`tb-methodik-body`) und der Box „Weitere Informationen" (`tb-weitere-infos-body`) werden pro App-Instanz mit einer UID versehen (`tb-methodik-body-i1`, `-i2`, …), damit mehrere Instanzen der App auf einer Seite nicht kollidieren

## 1.13.0 - 2026-08-06
- FIX: Datenschutzangabe beschreibt den tatsaechlichen Stand nach dem Vendoring (Welle G)

## 1.12.0 - 2026-08-06
- FIX: Base auf Template oda-generic 1.6.0 vereinheitlicht (Hook renderPageOverride)

## 1.11.0 - 2026-08-04
- FIX: Datenschutzhinweis "Beim Aufruf kontaktierte Drittanbieter" an das Vendoring angepasst — jetzt lokal ausgelieferte Bibliotheken (Bootstrap/Leaflet/Chart.js) sind aus der Liste entfernt, weiterhin extern geladene Dienste (Kartenkacheln, Zusatzbibliotheken) bleiben genannt

## 1.10.0 - 2026-08-04
- FIX: Bootstrap vendored in `app/vendor/` statt von CDN geladen (F-07 Teil 2) — Standalone-Betrieb laedt diese Bibliotheken nicht mehr extern

## 1.9.0 - 2026-08-04
- FIX: Drittanbieter (CDN, Kartendienste) in `datenschutz`-Default und README dokumentiert (F-07 Teil 1)
- FIX: Bootstrap CSS/JS auf einheitlich 5.3.8 gezogen (vorher gemischt 5.3.0/5.3.1 bzw. 5.3.0/5.3.0) (F-31)
- FIX: lokale `odas-config/config.json`: Platzhalterwert `"abc"` in `datenschutz` durch den App-Paket-Default ersetzt

## 1.8.0 - 2026-07-31
- FIX: CSV-Zerlegung auf den Konventions-Parser umgestellt (F-14) - Semikolon-Quellen,
  gequotete Felder mit Komma und CRLF-Zeilenenden werden korrekt gelesen
- FIX: Zeilen ohne verwertbare Spalten werden gezaehlt und als Hinweis angezeigt statt
  stillschweigend verworfen
- ENH: Empty-State "Keine Daten gefunden." und sichtbarer Fehlerzustand ergaenzt
- CHG: DOM-Zugriffe an den App-Container gebunden, IDs mit Praefix tb- versehen (F-25)

## 1.7.0 - 2026-07-31
- CHG: fehlendes Pflicht-Asset assets/branding.css ergaenzt und brandingCSSFile lokal aktiviert

## 1.6.0 - 2026-07-31
- CHG: toter Konfigurationsschlüssel lizenz entfernt (F-17)
- CHG: brandingCSS und brandingCSSFile als Base-Abhängigkeiten deklariert und lokal gespiegelt (F-17)
- CHG: format.typ von "String" auf v1-sicheres "string" korrigiert (F-18)
- CHG: dropdown-Default auf Feldebene verschoben statt in format (F-18)
- CHG: Platzhalter-Entwickler mueller-gmbh durch ondics-gmbh ersetzt (F-21)
- CHG: Platzhalter Mueller GmbH aus der Fußzeile entfernt (F-21)
- FIX: defekte Icon- und Screenshot-Referenzen korrigiert (F-19)
- CHG: daten.schema auf assets/schema.json gesetzt (F-20)

## 1.5.0 - 2026-07-30

- **FIX:** Laufzeitfehler nach dem Laden der Konfiguration werden jetzt sichtbar gemeldet; `handleRouting()` wird `await`et und besitzt einen Fehlerpfad. Bisher blieb die Seite bei einem Fehler im Seitenaufbau stumm leer
- **FIX:** `getConfigUrl()` schneidet bei einer URL ohne abschliessenden Schraegstrich nicht mehr das letzte Verzeichnis ab; die Konfiguration wird auch unter `.../app` gefunden
- **FIX:** Klick auf einen Hash-Link, der bereits die aktive Seite bezeichnet, rendert die Seite neu (`setupSamePageLinks()`) - das Logo fuehrt damit aus Unteransichten zurueck zur Startseite
- **ENH:** `app/app-base.js` ist wieder byte-identisch zum Template `oda-generic` 1.4.0; app-spezifisches Aufraeumen laeuft ueber den neuen Hook `onPageLeave(page)` in `app/app.js`

## 1.4.0 - 2026-07-24

- **FIX:** Laufzeit-Fehlermeldung wird vor der Anzeige HTML-maskiert (`escapeHtmlForBase`); ein Fehlertext kann kein Markup mehr in die Seite einschleusen (XSS)
- **FIX:** Startseiten-Renderer wird nun `await`et; bei asynchronen Apps erscheint kein kurzzeitiges `[object Promise]` in `#main-content`

## 1.3.0 - 2026-07-23

- **ENH:** Datenabruf auf den Schalter `proxyAktiv` umgestellt; direkte Abrufe sind der Standard, der ODAS-Proxy wird nur noch bei `ja` verwendet
- **ENH:** Einfachen Standalone-Betrieb hinter Traefik mit derselben `odas-config/config.json` wie in der Entwicklung ergänzt
- **ENH:** Traefik-Anbindung auf das externe Netzwerk `proxynet`, den EntryPoint `websecure` und den Zertifikatsresolver `letsencrypt` festgelegt
- **FIX:** Proxy-Basispfad funktioniert jetzt auch bei URLs mit `index.html`; der Ziel-Pfad wird URL-kodiert
- **FIX:** Tabelle wird vor dem Datenabruf gerendert, damit die Zeilen zuverlässig einhängen
- **FIX:** Ladefehler werden sichtbar in der Tabelle gemeldet statt nur auf der Konsole
- **DOC:** Start über `STANDALONE=true make up` dokumentiert

## v1.2.0

- ENH: escapeHtml()-Hilfsfunktion für XSS-Schutz hinzugefügt
- ENH: renderWeitereInfos()-Sektion mit konfigurierbaren weiterführenden Links
- ENH: Datenfrische-Indikator aus HTTP Last-Modified bzw. konfigurierbarem datenStand
- ENH: Beschreibung aktualisiert mit „Für wen ist diese App?“-Abschnitt
- FIX: Doppelte urldaten/urlDaten-Konfigurationsschlüssel entfernt

## 7.11.2024

- ENH: Initial commit

## 21.11.2024

- ENH: Footer hinzugefuegt

## 22.11.2024

- ENH: Screenshots hinzugefügt

## 28.11.2024

- ENH: Daten können über Url importiert werden

## 04.12.2024

- ENH: Mehrere Dateien können jetzt über Api-Url importiert werden
- ENH: CSS komplett überarbeitet mit Bootstrap Grid System

## 05.12.2024

- ENH: Footer CSS angepasst

## 17.02.2025

- ENH: Update auf neue Appstruktur
