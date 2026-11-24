import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const directory = fileURLToPath(new URL("../assets/fonts/", import.meta.url));
const revision = "c971829a87e7920f960e7277c3dafd9bedd3c601";
const source = `https://raw.githubusercontent.com/notofonts/noto-fonts/${revision}/hinted/ttf/NotoSans/`;
const fonts = {
  "NotoSans-Regular.ttf":
    "b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5",
  "NotoSans-Bold.ttf":
    "c976e4b1b99edc88775377fcc21692ca4bfa46b6d6ca6522bfda505b28ff9d6a",
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function hasFont(path, expected) {
  try {
    const font = inflateSync(await readFile(path), {
      maxOutputLength: 1024 * 1024,
    });
    return digest(font) === expected;
  } catch (error) {
    if (
      error.code === "ENOENT" ||
      error.code === "ERR_BUFFER_TOO_LARGE" ||
      error.code?.startsWith("Z_")
    )
      return false;
    throw error;
  }
}

async function prepareFont(name, expected) {
  const filename = `${name}.deflate`;
  const path = join(directory, filename);
  if (await hasFont(path, expected)) return;

  const response = await fetch(new URL(name, source), {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (digest(bytes) !== expected)
    throw new Error(`${name}: unerwartete SHA-256-Prüfsumme.`);

  const temporary = await mkdtemp(join(directory, ".prepare-"));
  try {
    const staged = join(temporary, filename);
    await writeFile(staged, deflateSync(bytes, { level: 9 }));
    await rename(staged, path);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

try {
  await mkdir(directory, { recursive: true });
  await Promise.all(
    Object.entries(fonts).map(([name, expected]) =>
      prepareFont(name, expected),
    ),
  );
} catch (error) {
  console.error(`Noto Sans konnte nicht vorbereitet werden. ${error.message}`);
  process.exitCode = 1;
}
