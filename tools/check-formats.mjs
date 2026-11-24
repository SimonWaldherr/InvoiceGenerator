import { spawnSync } from "node:child_process";
import { readFile, mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, PDFName } from "pdf-lib";
import { createLocalInvoiceArtifact } from "../src/invoice/export.js";
import { buildLocalPDF } from "../src/invoice/pdf/render.js";
import { draft, loadPdfAssets } from "./invoice-fixtures.mjs";

const configuration = [
  ["KOSIT_JAR", "KoSIT-Validator-JAR"],
  ["KOSIT_CONFIG", "KoSIT-Konfigurationsverzeichnis mit scenarios.xml"],
  ["MUSTANG_JAR", "Mustang-CLI-JAR"],
];

const transparentLogo =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAFUlEQVR4nGM0OlHRwIAGmNAFqCAIAMmOAfwozY6sAAAAAElFTkSuQmCC";
const skontoLine = "#SKONTO#TAGE=10#PROZENT=2.00#";

async function validatorPaths() {
  const paths = {};
  for (const [key, description] of configuration) {
    const value = process.env[key];
    if (!value) throw new Error(`${key} fehlt. Bitte ${description} angeben.`);
    paths[key] = resolve(value);
    const file =
      key === "KOSIT_CONFIG" ? join(paths[key], "scenarios.xml") : paths[key];
    if (!(await stat(file, { throwIfNoEntry: false }))?.isFile()) {
      throw new Error(`${key} verweist auf keine lesbare Datei: ${file}`);
    }
  }
  return paths;
}

function localDrafts() {
  const representative = {
    ...draft,
    meta: { logo: { dataUrl: transparentLogo } },
    header: {
      ...draft.header,
      number: "FORMATTEST-42",
      notes: "Fiktives Beispiel für die Formatprüfung.",
    },
    payment: {
      ...draft.payment,
      bic: "COBADEFFXXX",
      holder: "Muster & Partner",
      remittance: "FORMATTEST-42",
    },
    lines: [
      ...draft.lines,
      ...Array.from({ length: 32 }, (_, index) => ({
        name: `Beratung ${index + 1}`,
        desc: "Analyse, Planung und technische Umsetzung.",
        qty: 2.35,
        price: 120.0075,
        disc: 7.5,
        cat: "S",
        rate: index % 2 === 0 ? 19 : 7,
        unit: "HUR",
      })),
    ],
  };
  const xrechnung = {
    ...representative,
    header: {
      ...representative.header,
      profile: "XRECHNUNG",
      buyerRef: "TEST-K42",
      orderRef: "TEST-PO42",
      businessProcess: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
    },
    seller: {
      ...representative.seller,
      contactName: "Erika Muster",
      phone: "+49 30 123456",
      email: "rechnung@example.com",
      endpointId: "rechnung@example.com",
      endpointScheme: "EM",
    },
    buyer: {
      ...representative.buyer,
      email: "kontakt@example.com",
      phone: "+49 89 123456",
      endpointId: "einkauf@example.com",
      endpointScheme: "EM",
    },
  };
  const reverseCharge = {
    ...xrechnung,
    header: { ...xrechnung.header, currency: "CHF" },
    buyer: { ...xrechnung.buyer, vat: "DE987654321" },
    payment: { ...xrechnung.payment, type: "30" },
    lines: [
      {
        ...draft.lines[0],
        cat: "AE",
        vatExemptionReason: "Reverse charge",
      },
      {
        ...draft.lines[0],
        cat: "E",
        vatExemptionReason: "Steuerbefreit",
      },
    ],
  };
  const skonto = {
    ...xrechnung,
    lines: draft.lines,
    payment: { ...xrechnung.payment, terms: skontoLine },
  };
  const cash = {
    ...xrechnung,
    header: { ...xrechnung.header, dueDate: "" },
    lines: draft.lines,
    payment: { type: "10", terms: "Zahlbar bei Abholung" },
  };
  const registration = {
    ...xrechnung,
    lines: draft.lines,
    seller: {
      ...xrechnung.seller,
      vat: "",
      fc: "123/456/78901",
      reg: "HRB 999",
    },
  };
  return {
    representative,
    variants: [
      ["en16931-cii", "EN16931 (CII)", representative],
      ["xrechnung-cii", "EN16931 XRechnung (CII)", xrechnung],
      [
        "xrechnung-ubl",
        "EN16931 XRechnung (UBL Invoice)",
        {
          ...xrechnung,
          header: { ...xrechnung.header, syntax: "UBL" },
        },
      ],
      ...Object.entries({
        "reverse-charge": reverseCharge,
        skonto,
        cash,
        registration,
      }).flatMap(([name, data]) => [
        [`${name}-cii`, "EN16931 XRechnung (CII)", data],
        [
          `${name}-ubl`,
          "EN16931 XRechnung (UBL Invoice)",
          { ...data, header: { ...data.header, syntax: "UBL" } },
        ],
      ]),
    ],
  };
}

async function runTool(
  directory,
  reportName,
  program,
  args,
  expectedStatus = 0,
) {
  const result = spawnSync(program, args, {
    cwd: directory,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const report = join(directory, reportName);
  const log = report + ".stderr.log";
  await writeFile(report, result.stdout ?? "");
  if (result.stderr) await writeFile(log, result.stderr);
  if (result.error) {
    throw new Error(`${program}: ${result.error.message}`);
  }
  if (result.status !== expectedStatus) {
    throw new Error(
      `${program}: Code ${result.status ?? result.signal}, erwartet ${expectedStatus}. Prüfbericht: ${report}`,
    );
  }
  return result.stdout;
}

function mustangConfirmed(report) {
  const validation = report.match(
    /<validation\b[^>]*>([\s\S]*?)<\/validation>/,
  )?.[1];
  if (!validation || /<(?:error|fatal)\b/i.test(validation)) return false;
  const pdf = validation.match(/<pdf\b[^>]*>([\s\S]*?)<\/pdf>/);
  const xml = validation.match(/<xml\b[^>]*>([\s\S]*?)<\/xml>/);
  if (!pdf || !xml) return false;
  const valid = /<summary\s+status="valid"\s*\/>/;
  const overall = validation.replace(pdf[0], "").replace(xml[0], "");
  return (
    valid.test(pdf[1]) &&
    valid.test(xml[1]) &&
    valid.test(overall) &&
    xml[1].includes("<profile>urn:cen.eu:en16931:2017</profile>")
  );
}

async function checkKositRejections(directory, java, validatorArgs) {
  const syntaxes = [
    ["cii", "ram:DuePayableAmount", "&#10;"],
    ["ubl", "cbc:PayableAmount", "\n"],
  ];
  const cases = syntaxes.flatMap(([syntax, amountTag, lineBreak]) => {
    const amount = new RegExp(
      `(?<open><${amountTag}\\b[^>]*>)[^<]+(?<close></${amountTag}>)`,
    );
    const skonto = skontoLine + lineBreak;
    return [
      [
        `xrechnung-${syntax}`,
        `wrong-payable-${syntax}`,
        "BR-CO-16",
        amount,
        "$<open>0.01$<close>",
      ],
      [
        `skonto-${syntax}`,
        `wrong-skonto-${syntax}`,
        "BR-DE-18",
        skonto,
        skonto + "Bitte #K-42# angeben.",
      ],
    ];
  });
  for (const [source, name, , pattern, replacement] of cases) {
    const xml = await readFile(join(directory, source + ".xml"), "utf8");
    const invalid = xml.replace(pattern, replacement);
    if (invalid === xml) {
      throw new Error(`Kontrollfall ${name} konnte nicht erzeugt werden.`);
    }
    await writeFile(join(directory, name + ".xml"), invalid);
  }

  // The KoSIT CLI returns the number of rejected documents.
  await runTool(
    directory,
    "kosit-rejections.log",
    java,
    [
      ...validatorArgs,
      ...cases.map(([, name]) => join(directory, name + ".xml")),
    ],
    cases.length,
  );
  for (const [, name, rule] of cases) {
    const file = join(directory, name + "-report.xml");
    const report = await readFile(file, "utf8");
    const message = new RegExp(`<rep:message\\b[^>]*code="${rule}"`);
    if (
      !/<rep:assessment>\s*<rep:reject(?:\s|>)/.test(report) ||
      !/<rep:validationStepResult\b[^>]*id="val-xsd"[^>]*valid="true"/.test(
        report,
      ) ||
      !message.test(report)
    ) {
      throw new Error(
        `KoSIT hat ${name} nicht mit ${rule} abgelehnt. Prüfbericht: ${file}`,
      );
    }
    console.log(`KoSIT: ${name} mit ${rule} abgelehnt`);
  }
}

function pdfa3bResult(report) {
  const checks = JSON.parse(report).report?.jobs?.[0]?.validationResult;
  return checks?.find(
    (check) => check.profileName === "PDF/A-3b validation profile",
  );
}

async function checkFerd(directory, java, KOSIT_JAR, embeddedPath, variants) {
  const { FERD_XSD, FERD_XSLT } = process.env;
  if (!FERD_XSD && !FERD_XSLT) return;
  if (!FERD_XSD || !FERD_XSLT) {
    throw new Error(
      "Für die FeRD-Prüfung FERD_XSD und FERD_XSLT zusammen angeben.",
    );
  }

  const files = [embeddedPath];
  for (const [name, , invoice] of variants) {
    if (!["reverse-charge-cii", "cash-cii", "registration-cii"].includes(name))
      continue;
    const draft = {
      ...invoice,
      header: { ...invoice.header, profile: "EN16931" },
    };
    const path = join(directory, `factur-x-${name}.xml`);
    const artifact = await createLocalInvoiceArtifact(draft, "xml");
    await writeFile(path, await artifact.text());
    files.push(path);
  }

  const javaTmp = `-Djava.io.tmpdir=${directory}`;
  const validateXml = fileURLToPath(
    new URL("./ValidateXml.java", import.meta.url),
  );
  await runTool(directory, "ferd-xsd.log", java, [
    javaTmp,
    validateXml,
    resolve(FERD_XSD),
    ...files,
  ]);

  const transform = [
    javaTmp,
    "-cp",
    KOSIT_JAR,
    "net.sf.saxon.Transform",
    `-xsl:${resolve(FERD_XSLT)}`,
  ];
  for (const path of files) {
    const name = basename(path, ".xml");
    const reportPath = join(directory, `${name}-ferd.svrl`);
    await runTool(directory, `${name}-ferd.log`, java, [
      ...transform,
      `-s:${path}`,
      `-o:${reportPath}`,
    ]);
    const report = await readFile(reportPath, "utf8");
    if (
      !/<svrl:fired-rule\b/.test(report) ||
      /<svrl:failed-assert\b/.test(report)
    ) {
      throw new Error(
        `FeRD-Prüfung fehlgeschlagen. Prüfbericht: ${reportPath}`,
      );
    }
    console.log(`FeRD: ${name} besteht XSD und Schematron (EN 16931)`);
  }
}

async function main() {
  const { KOSIT_JAR, KOSIT_CONFIG, MUSTANG_JAR } = await validatorPaths();
  const directory = await mkdtemp(join(tmpdir(), "invoicegenerator-formats."));
  console.log(`Prüfdateien und Berichte: ${directory}`);
  const java = process.env.JAVA_BIN || "java";
  const javaOptions = [`-Djava.io.tmpdir=${directory}`, "-jar"];
  const veraPDF = process.env.VERAPDF_BIN || "verapdf";
  const { representative, variants } = localDrafts();

  for (const [name, , invoice] of variants) {
    const artifact = await createLocalInvoiceArtifact(invoice, "xml");
    await writeFile(join(directory, name + ".xml"), await artifact.text());
  }
  const assets = await loadPdfAssets();
  const pdf = await createLocalInvoiceArtifact(
    representative,
    "pdf",
    (invoice, xml) => buildLocalPDF(invoice, xml, assets),
  );
  const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
  const pdfPath = join(directory, "zugferd.pdf");
  await writeFile(pdfPath, pdfBytes);

  const validatorArgs = [
    ...javaOptions,
    KOSIT_JAR,
    "-s",
    join(KOSIT_CONFIG, "scenarios.xml"),
    "-r",
    KOSIT_CONFIG,
    "-o",
    directory,
  ];
  await runTool(directory, "kosit.log", java, [
    ...validatorArgs,
    ...variants.map(([name]) => join(directory, name + ".xml")),
  ]);
  for (const [name, scenario] of variants) {
    const file = join(directory, name + "-report.xml");
    const report = await readFile(file, "utf8");
    if (
      !report.includes(`>${scenario}</`) ||
      !/<rep:assessment>\s*<rep:accept(?:\s|>)/.test(report)
    ) {
      throw new Error(
        `KoSIT hat ${scenario} nicht bestätigt. Prüfbericht: ${file}`,
      );
    }
    if (
      scenario.startsWith("EN16931 XRechnung") &&
      /\bcode="BR-DE-21"/.test(report)
    ) {
      throw new Error(
        `KoSIT meldet BR-DE-21 für ${name}. Prüfbericht: ${file}`,
      );
    }
    console.log(`KoSIT: ${name} bestätigt (${scenario})`);
  }
  await checkKositRejections(directory, java, validatorArgs);

  const mustangReport = await runTool(directory, "mustang.xml", java, [
    ...javaOptions,
    MUSTANG_JAR,
    "--disable-file-logging",
    "--action",
    "validate",
    "--source",
    pdfPath,
  ]);
  if (!mustangConfirmed(mustangReport)) {
    throw new Error(
      `Mustang hat ZUGFeRD EN 16931 nicht bestätigt. Prüfbericht: ${join(directory, "mustang.xml")}`,
    );
  }
  const embeddedPath = join(directory, "factur-x.xml");
  await runTool(directory, "mustang-extract.log", java, [
    ...javaOptions,
    MUSTANG_JAR,
    "--disable-file-logging",
    "--action",
    "extract",
    "--source",
    pdfPath,
    "--out",
    embeddedPath,
  ]);
  const referenceXml = await readFile(join(directory, "en16931-cii.xml"));
  if (!referenceXml.equals(await readFile(embeddedPath))) {
    throw new Error(
      "Das eingebettete XML stimmt nicht mit dem separaten EN-16931-Export überein.",
    );
  }
  console.log("Mustang: ZUGFeRD EN 16931 und identischer XML-Anhang bestätigt");
  await checkFerd(directory, java, KOSIT_JAR, embeddedPath, variants);

  const veraArgs = ["--flavour", "3b", "--format", "json"];
  const veraReport = await runTool(directory, "verapdf.json", veraPDF, [
    ...veraArgs,
    pdfPath,
  ]);
  if (pdfa3bResult(veraReport)?.compliant !== true) {
    throw new Error(
      `veraPDF hat PDF/A-3b nicht bestätigt. Prüfbericht: ${join(directory, "verapdf.json")}`,
    );
  }
  console.log(
    "veraPDF: PDF/A-3b für die Rechnung mit transparentem Logo bestätigt",
  );

  const withoutMetadata = await PDFDocument.load(pdfBytes, {
    updateMetadata: false,
  });
  withoutMetadata.catalog.delete(PDFName.of("Metadata"));
  const invalidPdf = join(directory, "no-pdfa-metadata.pdf");
  await writeFile(invalidPdf, await withoutMetadata.save());
  const rejection = await runTool(
    directory,
    "verapdf-rejection.json",
    veraPDF,
    [...veraArgs, invalidPdf],
    1,
  );
  const result = pdfa3bResult(rejection);
  if (
    result?.compliant !== false ||
    !result.details?.ruleSummaries?.some(
      (rule) =>
        rule.clause === "6.6.2.1" &&
        rule.testNumber === 1 &&
        rule.status === "failed",
    )
  ) {
    throw new Error(
      `veraPDF hat das PDF ohne XMP-Metadaten nicht als ungültig erkannt. Prüfbericht: ${join(directory, "verapdf-rejection.json")}`,
    );
  }
  console.log("veraPDF hat das PDF ohne XMP-Metadaten zurückgewiesen.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
