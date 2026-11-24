export const $ = (q) => document.querySelector(q);
export const $$ = (q) => Array.from(document.querySelectorAll(q));
export function today(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    padNum(date.getMonth() + 1, 2),
    padNum(date.getDate(), 2),
  ].join("-");
}
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function padNum(n, len) {
  return String(n).padStart(len, "0");
}
export function nextInvoiceNumber(s) {
  if (!s) return "RE-" + new Date().getFullYear() + "-0001";
  const m = s.match(/(.*?)(\d+)(\D*)$/);
  if (!m) return s + "-0001";
  const prefix = m[1],
    num = m[2],
    suffix = m[3];
  return prefix + padNum(parseInt(num, 10) + 1, num.length) + suffix;
}
export function ibanClean(v) {
  return (v || "").replace(/\s+/g, "").toUpperCase();
}
