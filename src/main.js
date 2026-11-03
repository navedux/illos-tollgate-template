const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

// Illos.dev: each animated asset loops while it is on screen and pauses when it is not.
// Under reduced motion the CSS holds them still on their first frame.
if (!reduce) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.style.setProperty("--illos-play", e.isIntersecting ? "running" : "paused");
  });
  for (const el of document.querySelectorAll("[data-illos]")) {
    el.style.setProperty("--illos-play", "paused");
    io.observe(el);
  }
}

// The bar gets its hairline once the page scrolls under it.
const nav = $("top");
const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 4);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Mobile menu.
const burger = nav.querySelector(".burger");
const sheet = $("sheet");
const setMenu = (open) => {
  sheet.hidden = !open;
  burger.setAttribute("aria-expanded", open);
  burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
};
burger.addEventListener("click", () => setMenu(sheet.hidden));
sheet.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) { setMenu(false); burger.focus(); } });
matchMedia("(min-width: 1101px)").addEventListener("change", (m) => { if (m.matches) setMenu(false); });

// The estimate: a plan and a month's requests make an invoice. Prices are per 1,000 requests past what a plan includes.
const PLANS = {
  starter: { name: "Starter", base: 49, inc: 1e6, rate: 0.6 },
  growth: { name: "Growth", base: 199, inc: 1e7, rate: 0.4 },
  scale: { name: "Scale", base: 799, inc: 1e8, rate: 0.2 },
};
const TAX = 0.08;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const count = new Intl.NumberFormat("en-US");
const cents = (v) => Math.round(v * 100) / 100;
const short = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : `${Math.round(n / 1e3)}K`);
const spoken = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)} million` : `${Math.round(n / 1e3)} thousand`);
// The slider is logarithmic, 100K at its left end to 200M at its right, rounded the way a person would say it.
const toRequests = (v) => {
  const raw = 1e5 * 2000 ** (v / 1000);
  const step = raw < 1e6 ? 1e4 : raw < 1e8 ? 1e5 : 1e6;
  return Math.round(raw / step) * step;
};
const bill = (key, n) => {
  const p = PLANS[key];
  const over = Math.max(0, n - p.inc);
  const overAmt = cents((over / 1000) * p.rate);
  const sub = cents(p.base + overAmt);
  const tax = cents(sub * TAX);
  return { p, over, overAmt, sub, tax, total: cents(sub + tax) };
};
// Self-check on load: 11.2M on Growth is $199 + 1.2M over at $0.40 per 1K = $679.00 before tax.
console.assert(bill("growth", 11.2e6).sub === 679 && bill("starter", 5e5).total === 52.92, "estimate maths");

const form = $("est");
let say;
const range = $("usage");
const render = () => {
  const key = form.elements.plan.value;
  const n = toRequests(+range.value);
  const b = bill(key, n);
  range.style.setProperty("--p", `calc(12px + (100% - 24px) * ${range.value / 1000})`);
  $("usage-out").textContent = short(n);
  range.setAttribute("aria-valuetext", `${spoken(n)} requests`);

  $("l-plan").firstChild.textContent = `${b.p.name} plan`;
  $("a-plan").textContent = money.format(b.p.base);
  $("l-inc").textContent = `Up to ${count.format(b.p.inc)}`;
  $("q-inc").textContent = count.format(Math.min(n, b.p.inc));
  $("l-rate").textContent = `${money.format(b.p.rate)} per 1,000`;
  $("q-over").textContent = count.format(b.over);
  $("a-over").textContent = money.format(b.overAmt);
  $("a-sub").textContent = money.format(b.sub);
  $("a-tax").textContent = money.format(b.tax);
  $("a-total").textContent = money.format(b.total);

  // The meter: what the plan includes (the used part pale, the rest grey), then the use past it.
  const span = Math.max(n, b.p.inc);
  const seg = (id, v) => { $(id).style.flexGrow = v / span; $(id).hidden = !v; };
  seg("m-in", Math.min(n, b.p.inc));
  seg("m-left", Math.max(0, b.p.inc - n));
  seg("m-over", b.over);
  $("k-in").textContent = n < b.p.inc ? `${short(n)} of ${short(b.p.inc)} included` : `${short(b.p.inc)} included, all used`;
  $("k-over").textContent = b.over ? `${short(b.over)} over plan` : "None over plan";

  // One short line for screen readers, rather than the whole invoice read again on every step of the slider.
  clearTimeout(say);
  say = setTimeout(() => { $("est-status").textContent = `${b.p.name} plan, ${short(n)} requests: ${money.format(b.total)} due.`; }, 500);

  // The cheapest plan for this usage, and a way to switch to it.
  const best = Object.keys(PLANS).reduce((a, k) => (bill(k, n).total < bill(a, n).total ? k : a), key);
  const sw = $("switch");
  if (best === key) {
    $("hint").textContent = `${b.p.name} is the cheapest plan at this usage.`;
    sw.hidden = true;
  } else {
    $("hint").textContent = `${PLANS[best].name} would cost ${money.format(cents(b.total - bill(best, n).total))} less this month.`;
    sw.textContent = `Switch to ${PLANS[best].name}`;
    sw.dataset.plan = best;
    sw.hidden = false;
  }
};
form.addEventListener("input", render);
form.addEventListener("submit", (e) => e.preventDefault());
$("switch").addEventListener("click", (e) => {
  form.querySelector(`input[value="${e.currentTarget.dataset.plan}"]`).checked = true;
  render();
});
render();

// Code tabs: click, or arrow keys, Home and End, as a tab list should.
const tabs = [...document.querySelectorAll('.code__tabs [role="tab"]')];
const pick = (tab, focus) => {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute("aria-selected", on);
    t.tabIndex = on ? 0 : -1;
    $(t.getAttribute("aria-controls")).hidden = !on;
  }
  if (focus) tab.focus();
};
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => pick(tab));
  tab.addEventListener("keydown", (e) => {
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    pick(tabs[(to + tabs.length) % tabs.length], true);
  });
});

// Copy the code on show; the button says so for a moment.
const copy = document.querySelector(".code__copy");
let copyTimer;
copy.addEventListener("click", async () => {
  const pre = document.querySelector(".code pre:not([hidden])");
  let label = "Copied";
  try {
    await navigator.clipboard.writeText(pre.textContent);
  } catch {
    getSelection().selectAllChildren(pre); // no clipboard here (an insecure page or a denied permission): select it to copy by hand
    label = "Selected";
  }
  copy.classList.toggle("is-done", label === "Copied");
  copy.querySelector("span").textContent = label;
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copy.classList.remove("is-done");
    copy.querySelector("span").textContent = "Copy";
  }, 1500);
});
