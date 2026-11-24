import { $ } from "../utils.js";
import { notifyDraftChange } from "./draft-form.js";
import { readParty, writeField, writeParty } from "./invoice-fields.js";
import { isContact } from "./import-data.js";
import { localeChangeEvent, tr } from "./i18n.js";
import {
  masterRecordOptions,
  sameRecord,
  toggleQuickPick,
} from "./master-records.js";
import { notify } from "./notify.js";
import { readStoredList, storageKeys, writeStored } from "./storage.js";

function getContacts() {
  return readStoredList(storageKeys.contacts, isContact);
}

export function initContacts() {
  const reference = $("#contactBuyerRef");
  const status = $("#contactStatus");
  let message;
  function show(text) {
    message = text;
    status.textContent = text();
  }

  const quickPick = $("#contactQuickPick");
  const picker = masterRecordOptions({
    select: $("#contactSelect"),
    search: $("#contactSearch"),
    records() {
      const list = getContacts();
      toggleQuickPick(quickPick, $("#contactSearch"), list.length);
      return list;
    },
    onSelection(contact) {
      reference.value = contact?.buyerRef ?? "";
      for (const id of [
        "#btnLoadContact",
        "#btnUpdateContact",
        "#btnDelContact",
      ]) {
        $(id).disabled = !contact;
      }
    },
  });
  picker.refresh();

  function changeContact(previous, next, fields) {
    const list = getContacts();
    const index = previous
      ? list.findIndex((contact) => sameRecord(contact, previous))
      : -1;
    if (previous && index < 0) {
      picker.refresh();
      show(() =>
        tr(
          "Der Käuferkontakt wurde inzwischen geändert.",
          "The buyer contact has changed.",
        ),
      );
      return false;
    }
    const duplicate =
      next &&
      list.some(
        (contact, i) =>
          i !== index &&
          Object.entries(fields).every(([key, value]) => {
            const stored = String(
              contact[key] ?? (key === "country" ? "DE" : ""),
            ).trim();
            return (
              (key === "country" ? stored.toUpperCase() : stored) === value
            );
          }),
      );
    if (duplicate) {
      show(() =>
        tr(
          "Dieser Käuferkontakt ist bereits gespeichert.",
          "This buyer contact is already saved.",
        ),
      );
      return false;
    }
    if (index < 0) list.push(next);
    else if (next) list[index] = next;
    else list.splice(index, 1);
    return writeStored(storageKeys.contacts, list);
  }

  function saveContact(previous) {
    const fields = { ...readParty("buyer"), buyerRef: reference.value.trim() };
    const next = { ...previous, ...fields };
    if (!next.name || !isContact(next)) {
      show(() =>
        tr(
          "Bitte den Namen im Käuferfeld eintragen.",
          "Enter the name in the buyer field.",
        ),
      );
      $("#buyerName").focus();
      return;
    }
    if (
      previous &&
      !confirm(
        tr(
          `Käuferkontakt „${previous.name}“ aktualisieren?`,
          `Update buyer contact “${previous.name}”?`,
        ),
      )
    )
      return;
    if (!changeContact(previous, next, fields)) return;
    $("#contactSearch").value = "";
    picker.refresh(next);
    show(() => tr("Käuferkontakt gespeichert.", "Buyer contact saved."));
  }

  $("#btnSaveContact").addEventListener("click", () => saveContact());
  $("#btnUpdateContact").addEventListener("click", () => {
    const contact = picker.selected();
    if (contact) saveContact(contact);
  });
  $("#btnLoadContact").addEventListener("click", () => {
    const contact = picker.selected();
    if (!contact) return;
    writeParty("buyer", contact);
    writeField("buyerRef", contact.buyerRef);
    notifyDraftChange();
    const applied = () =>
      tr(
        `Käuferkontakt „${contact.name}“ übernommen.`,
        `Applied buyer contact “${contact.name}”.`,
      );
    show(applied);
    notify(applied());
  });
  $("#btnDelContact").addEventListener("click", () => {
    const contact = picker.selected();
    if (
      !contact ||
      !confirm(
        tr(
          `Käuferkontakt „${contact.name}“ löschen?`,
          `Delete buyer contact “${contact.name}”?`,
        ),
      )
    )
      return;
    if (!changeContact(contact)) return;
    picker.refresh();
    show(() => tr("Käuferkontakt gelöscht.", "Buyer contact deleted."));
  });
  document.addEventListener(localeChangeEvent, () => {
    picker.refresh();
    if (message) status.textContent = message();
  });
  document.addEventListener("invoice-drafts-change", () => picker.refresh());
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === storageKeys.contacts)
      picker.refresh();
  });
}
