import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "invoicegenerator-package-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "tools"));
  await copyFile(
    new URL("../tools/package.mjs", import.meta.url),
    join(root, "tools/package.mjs"),
  );
  const files = {
    "package.json": JSON.stringify({
      scripts: { bundle: "node compiler.mjs" },
    }),
    "compiler.mjs": `
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const output = process.argv[2].slice("--outdir=".length);
await mkdir(output, { recursive: true });
await writeFile(join(output, "script.js"), "new editor");
if (process.env.INVOICE_PACKAGE_TEST_COMPILER === "fail") process.exit(7);
if (process.env.INVOICE_PACKAGE_TEST_COMPILER !== "incomplete") {
  await writeFile(join(output, "pdf-export.js"), "new PDF renderer");
}
`,
    "index.html": "new page",
    "style.css": "new stylesheet",
    "THIRD_PARTY_NOTICES.txt": "licenses",
    "tools/legacy-entry.html": "redirect",
  };
  await Promise.all(
    Object.entries(files).map(([path, text]) =>
      writeFile(join(root, path), text),
    ),
  );
  return root;
}

function build(root, compiler = "ok") {
  const result = spawnSync(process.execPath, ["tools/package.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, INVOICE_PACKAGE_TEST_COMPILER: compiler },
  });
  if (result.error) throw result.error;
  return result;
}

test("packaging replaces stale generated files and includes all entry points", async (t) => {
  const root = await fixture(t);
  const release = join(root, "release");
  await mkdir(release);
  await writeFile(join(release, "stale.html"), "unused");
  await writeFile(join(root, "outside.txt"), "keep me");
  await symlink("../outside.txt", join(release, "stale-link"));

  const result = build(root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await readdir(release)).sort(), [
    ".nojekyll",
    "THIRD_PARTY_NOTICES.txt",
    "dist",
    "index-mobile.html",
    "index.html",
    "index_og.html",
    "mobile-accordion.html",
    "mobile-v2.html",
    "modern-index.html",
    "new-index.html",
    "style.css",
  ]);
  assert.deepEqual((await readdir(join(release, "dist"))).sort(), [
    "pdf-export.js",
    "script.js",
  ]);
  assert.equal(
    await readFile(join(release, "index-mobile.html"), "utf8"),
    "redirect",
  );
  assert.equal(await readFile(join(root, "outside.txt"), "utf8"), "keep me");
  assert.ok(
    (await readdir(root)).every((name) => !name.startsWith(".release-")),
  );
});

test("a failed build, incomplete bundle or missing input preserves the preceding release", async (t) => {
  const root = await fixture(t);
  const release = join(root, "release");
  await mkdir(join(release, "dist"), { recursive: true });
  await writeFile(join(release, "index.html"), "previous page");
  await writeFile(join(release, "dist/script.js"), "previous editor");

  const failed = build(root, "fail");
  assert.equal(failed.status, 1, failed.stderr);
  assert.match(failed.stderr, /Browser-Build endete mit 7/);

  const incomplete = build(root, "incomplete");
  assert.equal(incomplete.status, 1, incomplete.stderr);
  assert.match(incomplete.stderr, /pdf-export\.js/);

  await rm(join(root, "style.css"));
  const missing = build(root);
  assert.equal(missing.status, 1, missing.stderr);
  assert.match(missing.stderr, /style\.css/);

  assert.deepEqual((await readdir(release)).sort(), ["dist", "index.html"]);
  assert.deepEqual(await readdir(join(release, "dist")), ["script.js"]);
  assert.equal(
    await readFile(join(release, "index.html"), "utf8"),
    "previous page",
  );
  assert.equal(
    await readFile(join(release, "dist/script.js"), "utf8"),
    "previous editor",
  );
  assert.ok(
    (await readdir(root)).every((name) => !name.startsWith(".release-")),
  );
});

test("packaging leaves a symlink at release/ and its target intact", async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, "outside"));
  await writeFile(join(root, "outside/notes.txt"), "keep me");
  await symlink("outside", join(root, "release"));

  const result = build(root);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /regulärer Ordner/);
  assert.equal(await readlink(join(root, "release")), "outside");
  assert.deepEqual(await readdir(join(root, "outside")), ["notes.txt"]);
  assert.ok(
    (await readdir(root)).every((name) => !name.startsWith(".release-")),
  );
});
