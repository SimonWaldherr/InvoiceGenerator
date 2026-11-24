import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const release = join(root, "release");
const lock = join(root, ".release-package-lock");
const legacyPages = [
  "index-mobile.html",
  "index_og.html",
  "mobile-accordion.html",
  "mobile-v2.html",
  "modern-index.html",
  "new-index.html",
];

function copy(source, destination) {
  copyFileSync(join(root, source), destination);
  chmodSync(destination, 0o644);
}

function buildPackage(staged) {
  const output = join(staged, "dist");
  const build = spawnSync(
    "npm",
    ["run", "bundle", "--", `--outdir=${output}`, "--minify"],
    { cwd: root, stdio: "inherit" },
  );
  if (build.error) throw build.error;
  if (build.status !== 0) {
    throw new Error(
      `Der Browser-Build endete mit ${build.signal ?? build.status}.`,
    );
  }
  for (const file of ["script.js", "pdf-export.js"]) {
    const bundle = lstatSync(join(output, file), { throwIfNoEntry: false });
    if (!bundle?.isFile() || bundle.size === 0) {
      throw new Error(`Im Browser-Build fehlt dist/${file}.`);
    }
  }
  for (const file of ["index.html", "style.css", "THIRD_PARTY_NOTICES.txt"]) {
    copy(file, join(staged, file));
  }
  for (const page of legacyPages)
    copy("tools/legacy-entry.html", join(staged, page));
  writeFileSync(join(staged, ".nojekyll"), "");
}

function publish(staged, previous) {
  try {
    mkdirSync(lock);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    throw new Error(`Ein anderer Paketbau verwendet ${lock}.`);
  }

  try {
    const existing = lstatSync(release, { throwIfNoEntry: false });
    if (existing && !existing.isDirectory()) {
      throw new Error("release/ muss ein regulärer Ordner sein.");
    }
    if (
      existing &&
      lstatSync(join(release, ".git"), { throwIfNoEntry: false })
    ) {
      throw new Error("release/ ist ein Git-Arbeitsverzeichnis.");
    }
    if (existing) renameSync(release, previous);
    try {
      renameSync(staged, release);
    } catch (error) {
      if (existing && !lstatSync(release, { throwIfNoEntry: false })) {
        renameSync(previous, release);
      }
      throw error;
    }
  } finally {
    rmdirSync(lock);
  }
}

function packageRelease() {
  const stagingArea = mkdtempSync(join(root, ".release-stage-"));
  const staged = join(stagingArea, "new");
  const previous = join(stagingArea, "previous");
  let published = false;
  try {
    buildPackage(staged);
    publish(staged, previous);
    published = true;
  } finally {
    if (published || !lstatSync(previous, { throwIfNoEntry: false })) {
      rmSync(stagingArea, { recursive: true, force: true });
    } else {
      console.error(`Das bisherige Paket liegt weiterhin unter ${previous}.`);
    }
  }
}

try {
  packageRelease();
} catch (error) {
  console.error(`Paket konnte nicht erstellt werden. ${error.message}`);
  process.exitCode = 1;
}
