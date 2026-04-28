# ODAS App Telefonbuch

Telefonbuch-App für den Open Data App-Store (ODAP)

Die App zeigt Kontakte (Name,Stelle,Tel-Nr) an.

Die App ist eine "ODAP App V1".

## Funktionen

- Anzeie Kontakte (sortierbar, suchbar, Tel-Direktlinks)
- Anzeige Header + Burgermenü
- getestet auf mobile & Desktop

## Entwicklung

### Aufbau der App

- CSS: Bootstrap 5.3
- Datentabelle mit Datatables: https://cdn.datatables.net/1.11.5/js/jquery.dataTables.min.js

#### Desktop Version

![Alt-Text](/assets/Desktop_Screenshot.png)

#### Mobile Version

![Alt-Text](/assets/Mobile_Screenshot.png)

### Start der App

    $ make build up
    $ curl http://localhost:8083

## Autor

(C) 2025, Ondics GmbH
