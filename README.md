# E-Rechnung Generator

A web-based invoice generator for creating compliant electronic invoices according to ZUGFeRD/Factur-X (EN 16931) and XRechnung standards.

## Features

- 🧾 **ZUGFeRD/Factur-X Compliant**: Generate invoices following EN 16931 standard
- 📄 **PDF/A-3b Format**: Creates archival-quality PDF documents
- 📎 **Embedded XML**: Invoice data embedded as structured XML within the PDF
- 🔢 **Multiple Profiles**: Support for EN16931, BASIC, BASIC WL, EXTENDED, and MINIMUM profiles
- 💶 **Multi-Currency Support**: EUR, USD, GBP, CHF, and more
- 🧮 **Automatic Calculations**: Real-time calculation of totals, taxes, and line items
- 📱 **EPC QR Code**: Generate SEPA payment QR codes (Girocode)
- 💼 **VAT Categories**: Support for standard, zero-rated, exempt, reverse charge, and small business schemes
- 📤 **Export Options**: Export as PDF+XML, XML-only, JSON, or CSV
- 🎨 **Clean Interface**: Modern, responsive UI that works on desktop and mobile
- 💾 **No Backend Required**: Runs entirely in the browser - no server needed
- 🔒 **Privacy Friendly**: All data processing happens locally in your browser

## Usage

### Quick Start

1. Open `index.html` in a modern web browser
2. Fill in the invoice details:
   - Invoice number and date (required)
   - Seller information (required)
   - Buyer information (required)
   - Line items with products/services
3. Click "PDF+A-3 mit eingebettetem XML erzeugen" to generate the invoice
4. The PDF will be downloaded automatically

### Sample Data

Click the "Beispieldaten" (Sample Data) button to load example invoice data and see how the generator works.

### Invoice Profiles

The generator supports multiple ZUGFeRD/Factur-X profiles:

- **EN16931**: European standard for electronic invoices (recommended)
- **BASIC**: Simplified profile for basic invoices
- **BASIC WL**: BASIC profile without line items
- **EXTENDED**: Extended profile with additional features
- **MINIMUM**: Minimal invoice profile

### VAT Categories

Supported VAT categories:
- **S**: Standard rate (Standardbesteuert)
- **Z**: Zero-rated (Nullsteuer)
- **E**: Exempt from VAT (Steuerbefreit)
- **AE**: Reverse charge (Reverse Charge)
- **K**: Small business scheme (Kleinunternehmer)

### Payment Methods

Supported payment method codes:
- **58**: SEPA credit transfer
- **59**: SEPA direct debit
- **30**: Credit transfer
- **49**: Direct debit
- **48**: Card payment

## Technical Details

### Technologies Used

- **PDF Generation**: [pdf-lib](https://pdf-lib.js.org/) - Create PDF/A-3b documents
- **QR Codes**: [qrcode](https://github.com/soldair/node-qrcode) - Generate EPC/SEPA QR codes
- **Pure JavaScript**: No build tools or dependencies required

### Standards Compliance

This generator creates invoices compliant with:

- **ZUGFeRD**: German standard for electronic invoices
- **Factur-X**: Franco-German standard (ZUGFeRD 2.0)
- **EN 16931**: European standard for electronic invoicing
- **XRechnung**: German XRechnung format (via EN 16931)
- **PDF/A-3b**: ISO 19005-3 archival format

### XML Structure

The embedded XML follows the Cross Industry Invoice (CII) format from UN/CEFACT, which is the basis for ZUGFeRD and Factur-X invoices.

## Related Projects

### InvoiceInspector - ZUGFeRD Reader

Looking to read and validate ZUGFeRD/Factur-X invoices? Check out [InvoiceInspector](https://github.com/SimonWaldherr/InvoiceInspector) - a complementary tool for reading and inspecting ZUGFeRD electronic invoices.

## Installation

No installation required! Simply download or clone this repository and open `index.html` in your browser:

```bash
git clone https://github.com/SimonWaldherr/InvoiceGenerator.git
cd InvoiceGenerator
# Open index.html in your browser
```

Or use it directly by hosting it on any web server or opening the HTML file locally.

## Browser Compatibility

Works in all modern browsers that support:
- ES6+ JavaScript
- HTML5 Canvas
- PDF generation via pdf-lib
- FileReader API

Tested on:
- Chrome/Edge (Chromium) 90+
- Firefox 88+
- Safari 14+

## Progressive Web App (PWA)

The generator includes PWA support, allowing you to:
- Install it as a standalone app
- Use it offline after the first visit
- Access it from your device's home screen

## Export Formats

### PDF with Embedded XML
The main output format - a visually formatted PDF invoice with the structured XML data embedded for machine processing.

### XML Only
Export just the ZUGFeRD/Factur-X XML file for integration with accounting systems.

### JSON
Export invoice data as JSON for use in other applications or for backup purposes.

### CSV
Export line items as CSV for use in spreadsheet applications.

## Privacy & Security

- ✅ All processing happens in your browser
- ✅ No data is sent to any server
- ✅ No cookies or tracking
- ✅ Works completely offline (after first load)

## License

This project is provided as open source. Please check the repository for the specific license terms.

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/SimonWaldherr/InvoiceGenerator).

---

**Made with ❤️ for easier electronic invoicing**
