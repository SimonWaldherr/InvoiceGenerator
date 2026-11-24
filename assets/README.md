# Ressourcen für PDF/A

Der Build bindet `sRGB2014.icc` und zwei verlustfrei komprimierte Noto-Sans-Schriften in das PDF-Bundle ein. Beim ersten Build oder Test werden die Schriften aus einem festen Upstream-Commit geladen, per SHA-256 geprüft und unter `fonts/` lokal zwischengespeichert. Das Paket enthält die Schriften und lässt sich offline verwenden. Das Farbprofil dient als OutputIntent. [Herkunft und Lizenzen](../THIRD_PARTY_NOTICES.txt)
