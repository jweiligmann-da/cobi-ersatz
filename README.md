# COBI Ersatz V11

Neu in V11:
- Bike-Datenquellen-Schicht
- Demo-Modus bleibt erhalten
- Bike-Daten aus einer JSON-Datei laden
- HTTPS-Bridge anbinden und alle 2 Sekunden aktualisieren
- unterstützte Felder:
  - battery
  - range
  - assist
  - cadence
  - power
  - speed
- Bridge-URL wird lokal gespeichert
- Beispiel `bike-demo.json` enthalten
- alle Navigations-, GPX-, Routen- und Fahrtenfunktionen aus V10.2 bleiben erhalten

Wichtig:
V11 verbindet sich noch nicht direkt mit Bosch-Hardware. Es stellt die Schnittstelle bereit,
über die wir in einem nächsten Schritt echte Bosch/COBI-Daten zuführen können.

Für das normale GitHub-Update reichen weiterhin:
`index.html`, `app.js`, `style.css`, `manifest.json`, `README.md`

Optional zusätzlich:
`bike-demo.json`

Commit-Vorschlag: `COBI Ersatz V11`
