// Northpeak Outfitters — a FICTIONAL static fixture store for the OpenMuse Shop production journey.
// Pure helpers live on `NP` (unit-tested with node); the DOM wiring at the bottom runs only in a browser.
// State travels in the query string (color, size, qty, signed) together with the failure switches:
//   ?oos=1        Navy / M "sells out" when added to the cart (the item page stays InStock)
//   ?price=14901  the cart and checkout charge this unit price in cents (the item page keeps $139.00)
//   ?login=1      the checkout asks for a sign-in first (any password works; it adds signed=1)
const NP = {
  STORE: { name: "Northpeak Outfitters", tagline: "Fictional store · nothing is sold" },
  ITEM: {
    id: "ridgeline-rain-shell",
    sku: "NP-RRS-01",
    title: "Ridgeline 2.5L Rain Shell",
    priceMinor: 13900,
    wasMinor: 15900,
    currency: "USD",
    options: { Color: ["Navy", "Moss"], Size: ["S", "M", "L"] },
    preselected: { Color: "Navy", Size: "M" },
    rating: 4.6,
    reviews: 1284,
  },
  SHIPPING_MINOR: 800,
  TAX_RATE: 0.04835, // $139.00 -> $6.72 tax, $153.72 total (the approved mock's numbers)
  SWITCHES: ["oos", "price", "login"],
  CARRIED: ["color", "size", "qty", "signed"],

  params(search) {
    const out = {};
    for (const [k, v] of new URLSearchParams(search || "")) out[k] = v;
    return out;
  },
  /** The query string for the next page: the selection, the switches and `extra`, nothing else. */
  carry(params, extra) {
    const q = new URLSearchParams();
    for (const k of [...NP.CARRIED, ...NP.SWITCHES]) if (params[k] !== undefined && params[k] !== "") q.set(k, params[k]);
    for (const k of Object.keys(extra || {})) q.set(k, String(extra[k]));
    const s = q.toString();
    return s ? "?" + s : "";
  },
  selection(params) {
    const pick = (name, values, fallback) => (values.includes(params[name.toLowerCase()]) ? params[name.toLowerCase()] : fallback);
    return {
      color: pick("Color", NP.ITEM.options.Color, NP.ITEM.preselected.Color),
      size: pick("Size", NP.ITEM.options.Size, NP.ITEM.preselected.Size),
      qty: Math.min(10, Math.max(1, parseInt(params.qty || "1", 10) || 1)),
    };
  },
  /** Cart / checkout unit price: the `price` switch (integer cents) wins; the item page never uses it. */
  unitPriceMinor(params) {
    const n = Number(params.price);
    return Number.isInteger(n) && n > 0 && n <= 1e9 ? n : NP.ITEM.priceMinor;
  },
  soldOut(params) {
    const s = NP.selection(params);
    return params.oos === "1" && s.color === "Navy" && s.size === "M";
  },
  needsSignIn(params) {
    return params.login === "1" && params.signed !== "1";
  },
  totals(unitMinor, qty) {
    const subtotal = unitMinor * qty;
    const tax = Math.round(subtotal * NP.TAX_RATE);
    return { subtotal, shipping: NP.SHIPPING_MINOR, tax, total: subtotal + NP.SHIPPING_MINOR + tax };
  },
  money(minor) {
    const sign = minor < 0 ? "-" : "";
    const abs = Math.abs(minor);
    const whole = Math.floor(abs / 100).toLocaleString("en-US");
    return `${sign}$${whole}.${String(abs % 100).padStart(2, "0")}`;
  },
  /** "NP-" + 5 digits from the clock, so repeated runs record distinct orders. */
  orderNumber(nowMs) {
    return "NP-" + String(Math.floor(nowMs / 1000) % 100000).padStart(5, "0");
  },
  dayText(d) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
  },
  /** "Wed Oct 22 – Fri Oct 24": 4 to 6 days out. */
  delivery(nowMs) {
    const a = new Date(nowMs + 4 * 864e5);
    const b = new Date(nowMs + 6 * 864e5);
    return `${NP.dayText(a)} – ${NP.dayText(b)}`;
  },
  optionText(sel) {
    return `${sel.color} / ${sel.size}`;
  },
};

if (typeof module !== "undefined" && module.exports) module.exports = NP;

if (typeof document !== "undefined") {
  const params = NP.params(location.search);
  const sel = NP.selection(params);
  const $ = (id) => document.getElementById(id);
  const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  const page = document.body.dataset.page;
  const unit = NP.unitPriceMinor(params);
  const t = NP.totals(unit, sel.qty);
  if (page === "item") {
    text("price", NP.money(NP.ITEM.priceMinor));
    for (const name of ["Color", "Size"]) {
      const box = $("opt-" + name.toLowerCase());
      for (const v of NP.ITEM.options[name]) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "opt" + (sel[name.toLowerCase()] === v ? " on" : "");
        b.id = `opt-${name.toLowerCase()}-${v.toLowerCase()}`;
        b.textContent = v;
        b.setAttribute("aria-pressed", sel[name.toLowerCase()] === v ? "true" : "false");
        b.style.width = "auto";
        b.style.display = "inline-block";
        b.onclick = () => { location.search = NP.carry({ ...params, [name.toLowerCase()]: v }); };
        box.appendChild(b);
      }
    }
    text("chosen", `Selected: ${NP.optionText(sel)}`);
    $("add-to-cart").onclick = () => {
      if (NP.soldOut(params)) {
        const n = $("notice");
        n.textContent = `Sorry — ${NP.optionText(sel)} just sold out. Try Moss, or another size.`;
        n.classList.remove("hidden");
        $("add-to-cart").textContent = "Sold out";
        $("add-to-cart").disabled = true;
        return;
      }
      location.href = "cart.html" + NP.carry({ ...params, color: sel.color, size: sel.size, qty: sel.qty });
    };
  } else if (page === "cart") {
    text("line-options", `${NP.optionText(sel)} · Qty ${sel.qty}`);
    text("line-price", NP.money(unit));
    text("subtotal", NP.money(t.subtotal));
    $("checkout").href = "checkout.html" + NP.carry(params);
  } else if (page === "checkout") {
    if (NP.needsSignIn(params)) {
      $("signin").classList.remove("hidden");
      $("pay").classList.add("hidden");
      $("signin-form").onsubmit = (e) => {
        e.preventDefault();
        location.href = "checkout.html" + NP.carry(params, { signed: 1 });
      };
    } else {
      $("signin").classList.add("hidden");
      $("pay").classList.remove("hidden");
    }
    text("line-options", `${NP.optionText(sel)} · Qty ${sel.qty}`);
    text("line-price", NP.money(unit));
    text("subtotal", NP.money(t.subtotal));
    text("shipping", NP.money(t.shipping));
    text("tax", NP.money(t.tax));
    text("total", NP.money(t.total));
    text("place-order", `Place order · ${NP.money(t.total)}`);
    $("place-order").onclick = (e) => {
      e.preventDefault();
      location.href = "confirmation.html" + NP.carry(params, { order: NP.orderNumber(Date.now()) });
    };
  } else if (page === "confirmation") {
    const order = /^[A-Z0-9][A-Z0-9-]{3,31}$/.test(params.order || "") ? params.order : NP.orderNumber(Date.now());
    text("order-number", order);
    text("line-options", `${NP.optionText(sel)} · Qty ${sel.qty}`);
    text("line-price", NP.money(unit));
    text("subtotal", NP.money(t.subtotal));
    text("shipping", NP.money(t.shipping));
    text("tax", NP.money(t.tax));
    text("total", NP.money(t.total));
    text("delivery", NP.delivery(Date.now()));
    $("track").href = `track.html?order=${encodeURIComponent(order)}`;
    document.title = `Order ${order} confirmed · Northpeak Outfitters`;
  } else if (page === "track") {
    text("order-number", /^[A-Z0-9][A-Z0-9-]{3,31}$/.test(params.order || "") ? params.order : "—");
  }
}
