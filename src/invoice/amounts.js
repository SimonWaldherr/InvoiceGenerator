// The renderer rounds each discounted line to cents, then applies VAT to
// the sum of those lines for each category and rate.
const money = (cents) => Number(cents) / 100;

function scaledDecimal(value, places) {
  const [whole, fraction = ""] = String(value).split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction) || fraction.length > places) {
    return null;
  }
  return BigInt(whole + fraction.padEnd(places, "0"));
}

const roundToInteger = (value, scale) => (value + scale / 2n) / scale;

function unitPrice(units) {
  const scale = 100000000n;
  const fraction = String(units % scale).padStart(8, "0").replace(/0+$/, "");
  return String(units / scale) + (fraction ? "." + fraction : "");
}

export function invoiceAmounts(inputLines) {
  const groups = new Map();
  let net = 0n;
  let tax = 0n;
  let complete = true;
  const lines = inputLines.map((line) => {
    const qty = scaledDecimal(line.qty, 4);
    const price = scaledDecimal(line.price, 4);
    const discount = scaledDecimal(line.disc, 2);
    const rate = scaledDecimal(line.rate, 2);
    if (qty === null || price === null || discount === null || discount > 10000n || rate === null) {
      complete = false;
      return { ...line, lineNet: null, lineTax: null, lineGross: null };
    }

    const netUnit = price * (10000n - discount);
    const lineNet = roundToInteger(qty * netUnit, 10000000000n);
    const key = `${line.cat}|${rate}`;
    const group = groups.get(key) || { cat: line.cat, rate: line.rate, base: 0n, tax: 0n };
    group.base += lineNet;
    const groupTax = line.cat === "S" ? roundToInteger(group.base * rate, 10000n) : 0n;
    const lineTax = groupTax - group.tax;
    group.tax = groupTax;
    groups.set(key, group);
    net += lineNet;
    tax += lineTax;
    return {
      ...line,
      netUnitPrice: unitPrice(netUnit),
      discountAmount: unitPrice(price * discount),
      lineNet: money(lineNet),
      lineTax: money(lineTax),
      lineGross: money(lineNet + lineTax),
    };
  });

  const gross = complete ? money(net + tax) : null;
  return {
    lines,
    taxBreakdown: [...groups.values()].map((group) => ({ ...group, base: money(group.base), tax: money(group.tax) })),
    totals: { net: complete ? money(net) : null, tax: complete ? money(tax) : null, gross, due: gross },
  };
}
