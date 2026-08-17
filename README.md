# COBI Ersatz V4.1

Diese Version behebt den GPX-Dateiimport auf dem iPhone.

Änderung:
- Kein `accept=.gpx` Filter mehr im iOS-Dateidialog.
- Dadurch bleiben GPX-Dateien auf dem iPhone nicht mehr wegen des Dateityp-Filters grau.
- Die App prüft nach der Auswahl selbst, ob die Datei gültigen GPX/XML-Inhalt enthält.
- Reststrecke, Routenabweichung, Auto-Folgen und Richtungswechsel aus V4 bleiben erhalten.

## GitHub-Update
Die fünf Dateien `index.html`, `app.js`, `style.css`, `manifest.json` und `README.md`
im bestehenden Repository hochladen und die vorhandenen Dateien ersetzen.
Commit-Vorschlag: `COBI Ersatz V4.1`
