# Changelog

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
