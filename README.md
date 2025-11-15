# E‑Rechnung Generator – ZUGFeRD/Factur‑X & XRechnung (PDF+XML)

Erstellt vollständig lokal im Browser elektronische Rechnungen als PDF/A‑3b mit eingebettetem XML (EN 16931, Factur‑X/ZUGFeRD‑kompatibel). Keine Server, keine Datenübertragung – alles bleibt im lokalen Browser‑Speicher.

Live ist alles in einer Datei: `index.html`.

## Features
- PDF/A‑3b: Generiert ein PDF mit XMP‑Metadaten und eingebettetem XML (Associated Files)
- XML: CrossIndustryInvoice (EN 16931) für Factur‑X/ZUGFeRD, mit Profilwahl (`EN16931`, `BASIC`, `BASICWL`, `EXTENDED`, `MINIMUM`)
- XRechnung: Baut EN‑16931‑konformes CII; Eignung abhängig von Empfängeranforderungen (keine Zertifizierung)
- Positionen: Mengen, Einheiten (z. B. `C62`, `HUR`), Einzelpreis netto, Rabatt, USt‑Kategorie (`S`, `Z`, `E`, `AE`, `K`) und -Satz
- Summen: Netto/Steuer/Brutto je Währung (`EUR`, `USD`, `GBP`, `CHF`)
- EPC/SEPA‑QR: QR‑Code für Überweisung, wenn IBAN und Betrag vorhanden
- Logo: Optionales Firmenlogo oben rechts im PDF
- Exporte: PDF (mit XML), XML separat, JSON und CSV (Positionen)
- Lokal: Adressbuch (Käufer), Standarddaten (Verkäufer/Zahlung), Historie, Backup/Restore,
  sowie Helfer für fortlaufende Rechnungsnummern

## Schnellstart
1. Datei `index.html` im Browser öffnen (Chrome/Edge/Firefox/Safari)
2. Pflichtfelder ausfüllen (mit `*` markiert)
3. Positionen anlegen und prüfen
4. Mit den Buttons exportieren:
   - „PDF+A‑3 mit eingebettetem XML erzeugen“
   - „XML anzeigen/speichern“
   - „JSON Export“ / „CSV Export“

Tipp: Die Beispieldaten helfen beim Einstieg („Beispieldaten“‑Button).

## Offline & Datenschutz
- 100% lokal: Keine Server, keine Telemetrie, keine Tracker
- Persistenz: Browser `localStorage` unter dem Präfix `invgen_`
  - `invgen_defaults`, `invgen_contacts`, `invgen_history`, `invgen_lastNr`, `invgen_logo`, `invgen_unit`
- Backup/Restore: Gesamten lokalen Datenbestand als JSON sichern/wiederherstellen
- Hinweis: Daten bleiben nur in diesem Browser/Profil. Beim Löschen des Browser‑Speichers sind sie weg.

## Entwicklung
Dieses Projekt ist eine einzelne, statische HTML‑Datei und verwendet CDN‑Bibliotheken:
- `pdf-lib` für PDF‑Erzeugung/Einbettung
- `qrcode` für EPC/SEPA‑QR

Lokal testen (empfohlen über einen kleinen Web‑Server):

```bash
# macOS / zsh
python3 -m http.server 8000
# oder
npx serve .
```

Danach `http://localhost:8000/` im Browser öffnen und `index.html` starten.

Build‑Schritte oder Paketinstallation sind nicht nötig.

## Funktionshinweise
- Profilwahl steuert den in den XMP‑Metadaten gesetzten Conformance‑Level (Factur‑X)
- XML: Erzeugt EN‑16931‑konformes CII (CrossIndustryInvoice) inkl. Adressen, Positionen, USt und Summen
- PDF: Setzt XMP‑Metadaten, sRGB‑ICC‑Profil, bettet das XML als Associated File ein
- EPC‑QR: Wird generiert, wenn IBAN und ein Bruttobetrag > 0 vorliegen; optional BIC, Verwendungszweck
- Logo: Als Data‑URL gespeichert; wird lokal persistent gehalten und ins PDF gerendert

## Grenzen & Haftung
- Keine Zertifizierung: Die Generierung zielt auf EN 16931 / Factur‑X/ZUGFeRD ab, ist aber „best effort“
- XRechnung: Je nach Empfänger/Plattform können zusätzliche Validierungsregeln gelten
- PDF/A‑3b: Best‑Effort‑Erzeugung ohne Gewähr, keine digitale Signatur
- Rundungen/Validierungen: Vereinfachte Berechnungen; fachliche Prüfung liegt beim Anwender
- Keine Rechtsberatung – Nutzung auf eigenes Risiko

## Mitmachen
Fehler gefunden oder Ideen? Issues und PRs sind willkommen.
