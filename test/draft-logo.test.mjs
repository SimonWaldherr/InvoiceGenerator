import assert from "node:assert/strict";
import { test } from "node:test";
import { getLogo, getSavedLogo, initLogo, setLogo } from "../src/ui/logo.js";
import { storageKeys } from "../src/ui/storage.js";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6TEHdwAAAAASUVORK5CYII=";

function useLogoFields(t, saved) {
  let image;
  let handleFile;
  let reader;
  const input = {
    files: [],
    addEventListener: (type, handler) => {
      handleFile = handler;
    },
  };
  const fields = {
    "#logoPreview": {
      replaceChildren: (element) => {
        image = element;
      },
    },
    "#logoFile": input,
    "#btnSaveLogo": {},
    "#btnClearLogo": {},
  };
  class FileReader {
    readAsDataURL() {
      reader = this;
    }
  }
  const globals = {
    document: {
      querySelector: (id) => fields[id],
      addEventListener() {},
      createElement: (tag) => ({ tag }),
    },
    localStorage: {
      getItem: (key) =>
        key === storageKeys.logo && saved ? JSON.stringify(saved) : null,
    },
    FileReader,
  };
  for (const [key, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    });
  }
  return {
    get preview() {
      return image;
    },
    selectFile() {
      input.files = [{ name: "new.png", type: "image/png", size: 100 }];
      return handleFile({ target: input });
    },
    finishRead() {
      reader.result = png;
      reader.onload();
    },
  };
}

test("keeps draft and saved logos separate and copies editable logo data", (t) => {
  const saved = { dataUrl: png, name: "default.png" };
  const fields = useLogoFields(t, saved);
  setLogo(getSavedLogo());
  assert.deepEqual(getLogo(), saved);
  assert.equal(fields.preview.src, png);

  const draft = { dataUrl: png, name: "issuer.png", type: "image/png" };
  setLogo(draft);
  draft.name = "changed.png";
  const exported = getLogo();
  exported.dataUrl = "";
  assert.deepEqual(getLogo(), {
    dataUrl: png,
    name: "issuer.png",
    type: "image/png",
  });

  setLogo(null);
  assert.equal(getLogo(), null);
  assert.equal(fields.preview.textContent, "Kein Logo");
  assert.deepEqual(getSavedLogo(), saved);
  setLogo(getSavedLogo());
  assert.deepEqual(getLogo(), saved);
});

test("an earlier logo selection cannot replace the logo of a newly loaded draft", async (t) => {
  const fields = useLogoFields(t);
  const onChange = t.mock.fn();
  initLogo(onChange);
  setLogo({ dataUrl: png, name: "first.png" });

  const pending = fields.selectFile();
  setLogo(null);
  fields.finishRead();
  await pending;

  assert.equal(getLogo(), null);
  assert.equal(onChange.mock.callCount(), 0);

  const next = fields.selectFile();
  fields.finishRead();
  await next;
  assert.equal(getLogo().name, "new.png");
  assert.equal(onChange.mock.callCount(), 1);
});
