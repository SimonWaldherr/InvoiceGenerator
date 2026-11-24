# InvoiceGenerator

InvoiceGenerator erstellt XRechnungen und ZUGFeRD-Rechnungen direkt im Browser. Die statische Seite funktioniert auf GitHub Pages und als heruntergeladenes Offline-Paket. Die Anwendung überträgt keine Rechnungsdaten. Zum Öffnen vorhandener E-Rechnungen gibt es den [InvoiceInspector](https://github.com/SimonWaldherr/InvoiceInspector).

## Starten und bereitstellen

```sh
npm ci
npm start
```

Die Oberfläche ist unter [127.0.0.1:8081](http://127.0.0.1:8081) erreichbar. „Beispieldaten laden“ füllt einen fiktiven Entwurf für das gewählte Profil aus.

Der erste Build oder Test lädt die PDF-Schriften aus einer festgelegten Noto-Sans-Quelle und prüft ihre SHA-256-Prüfsummen. Mit gefülltem Schriftcache funktionieren auch Build und Tests offline. [PDF-Ressourcen](assets/README.md)

Die Oberfläche lässt sich auf Deutsch oder Englisch bedienen. Unter **PDF-Gestaltung** lässt sich die Sprache des Rechnungsbilds separat wählen. Sie bestimmt Beschriftungen, Datums- und Zahlenanzeige im PDF. Das eingebettete XML behält sein standardisiertes Format.

`npm run package` (oder `make package`) ersetzt den generierten Ordner `release/` erst nach einem erfolgreichen Build durch ein vollständiges Paket. Falls der Build fehlschlägt, bleibt das bisherige Paket erhalten. Der Ordner dient als Webroot für GitHub Pages, etwa im `gh-pages`-Branch. Frühere Layout-URLs leiten dort zum aktuellen Editor weiter. Für den Offline-Einsatz den ganzen Ordner zusammenhalten und `release/index.html` direkt öffnen. Das PDF-Modul wird beim ersten PDF-Export geladen. [GitHub Pages aus einem Branch veröffentlichen](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-from-a-branch)

## Formate und Eingaben

| Profil | Ausgabe |
| --- | --- |
| EN 16931 | ZUGFeRD-PDF (PDF/A-3b mit eingebettetem CII-XML) oder CII-XML |
| XRechnung 3.0 | XML in CII oder UBL 2.1 |

Der Editor prüft Pflichtangaben, Datumswerte, IBAN, Beträge, Steuerkategorien und bekannte Länder- und Adresscodes. Die Formatkonformität der erzeugten Dateien wird bei der Entwicklung separat geprüft. Für XRechnung sind Käuferreferenz, Geschäftsprozesskennung, Verkäuferkontakt und elektronische Adressen beider Parteien mit Adressschema erforderlich.

Unterstützt sind positive Rechnungen mit Positionsrabatten, die Steuerkategorien S, Z, E und AE sowie Überweisung und Barzahlung. Mengen und Preise erlauben bis zu vier Nachkommastellen. Steuern werden je Steuersatz aus der aufsummierten Bemessungsgrundlage berechnet. Das PDF verwendet ein festes Layout mit eingebetteten Schriften, optionalem PNG- oder JPEG-Logo und einstellbarer Akzentfarbe.

Entwürfe, Kontakte, Vorlagen und die Historie können lokal im Browser-Profil gespeichert werden. JSON-Entwürfe, JSON-Backups und CSV-Positionsdaten lassen sich als Dateien sichern. Der Editor prüft die Struktur importierter Dateien vor dem Einspielen. Bei bestehenden Daten ersetzt der Backup-Import die in der Sicherung enthaltenen Bereiche. Die Seite erlaubt Skripte aus der eigenen Auslieferung und sperrt Verbindungsanfragen aus dem Editor per Content Security Policy.

## Wiederkehrende Rechnungen

- Unter **Standards konfigurieren** Rechnungsprofil, Syntax, Währung, Firmenprofil und Zahlungsvorgaben speichern. Der Editor verwendet sie beim Start und beim Zurücksetzen. Beim Öffnen eines gespeicherten Entwurfs gelten dessen eigene Angaben.
- In der **Historie** nach Rechnungsnummer oder Kunde suchen und gespeicherte Entwürfe laden, als JSON sichern oder kopieren. Kopien erhalten das heutige Rechnungsdatum und leere Felder für Rechnungsnummer, Leistungsdatum, Fälligkeit, Bestellreferenz und Verwendungszweck. Der CSV-Export enthält die gesamte lokale Liste mit Währungen.
- Auch beim Laden einer **Rechnungsvorlage** beginnt ein neuer Entwurf mit diesen leeren Feldern. Der Vorlagenimport ergänzt die Liste. Gleichnamige Vorlagen oder die gesamte Liste werden nach Bestätigung ersetzt.
- Unter **Entwurfsdaten** einen vollständigen Entwurf als JSON austauschen oder nur Positionen als CSV übernehmen. Der CSV-Import liest UTF-8-Dateien mit Komma oder Semikolon und deutschen oder englischen Spaltennamen. Eine exportierte Positionsdatei dient als Vorlage. Der Editor berechnet Summen aus den importierten Positionsdaten und fragt vor dem Ersetzen nach.
- Regelmäßig ein **Backup des lokalen Speichers** herunterladen. Es enthält auch die gespeicherten Vorgaben für neue Entwürfe. Einen aktuell bearbeiteten Entwurf zuerst in die Historie speichern oder separat als JSON herunterladen.

## Stammdaten

Firmenprofile und Käuferkontakte lassen sich oberhalb der jeweiligen Rechnungsfelder suchen und übernehmen. Zum Erfassen zuerst die Felder der Rechnung ausfüllen, dann unter **Firmenprofil speichern** oder **Käuferkontakt speichern** zwischen **Neu speichern** und **Auswahl aktualisieren** wählen. Gespeicherte Rechnungen behalten die Daten ihres Entwurfs.

- **Firmenprofile** speichern Verkäufer- und Zahlungsdaten. Eine eigene Profilbezeichnung hilft, mehrere Profile unter demselben Firmennamen zu unterscheiden. Beim Übernehmen werden auch die Zahlungsdaten aus dem Profil gesetzt. Ist eine automatische Standardvorlage gewählt, entsteht daraus ein neuer Entwurf mit den Daten des gewählten Verkäufers.
- **Käuferkontakte** speichern auch Kontaktangaben und bei Bedarf eine feste Käuferreferenz wie eine Leitweg-ID. Beim Übernehmen wird die Käuferreferenz aus dem Kontakt eingesetzt oder bei leerer Vorgabe geleert. Die Bestellreferenz wird weiterhin für die einzelne Rechnung erfasst.

Unter **Sichern und importieren** gibt es getrennte JSON-Dateien für Firmenprofile und Käuferkontakte. Die Vorschau zeigt neue Datensätze, identische Einträge und Konflikte. Der Import ergänzt nur neue Datensätze. Firmenprofile werden anhand ihrer Bezeichnung abgeglichen, Käuferkontakte anhand von Name und fester Käuferreferenz oder Adresse. Die Profildatei enthält nur die Verweise auf Standardvorlagen. Die Vorlagen selbst werden separat exportiert.

## Einsatz im Produktivbetrieb

Teste InvoiceGenerator zuerst mit repräsentativen Rechnungsfällen aus deinem eigenen Prozess. Prüfe die erzeugten Dateien mit einem externen Validator und teste den Import im Zielsystem. Kontrolliere vor dem Versand insbesondere Pflichtangaben, Steuerbehandlung, Beträge und Empfängerreferenzen. Nummernvergabe, fachliche Freigabe, Versand und Archivierung bleiben Aufgaben des Rechnungsprozesses.

Bei der Entwicklung wurden folgende Prüfungen durchgeführt:

- **KoSIT** akzeptierte elf reguläre XML-Beispiele für EN 16931 und XRechnung in den unterstützten Syntaxen. Vier fehlerhafte Kontrollfälle mit falschem Zahlbetrag oder ungültiger Skontoangabe wurden wie erwartet abgelehnt.
- **Mustang und veraPDF** bestätigten für eine ZUGFeRD-Beispielrechnung mit transparentem Logo das Profil EN 16931, den XML-Anhang und die PDF/A-3b-Konformität. Der eingebettete XML-Anhang stimmte bytegenau mit dem separaten XML-Export überein. veraPDF erkannte eine Kontrollkopie ohne XMP-Metadaten als ungültig.
- **JavaScript- und Browser-Tests** deckten unter anderem Betragsberechnung, Eingabeprüfung und Entwurfsimport ab. Die Exporte wurden auch offline in Chromium, Firefox und WebKit getestet.

Die Formatprüfungen laufen in der Entwicklungsumgebung anhand von Beispieldateien. Für die Richtigkeit, Vollständigkeit oder Konformität einzelner erzeugter Rechnungen sowie deren Annahme durch ein Empfängersystem wird keine Gewähr übernommen.

## Entwickeln und Formate prüfen

`npm run build` baut die beiden Browser-Bundles. `make dev` stellt die Seite mit automatisch aktualisierten Bundles und Sourcemaps bereit. `npm test` führt die JavaScript-Tests aus.

`src/index.js` startet den Editor. `src/ui/` enthält Formular, Vorschau und Ablage. `src/invoice/` enthält Rechnungsdaten, Berechnungen und die XML- und PDF-Generatoren. `tools/` enthält die separate Formatprüfung. Git versioniert den Quellcode und die genutzten Ressourcen. `dist/` und `release/` entstehen beim Build.

Der Browser-Build zielt auf ES2020. Der PDF-Export verwendet `pdf-lib` mit Fontkit 2 für eingebettete Schrift-Teilmengen. Beim Erstellen des statischen Pakets werden die [Drittanbieterhinweise](THIRD_PARTY_NOTICES.txt) mitgeliefert.

`npm run test:formats` erzeugt Beispieldateien über denselben Exportcode wie der Browser. KoSIT prüft die drei XML-Varianten, Mustang das ZUGFeRD-PDF und dessen eingebettetes XML, und veraPDF prüft das PDF mit transparentem Logo auf PDF/A-3b. Kontrollfälle prüfen außerdem, ob KoSIT falsche Zahlbeträge und ungültige Skontoangaben ablehnt und ob veraPDF fehlende PDF/A-Metadaten erkennt. Die Werkzeuge laufen ausschließlich in der Entwicklungsumgebung. Die Dateien und Berichte landen in einem temporären Ordner.

```sh
KOSIT_JAR=/pfad/validator-1.6.3-standalone.jar \
KOSIT_CONFIG=/pfad/zur/entpackten-kosit-konfiguration \
MUSTANG_JAR=/pfad/Mustang-CLI-2.26.0.jar \
npm run test:formats
```

`KOSIT_CONFIG` bezeichnet den Ordner mit `scenarios.xml` und den Regeldateien. `java` und `verapdf` müssen verfügbar sein. Abweichende Programme lassen sich über `JAVA_BIN` und `VERAPDF_BIN` angeben. Getestet mit [KoSIT 1.6.3](https://github.com/itplr-kosit/validator/releases/tag/v1.6.3), der [XRechnung-Konfiguration vom 31.08.2026](https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/tag/v2026-08-31), [Mustang 2.26.0](https://www.mustangproject.org/commandline/) und [veraPDF 1.30.0](https://verapdf.org/software/).

Gib für die zusätzliche Prüfung nach **ZUGFeRD 2.5.2 / Factur-X 1.09.2** beim selben Aufruf `FERD_XSD` und `FERD_XSLT` an. Beide Variablen verweisen auf die EN-16931-Dateien `Factur-X_EN16931.xsd` und `FACTUR-X_EN16931.xslt` aus dem entpackten Release. Die mitgelieferten Schema- und Codelistendateien bleiben an ihren relativen Pfaden. Der Test nutzt ein JDK und den bereits im KoSIT-JAR enthaltenen Saxon-Prozessor. Er prüft den aus dem PDF extrahierten XML-Anhang sowie XML-Beispiele für Barzahlung, Reverse Charge mit Steuerbefreiung und Verkäuferregistrierung. [FeRD-Release 2.5.2](https://www.ferd-net.de/publikationen-produkte/publikationen/detailseite/zugferd-252-deutsch) · [Artefakte des Mitherausgebers FNFE-MPE, Release v1.4.0.03](https://github.com/fnfempe/France_RFE/releases/tag/v1.4.0.03)

## Lizenz

Für InvoiceGenerator wurde noch keine Projektlizenz festgelegt. Für eine Nutzung oder Weitergabe bitte die Rechte direkt mit dem Projektinhaber klären. Laufzeitbibliotheken und Schriften haben eigene [Drittanbieterhinweise](THIRD_PARTY_NOTICES.txt).
