const STORAGE_KEY = "irpc_ghg_saved_scenarios_v1";
const TREND_OVERRIDE_KEY = "irpc_ghg_trend_override_v1";

const el = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const sign = (n) => (n > 0 ? "+" : "") + fmt(n);
const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(3) : "0.000");
const tonsToMt = (n) => n / 1000000;
const mtToTons = (n) => n * 1000000;
const fmtMt = (n, digits = 2) => (Number.isFinite(n) ? tonsToMt(n).toFixed(digits) : (0).toFixed(digits));
const signMt = (n, digits = 2) => (n > 0 ? "+" : "") + fmtMt(n, digits);

const state = {
  years: [],
  yearsDefault: [],
  trendBase: {},
  trendBaseDefault: {},
  factors: [],
  presets: {},
  currentScenario: "base"
};

const refs = {
  yearFrom: el("yearFrom"),
  yearTo: el("yearTo"),
  viewMode: el("viewMode"),
  scenario: el("scenario"),
  resetBtn: el("resetBtn"),
  sampleBtn: el("sampleBtn"),
  search: el("search"),
  sortDrivers: el("sortDrivers"),
  fOps: el("fOps"),
  fEnergy: el("fEnergy"),
  fSupply: el("fSupply"),
  fPolicy: el("fPolicy"),
  fProject: el("fProject"),
  inS1: el("inS1"),
  inS2: el("inS2"),
  inS3: el("inS3"),
  inProd: el("inProd"),
  inTarget: el("inTarget"),
  titleLeft: el("titleLeft"),
  hintLeft: el("hintLeft"),
  yearLabel: el("yearLabel"),
  trendSvg: el("trendSvg"),
  trendSummary: el("trendSummary"),
  saveName: el("saveName"),
  saveBtn: el("saveBtn"),
  savedScenarios: el("savedScenarios"),
  loadSavedBtn: el("loadSavedBtn"),
  deleteSavedBtn: el("deleteSavedBtn"),
  exportScenarioBtn: el("exportScenarioBtn"),
  importScenarioBtn: el("importScenarioBtn"),
  scenarioImportFile: el("scenarioImportFile"),
  saveHint: el("saveHint"),
  importCsvBtn: el("importCsvBtn"),
  resetCsvBtn: el("resetCsvBtn"),
  csvImportFile: el("csvImportFile"),
  csvHint: el("csvHint"),
  kpiTotal: el("kpiTotal"),
  baseTotal: el("baseTotal"),
  adjTotal: el("adjTotal"),
  dTotal: el("dTotal"),
  kpiSplit: el("kpiSplit"),
  base12: el("base12"),
  adj12: el("adj12"),
  d12: el("d12"),
  kpiInt: el("kpiInt"),
  outProd: el("outProd"),
  baseInt: el("baseInt"),
  dInt: el("dInt"),
  kpiGap: el("kpiGap"),
  targetV: el("targetV"),
  adjV: el("adjV"),
  dGap: el("dGap"),
  wfBase: el("wfBase"),
  wfImpact: el("wfImpact"),
  wfAdj: el("wfAdj"),
  wfBaseVal: el("wfBaseVal"),
  wfImpactVal: el("wfImpactVal"),
  wfAdjVal: el("wfAdjVal"),
  drivers: el("drivers"),
  slidersHost: el("slidersHost")
};

async function init() {
  const data = await loadData();

  state.years = data.years || [];
  state.yearsDefault = [...state.years];
  state.trendBase = data.trendBaseTotalByYear || {};
  state.trendBaseDefault = { ...state.trendBase };
  state.factors = (data.factors || []).map((f) => ({ ...f }));
  state.presets = data.presets || {};

  applyTrendOverride();

  buildScenarioOptions();
  buildYears(data.defaultYearFrom, data.defaultYearTo);
  setBaseInputs(data.baseInputs || {});
  buildSliders();
  wireEvents();

  applyPreset(refs.scenario.value || "base");
  refreshSavedScenarioList();
  recalc();
}

async function loadData() {
  const res = await fetch("data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load data.json");
  return res.json();
}

function applyTrendOverride() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TREND_OVERRIDE_KEY) || "{}");
    const keys = Object.keys(parsed);
    if (keys.length === 0) return;

    state.trendBase = { ...state.trendBaseDefault };
    const yearSet = new Set(state.yearsDefault);
    keys.forEach((k) => {
      const year = Number(k);
      const value = Number(parsed[k]);
      if (Number.isFinite(year) && Number.isFinite(value)) {
        state.trendBase[year] = value;
        yearSet.add(year);
      }
    });
    state.years = Array.from(yearSet).sort((a, b) => a - b);
    refs.csvHint.textContent = "CSV override active from browser storage.";
  } catch (_err) {
    refs.csvHint.textContent = "CSV override parse failed. Using data.json defaults.";
  }
}

function buildScenarioOptions() {
  refs.scenario.innerHTML = "";
  Object.entries(state.presets).forEach(([key, value]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = value.label || `Scenario: ${key}`;
    refs.scenario.appendChild(opt);
  });
  if (!refs.scenario.value && refs.scenario.options.length > 0) {
    refs.scenario.value = refs.scenario.options[0].value;
  }
}

function buildYears(defaultFrom, defaultTo) {
  refs.yearFrom.innerHTML = "";
  refs.yearTo.innerHTML = "";

  state.years.forEach((y) => {
    const o1 = document.createElement("option");
    o1.value = y;
    o1.textContent = `From: ${y}`;
    refs.yearFrom.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = y;
    o2.textContent = `To: ${y}`;
    refs.yearTo.appendChild(o2);
  });

  refs.yearFrom.value = String(defaultFrom || state.years[0]);
  refs.yearTo.value = String(defaultTo || state.years[state.years.length - 1]);
}

function rebuildYearsPreserveSelection() {
  const from = Number(refs.yearFrom.value || state.years[0]);
  const to = Number(refs.yearTo.value || state.years[state.years.length - 1]);
  buildYears(from, to);
}

function setBaseInputs(baseInputs) {
  refs.inS1.value = fmtMt(baseInputs.s1 ?? 1450000, 2);
  refs.inS2.value = fmtMt(baseInputs.s2 ?? 580000, 2);
  refs.inS3.value = fmtMt(baseInputs.s3 ?? 3100000, 2);
  refs.inProd.value = baseInputs.production ?? 6200000;
  refs.inTarget.value = fmtMt(baseInputs.target ?? 4300000, 2);
}

function buildSliders() {
  refs.slidersHost.innerHTML = "";
  state.factors.forEach((f) => {
    const wrap = document.createElement("div");
    wrap.className = "ctrl";

    const lab = document.createElement("label");
    lab.innerHTML = `${f.name} <small>${f.hint}</small>`;

    const right = document.createElement("div");
    const r = document.createElement("input");
    r.type = "range";
    r.min = f.min;
    r.max = f.max;
    r.value = f.value;
    r.id = `s_${f.id}`;

    const pill = document.createElement("div");
    pill.className = "pill";
    pill.id = `v_${f.id}`;
    pill.textContent = `${signMt(f.value, 3)} MtCO2`;

    r.addEventListener("input", () => {
      f.value = Number(r.value);
      pill.textContent = `${signMt(f.value, 3)} MtCO2`;
      recalc();
    });

    right.appendChild(r);
    right.appendChild(pill);
    wrap.appendChild(lab);
    wrap.appendChild(right);
    refs.slidersHost.appendChild(wrap);
  });
}

function wireEvents() {
  [
    refs.yearFrom,
    refs.yearTo,
    refs.viewMode,
    refs.scenario,
    refs.search,
    refs.sortDrivers,
    refs.fOps,
    refs.fEnergy,
    refs.fSupply,
    refs.fPolicy,
    refs.fProject
  ].forEach((node) => {
    node.addEventListener("input", recalc);
    node.addEventListener("change", recalc);
  });

  [refs.inS1, refs.inS2, refs.inS3, refs.inProd, refs.inTarget].forEach((node) => {
    node.addEventListener("input", recalc);
  });

  refs.yearFrom.addEventListener("change", normalizeYears);
  refs.yearTo.addEventListener("change", normalizeYears);
  refs.scenario.addEventListener("change", () => applyPreset(refs.scenario.value));
  refs.resetBtn.addEventListener("click", () => applyPreset(refs.scenario.value));
  refs.sampleBtn.addEventListener("click", applySample);

  refs.saveBtn.addEventListener("click", saveCurrentScenario);
  refs.loadSavedBtn.addEventListener("click", loadSelectedSavedScenario);
  refs.deleteSavedBtn.addEventListener("click", deleteSelectedSavedScenario);
  refs.exportScenarioBtn.addEventListener("click", exportSavedScenarios);
  refs.importScenarioBtn.addEventListener("click", () => refs.scenarioImportFile.click());
  refs.scenarioImportFile.addEventListener("change", handleScenarioImportFile);
  refs.importCsvBtn.addEventListener("click", () => refs.csvImportFile.click());
  refs.csvImportFile.addEventListener("change", handleTrendCsvImportFile);
  refs.resetCsvBtn.addEventListener("click", resetTrendOverrides);
}

function normalizeYears() {
  if (Number(refs.yearFrom.value) > Number(refs.yearTo.value)) {
    const temp = refs.yearFrom.value;
    refs.yearFrom.value = refs.yearTo.value;
    refs.yearTo.value = temp;
  }
  recalc();
}

function applyPreset(key) {
  const preset = state.presets[key] || state.presets.base;
  state.currentScenario = key;
  if (!preset || !preset.factors) return;

  state.factors.forEach((f) => {
    f.value = Number(preset.factors[f.id] ?? 0);
    const slider = el(`s_${f.id}`);
    const pill = el(`v_${f.id}`);
    if (slider) slider.value = f.value;
    if (pill) pill.textContent = `${signMt(f.value, 3)} MtCO2`;
  });
  recalc();
}

function applySample() {
  state.factors.forEach((f) => {
    const r = f.min + Math.random() * (f.max - f.min);
    f.value = Math.round(r * 0.55);
    const s = el(`s_${f.id}`);
    const p = el(`v_${f.id}`);
    if (s) s.value = f.value;
    if (p) p.textContent = `${signMt(f.value, 3)} MtCO2`;
  });
  recalc();
}

function groupEnabled(group) {
  if (group === "ops") return refs.fOps.checked;
  if (group === "energy") return refs.fEnergy.checked;
  if (group === "supply") return refs.fSupply.checked;
  if (group === "policy") return refs.fPolicy.checked;
  if (group === "project") return refs.fProject.checked;
  return true;
}

function getFilteredFactors() {
  const q = (refs.search.value || "").trim().toLowerCase();
  let arr = state.factors.filter((f) => groupEnabled(f.group));
  if (q) {
    arr = arr.filter((f) => `${f.name} ${f.hint} ${f.group}`.toLowerCase().includes(q));
  }

  const mode = refs.sortDrivers.value;
  if (mode === "absdesc") arr.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  if (mode === "negdesc") arr.sort((a, b) => a.value - b.value);
  if (mode === "posdesc") arr.sort((a, b) => b.value - a.value);
  if (mode === "name") arr.sort((a, b) => a.name.localeCompare(b.name, "en"));
  return arr;
}

function paintDelta(node, d, lowerIsBetter, formatter = sign) {
  node.textContent = `Delta ${formatter(d)}`;
  node.classList.remove("good", "bad");
  const isGood = lowerIsBetter ? d <= 0 : d >= 0;
  node.classList.add(isGood ? "good" : "bad");
}

function recalc() {
  refs.yearLabel.textContent = `Year(s): ${refs.yearFrom.value}-${refs.yearTo.value}`;
  const vm = refs.viewMode.value;
  if (vm === "executive") {
    refs.titleLeft.textContent = "Executive Overview";
    refs.hintLeft.textContent = "KPI + Bridge + Trend + Top Drivers";
  }
  if (vm === "workshop") {
    refs.titleLeft.textContent = "Workshop View";
    refs.hintLeft.textContent = "Scenario and slider trade-off testing";
  }
  if (vm === "analysis") {
    refs.titleLeft.textContent = "Analysis View";
    refs.hintLeft.textContent = "Filter/search/sort sensitivity exploration";
  }

  const s1 = mtToTons(Number(refs.inS1.value || 0));
  const s2 = mtToTons(Number(refs.inS2.value || 0));
  const s3 = mtToTons(Number(refs.inS3.value || 0));
  const prod = Math.max(Number(refs.inProd.value || 1), 1);
  const target = mtToTons(Number(refs.inTarget.value || 0));

  const baseTotal = s1 + s2 + s3;
  const selected = getFilteredFactors();
  const impact = selected.reduce((sum, f) => sum + (Number(f.value) || 0), 0);
  const adjTotal = Math.max(baseTotal + impact, 0);

  const reductionRatio = baseTotal > 0 ? Math.max(Math.min((baseTotal - adjTotal) / baseTotal, 1), -1) : 0;
  const adjS1 = Math.max(s1 * (1 - reductionRatio * 0.6), 0);
  const adjS2 = Math.max(s2 * (1 - reductionRatio * 0.9), 0);
  const partial = adjS1 + adjS2;
  const adjS3 = Math.max(adjTotal - partial, 0);

  const baseIntensity = baseTotal / prod;
  const adjIntensity = adjTotal / prod;
  const gap = adjTotal - target;

  refs.kpiTotal.textContent = fmtMt(adjTotal);
  refs.baseTotal.textContent = fmtMt(baseTotal);
  refs.adjTotal.textContent = fmtMt(adjTotal);
  paintDelta(refs.dTotal, adjTotal - baseTotal, true, (n) => signMt(n, 3));

  refs.kpiSplit.textContent = `${fmtMt(adjS1)} / ${fmtMt(adjS2)} / ${fmtMt(adjS3)}`;
  refs.base12.textContent = fmtMt(s1 + s2);
  refs.adj12.textContent = fmtMt(adjS1 + adjS2);
  paintDelta(refs.d12, adjS1 + adjS2 - (s1 + s2), true, (n) => signMt(n, 3));

  refs.kpiInt.textContent = fmt2(adjIntensity);
  refs.outProd.textContent = `${fmt(prod)} ton`;
  refs.baseInt.textContent = fmt2(baseIntensity);
  paintDelta(refs.dInt, adjIntensity - baseIntensity, true);

  refs.kpiGap.textContent = signMt(gap);
  refs.targetV.textContent = fmtMt(target);
  refs.adjV.textContent = fmtMt(adjTotal);
  refs.dGap.textContent = gap <= 0 ? "On/Below Target" : "Above Target";
  refs.dGap.classList.remove("good", "bad");
  refs.dGap.classList.add(gap <= 0 ? "good" : "bad");

  const maxAbs = Math.max(Math.abs(baseTotal), Math.abs(adjTotal), Math.abs(impact), 1);
  refs.wfBase.style.width = `${Math.min(100, (Math.abs(baseTotal) / maxAbs) * 100)}%`;
  refs.wfImpact.style.width = `${Math.min(100, (Math.abs(impact) / maxAbs) * 100)}%`;
  refs.wfAdj.style.width = `${Math.min(100, (Math.abs(adjTotal) / maxAbs) * 100)}%`;
  refs.wfImpact.classList.toggle("neg", impact > 0);

  refs.wfBaseVal.textContent = `${fmtMt(baseTotal)} MtCO2`;
  refs.wfImpactVal.textContent = `${signMt(impact, 3)} MtCO2`;
  refs.wfAdjVal.textContent = `${fmtMt(adjTotal)} MtCO2`;

  renderDrivers(selected);
  renderTrend(baseTotal, impact);
}

function renderDrivers(selectedFactors) {
  const top = selectedFactors.slice(0, 10);
  refs.drivers.innerHTML = "";
  if (top.length === 0) {
    refs.drivers.innerHTML = "<p class='note'>No factors found with current filter/search.</p>";
    return;
  }

  top.forEach((f) => {
    const row = document.createElement("div");
    row.className = "rowItem";
    const left = document.createElement("div");
    left.innerHTML = `<div class='name'>${f.name}</div><div class='meta'>${f.group.toUpperCase()} • ${f.hint}</div>`;
    const badge = document.createElement("div");
    badge.className = `impact ${f.value <= 0 ? "good" : "bad"}`;
    badge.textContent = `${signMt(f.value, 3)} MtCO2`;
    row.appendChild(left);
    row.appendChild(badge);
    refs.drivers.appendChild(row);
  });
}

function renderTrend(currentBase, currentImpact) {
  const svg = refs.trendSvg;
  const width = 760;
  const height = 240;
  const padLeft = 44;
  const padRight = 24;
  const padTop = 18;
  const padBottom = 34;

  const fromY = Number(refs.yearFrom.value);
  const toY = Number(refs.yearTo.value);

  const trend = state.years.map((year) => {
    const base = Number(state.trendBase[year] ?? currentBase);
    const inRange = year >= fromY && year <= toY;
    const rangeMultiplier = inRange ? 1 : 0.35;
    const adjusted = Math.max(base + currentImpact * rangeMultiplier, 0);
    return { year, base, adjusted, inRange };
  });

  const values = trend.flatMap((d) => [d.base, d.adjusted]);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = Math.max(maxV - minV, 1);

  const xForIndex = (i) => padLeft + (i * (width - padLeft - padRight)) / Math.max(trend.length - 1, 1);
  const yForValue = (v) => padTop + (maxV - v) * (height - padTop - padBottom) / range;

  const lineBase = trend.map((d, i) => `${xForIndex(i)},${yForValue(d.base)}`).join(" ");
  const lineAdj = trend.map((d, i) => `${xForIndex(i)},${yForValue(d.adjusted)}`).join(" ");

  const xFrom = xForIndex(Math.max(state.years.indexOf(fromY), 0));
  const xTo = xForIndex(Math.max(state.years.indexOf(toY), 0));
  const bandX = Math.min(xFrom, xTo);
  const bandW = Math.abs(xTo - xFrom) || 2;

  const yTicks = 4;
  const yGrid = Array.from({ length: yTicks + 1 }, (_, idx) => {
    const value = minV + ((yTicks - idx) / yTicks) * range;
    const y = yForValue(value);
    return `<line class="trend-grid" x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" />
      <text class="trend-label" x="6" y="${y + 4}">${fmtMt(value, 1)} Mt</text>`;
  }).join("\n");

  const xLabels = trend.map((d, i) => {
    const x = xForIndex(i);
    return `<text class="trend-label" x="${x}" y="${height - 10}" text-anchor="middle">${d.year}</text>`;
  }).join("\n");

  const dotsBase = trend.map((d, i) => `<circle class="trend-dot-base" cx="${xForIndex(i)}" cy="${yForValue(d.base)}" r="2.4" />`).join("\n");
  const dotsAdj = trend.map((d, i) => `<circle class="trend-dot-adj" cx="${xForIndex(i)}" cy="${yForValue(d.adjusted)}" r="2.9" />`).join("\n");

  svg.innerHTML = `
    <rect x="${bandX}" y="${padTop}" width="${bandW}" height="${height - padTop - padBottom}" class="trend-band" />
    ${yGrid}
    <line class="trend-axis" x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}" />
    <polyline class="trend-line-base" points="${lineBase}" />
    <polyline class="trend-line-adj" points="${lineAdj}" />
    ${dotsBase}
    ${dotsAdj}
    ${xLabels}
  `;

  const selected = trend.filter((d) => d.inRange);
  if (selected.length > 0) {
    const avgBase = selected.reduce((s, d) => s + d.base, 0) / selected.length;
    const avgAdj = selected.reduce((s, d) => s + d.adjusted, 0) / selected.length;
    refs.trendSummary.textContent = `Range avg: ${fmtMt(avgBase)} -> ${fmtMt(avgAdj)} MtCO2`;
  } else {
    refs.trendSummary.textContent = "-";
  }
}

function scenarioSnapshot() {
  return {
    inputs: {
      s1: Number(refs.inS1.value || 0),
      s2: Number(refs.inS2.value || 0),
      s3: Number(refs.inS3.value || 0),
      production: Number(refs.inProd.value || 0),
      target: Number(refs.inTarget.value || 0)
    },
    years: {
      from: Number(refs.yearFrom.value),
      to: Number(refs.yearTo.value)
    },
    viewMode: refs.viewMode.value,
    sort: refs.sortDrivers.value,
    search: refs.search.value,
    filters: {
      ops: refs.fOps.checked,
      energy: refs.fEnergy.checked,
      supply: refs.fSupply.checked,
      policy: refs.fPolicy.checked,
      project: refs.fProject.checked
    },
    factors: state.factors.reduce((acc, f) => {
      acc[f.id] = Number(f.value || 0);
      return acc;
    }, {}),
    sourceScenario: refs.scenario.value
  };
}

function normalizeMtInputFromSnapshot(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n) > 1000 ? tonsToMt(n) : n;
}

function applySnapshot(snapshot) {
  if (!snapshot) return;

  const s1 = normalizeMtInputFromSnapshot(snapshot.inputs?.s1);
  const s2 = normalizeMtInputFromSnapshot(snapshot.inputs?.s2);
  const s3 = normalizeMtInputFromSnapshot(snapshot.inputs?.s3);
  const target = normalizeMtInputFromSnapshot(snapshot.inputs?.target);
  if (s1 !== null) refs.inS1.value = s1;
  if (s2 !== null) refs.inS2.value = s2;
  if (s3 !== null) refs.inS3.value = s3;
  refs.inProd.value = snapshot.inputs?.production ?? refs.inProd.value;
  if (target !== null) refs.inTarget.value = target;

  if (snapshot.years?.from) refs.yearFrom.value = String(snapshot.years.from);
  if (snapshot.years?.to) refs.yearTo.value = String(snapshot.years.to);

  refs.viewMode.value = snapshot.viewMode || refs.viewMode.value;
  refs.sortDrivers.value = snapshot.sort || refs.sortDrivers.value;
  refs.search.value = snapshot.search || "";

  refs.fOps.checked = snapshot.filters?.ops ?? refs.fOps.checked;
  refs.fEnergy.checked = snapshot.filters?.energy ?? refs.fEnergy.checked;
  refs.fSupply.checked = snapshot.filters?.supply ?? refs.fSupply.checked;
  refs.fPolicy.checked = snapshot.filters?.policy ?? refs.fPolicy.checked;
  refs.fProject.checked = snapshot.filters?.project ?? refs.fProject.checked;

  if (snapshot.sourceScenario && state.presets[snapshot.sourceScenario]) {
    refs.scenario.value = snapshot.sourceScenario;
  }

  state.factors.forEach((f) => {
    f.value = Number(snapshot.factors?.[f.id] ?? f.value);
    const slider = el(`s_${f.id}`);
    const pill = el(`v_${f.id}`);
    if (slider) slider.value = f.value;
    if (pill) pill.textContent = `${signMt(f.value, 3)} MtCO2`;
  });

  normalizeYears();
  recalc();
}

function getSavedScenarios() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (_err) {
    return {};
  }
}

function setSavedScenarios(payload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function refreshSavedScenarioList(selectedName = "") {
  const data = getSavedScenarios();
  const names = Object.keys(data).sort((a, b) => a.localeCompare(b));
  refs.savedScenarios.innerHTML = "";

  if (names.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No saved scenarios";
    refs.savedScenarios.appendChild(opt);
    refs.savedScenarios.disabled = true;
    refs.loadSavedBtn.disabled = true;
    refs.deleteSavedBtn.disabled = true;
    return;
  }

  names.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    refs.savedScenarios.appendChild(opt);
  });

  refs.savedScenarios.disabled = false;
  refs.loadSavedBtn.disabled = false;
  refs.deleteSavedBtn.disabled = false;

  if (selectedName && data[selectedName]) {
    refs.savedScenarios.value = selectedName;
  }
}

function saveCurrentScenario() {
  const typed = (refs.saveName.value || "").trim();
  const fallback = `Scenario ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  const name = typed || fallback;
  const data = getSavedScenarios();
  data[name] = scenarioSnapshot();
  setSavedScenarios(data);
  refreshSavedScenarioList(name);
  refs.saveHint.textContent = `Saved: ${name}`;
  refs.saveName.value = "";
}

function loadSelectedSavedScenario() {
  const name = refs.savedScenarios.value;
  if (!name) return;
  const data = getSavedScenarios();
  if (!data[name]) return;
  applySnapshot(data[name]);
  refs.saveHint.textContent = `Loaded: ${name}`;
}

function deleteSelectedSavedScenario() {
  const name = refs.savedScenarios.value;
  if (!name) return;
  const data = getSavedScenarios();
  delete data[name];
  setSavedScenarios(data);
  refreshSavedScenarioList();
  refs.saveHint.textContent = `Deleted: ${name}`;
}

function exportSavedScenarios() {
  const data = getSavedScenarios();
  const payload = {
    exportedAt: new Date().toISOString(),
    app: "IRPC GHG Dashboard",
    scenarios: data
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `irpc-ghg-scenarios-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  refs.saveHint.textContent = "Exported saved scenarios JSON.";
}

async function handleScenarioImportFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const incoming = parsed?.scenarios && typeof parsed.scenarios === "object" ? parsed.scenarios : parsed;
    if (!incoming || typeof incoming !== "object") {
      throw new Error("Invalid scenarios JSON format.");
    }

    const current = getSavedScenarios();
    let count = 0;
    Object.entries(incoming).forEach(([name, snapshot]) => {
      if (typeof name === "string" && name.trim() && isValidScenarioSnapshot(snapshot)) {
        current[name] = snapshot;
        count += 1;
      }
    });

    if (count === 0) {
      throw new Error("No valid scenarios found in file.");
    }

    setSavedScenarios(current);
    refreshSavedScenarioList();
    refs.saveHint.textContent = `Imported ${count} scenario(s).`;
  } catch (err) {
    refs.saveHint.textContent = `Import failed: ${err.message}`;
  }
}

function isValidScenarioSnapshot(snapshot) {
  return (
    snapshot &&
    typeof snapshot === "object" &&
    typeof snapshot.inputs === "object" &&
    typeof snapshot.factors === "object"
  );
}

async function handleTrendCsvImportFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = parseTrendCsv(text);
    if (Object.keys(parsed).length === 0) {
      throw new Error("CSV has no valid rows.");
    }

    localStorage.setItem(TREND_OVERRIDE_KEY, JSON.stringify(parsed));
    state.trendBase = { ...state.trendBaseDefault, ...parsed };
    state.years = Array.from(new Set([...state.yearsDefault, ...Object.keys(parsed).map(Number)])).sort((a, b) => a - b);
    rebuildYearsPreserveSelection();
    normalizeYears();
    refs.csvHint.textContent = `Imported CSV rows: ${Object.keys(parsed).length}.`;
    recalc();
  } catch (err) {
    refs.csvHint.textContent = `CSV import failed: ${err.message}`;
  }
}

function parseTrendCsv(csvText) {
  const rows = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length === 0) return {};

  let startIdx = 0;
  const first = rows[0].toLowerCase();
  const isHeader = first.includes("year") && first.includes("base");
  const isMtHeader = first.includes("mt");
  if (isHeader) {
    startIdx = 1;
  }

  const output = {};
  for (let i = startIdx; i < rows.length; i += 1) {
    const parts = rows[i].split(",").map((x) => x.trim());
    if (parts.length < 2) continue;
    const year = Number(parts[0]);
    const raw = Number(parts[1]);
    if (!Number.isFinite(year) || !Number.isFinite(raw)) continue;
    const base = isMtHeader || Math.abs(raw) < 1000 ? mtToTons(raw) : raw;
    if (Number.isFinite(base)) {
      output[year] = base;
    }
  }
  return output;
}

function resetTrendOverrides() {
  localStorage.removeItem(TREND_OVERRIDE_KEY);
  state.trendBase = { ...state.trendBaseDefault };
  state.years = [...state.yearsDefault];
  rebuildYearsPreserveSelection();
  normalizeYears();
  refs.csvHint.textContent = "Trend reset to data.json defaults.";
  recalc();
}

init().catch((err) => {
  console.error(err);
  document.body.innerHTML = "<div style='padding:24px;font-family:sans-serif'>Failed to initialize dashboard. Ensure <code>data.json</code> is available.</div>";
});
