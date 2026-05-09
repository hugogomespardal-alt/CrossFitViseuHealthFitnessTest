const STORAGE_KEY = "cfv_fitness_health_test_v1";
const ADMIN_PASSWORD = "cfviseu";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
const round = (n, d = 1) => Number((Number.isFinite(n) ? n : 0).toFixed(d));
const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

let state = loadState();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  return { athletes: [], assessments: [] };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function generateCode(name = "CFV") {
  const prefix = name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "CFV";
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${suffix}`;
}

function zone(score) {
  if (score < 40) return { key: "Sickness", label: "Sickness / risco elevado", color: "#e04444" };
  if (score < 70) return { key: "Wellness", label: "Wellness / zona intermédia", color: "#f5a524" };
  return { key: "Fitness", label: "Fitness / boa aptidão física", color: "#1fb56f" };
}

function oneRm(load, reps) {
  if (!load || !reps) return 0;
  return reps === 1 ? load : load * (1 + 0.0333 * Math.min(reps, 5));
}

function fatScore(g, sex) {
  const marks = sex === "M"
    ? { min: 2, low: 14, peak: 18, fit: 24, avg: 31, obese: 32, zero: 40 }
    : { min: 10, low: 14, peak: 18, fit: 24, avg: 31, obese: 32, zero: 45 };
  if (g <= marks.low) return 90 + (g - marks.min) * (10 / (marks.low - marks.min));
  if (g <= marks.peak) return 90 + (g - marks.low) * (10 / (marks.peak - marks.low));
  if (g <= marks.fit) return 100 - (g - marks.peak) * (20 / (marks.fit - marks.peak));
  if (g <= marks.avg) return 80 - (g - marks.fit) * (30 / (marks.avg - marks.fit));
  if (g <= marks.obese) return 50 - (g - marks.avg);
  if (g <= marks.zero) return 49 - (g - marks.obese) * (49 / (marks.zero - marks.obese));
  return 0;
}

function mfrScore(mfr, sex) {
  const floor = sex === "M" ? 1.5 : 1.2;
  const top = sex === "M" ? 4.5 : 3.8;
  if (mfr <= floor) return 0;
  if (mfr >= top) return 100;
  return 50 + (mfr - floor) * (50 / (top - floor));
}

function fmiScore(fmi, sex) {
  if (sex === "M") {
    if (fmi <= 1.5) return 100;
    if (fmi <= 5) return 100 - (fmi - 1.5) * (50 / 3.5);
    return Math.max(0, 49 - (fmi - 5) * 10);
  }
  if (fmi <= 3.4) return 100;
  if (fmi <= 8) return 100 - (fmi - 3.4) * (50 / 4.6);
  return Math.max(0, 49 - (fmi - 8) * 10);
}

function ffmiScore(ffmi, sex) {
  const low = sex === "M" ? 16 : 13;
  const healthy = sex === "M" ? 18 : 15;
  const top = sex === "M" ? 22.3 : 17.8;
  if (ffmi <= low) return 0;
  if (ffmi < healthy) return (ffmi - low) * (49 / (healthy - low));
  if (ffmi < top) return 50 + (ffmi - healthy) * (50 / (top - healthy));
  return 100;
}

function gvriScore(gv) {
  return gv <= 12 ? 100 - (gv - 1) * (50 / 11) : 50 - (gv - 12) * 2;
}

function soriScore(fmi, ffmi, sex) {
  const fmiThr = sex === "M" ? 8 : 11;
  const ffmiThr = sex === "M" ? 18 : 15.5;
  const r = Math.max((fmi - fmiThr) / fmiThr, 0) + Math.max((ffmiThr - ffmi) / ffmiThr, 0);
  if (r <= 0) return 95;
  if (r <= 0.1) return 95 + r * ((85 - 95) / 0.1);
  if (r <= 0.25) return 85 + (r - 0.1) * ((70 - 85) / 0.15);
  if (r <= 0.5) return 70 + (r - 0.25) * ((45 - 70) / 0.25);
  if (r <= 0.75) return 45 + (r - 0.5) * ((30 - 45) / 0.25);
  return 30;
}

function ageBand(age) {
  if (!age) return 2;
  if (age < 30) return 1;
  if (age < 40) return 2;
  if (age < 50) return 3;
  if (age < 60) return 4;
  return 5;
}

function vo2Benchmarks(sex, age) {
  const b = ageBand(age);
  const male = {
    low: [24.9, 22.9, 19.9, 17.9, 15.9],
    mid: [33.9, 30.9, 26.9, 24.9, 22.9],
    good: [43.9, 41.9, 38.9, 37.9, 35.9],
    elite: [52.9, 49.9, 44.9, 42.9, 40.9],
  };
  const female = {
    low: [23.9, 19.9, 16.9, 14.9, 12.9],
    mid: [30.9, 27.9, 24.9, 21.9, 20.9],
    good: [38.9, 36.9, 34.9, 33.9, 32.9],
    elite: [48.9, 44.9, 41.9, 39.9, 36.9],
  };
  const table = sex === "M" ? male : female;
  return { low: table.low[b - 1], mid: table.mid[b - 1], good: table.good[b - 1], elite: table.elite[b - 1] };
}

function parseTime(value) {
  if (!value || !value.includes(":")) return 0;
  const [m, s] = value.split(":").map(Number);
  return (m || 0) * 60 + (s || 0);
}

function enduranceScore(vo2, sex, age) {
  const b = vo2Benchmarks(sex, age);
  if (!vo2 || vo2 < 10) return 0;
  if (vo2 < b.low) return vo2 * 20 / b.low;
  if (vo2 <= b.mid) return 20 + (vo2 - b.low) * 20 / (b.mid - b.low);
  if (vo2 <= b.good) return 40 + (vo2 - b.mid) * 20 / (b.good - b.mid);
  if (vo2 <= b.elite) return 60 + (vo2 - b.good) * 20 / (b.elite - b.good);
  return Math.min(100, 80 + (vo2 - b.elite) * 2);
}

function pullScore(variant, pullLoad, pullReps, sex) {
  const load = clamp(pullLoad || 1, 1, 12);
  const band = (a, b) => a + (load - 1) * ((b - a) / 11);
  if (variant === "RING ROW") return band(1, 46);
  if (variant === "BANDA PESADA") return band(44, 56);
  if (variant === "BANDA SEMI PESADA") return band(54, 66);
  if (variant === "BANDA SEMI LEVE") return band(64, 76);
  if (variant === "BANDA LEVE") return band(74, 86);
  if (variant === "PULL UP") {
    if (pullReps >= 20) return 100;
    if (sex === "M") {
      if (pullReps >= 15) return load >= 3 ? 100 : load === 2 ? 95 : 90;
      if (pullReps >= 10) return Math.min(99, band(84, 95) + 4);
      if (pullReps >= 5) return Math.min(97, band(84, 95) + 2);
      return band(84, 95);
    }
    if (pullReps >= 5) return load >= 3 ? 100 : load === 2 ? 95 : 90;
    return band(84, 95);
  }
  return 0;
}

function metconScore(level, rounds, reps) {
  const total = (Number(rounds) || 0) * 27 + (Number(reps) || 0);
  if (!total) return { score: 0, total };
  const r = total / 27;
  if (level === "RX") return { total, score: clamp(20 + 80 * (r - 1) / 7, 20, 100) };
  if (level === "Intermediate") return { total, score: clamp(10 + 55 * (r - 1) / 7, 10, 65) };
  return { total, score: clamp(45 * (r - 1) / 7, 0, 45) };
}

function calculateAssessment(input, athlete) {
  const sex = athlete.sex;
  const bw = Number(input.bw), fat = Number(input.fat), muscle = Number(input.muscle), height = Number(input.height);
  const massFat = bw * (fat / 100);
  const mfr = massFat ? muscle / massFat : 0;
  const fmi = height ? massFat / (height ** 2) : 0;
  const ffmi = height ? (bw - massFat) / (height ** 2) : 0;
  const scoreG = clamp(round(fatScore(fat, sex), 0));
  const scoreMfr = clamp(round(mfrScore(mfr, sex), 0));
  const scoreFmi = clamp(round(fmiScore(fmi, sex), 0));
  const scoreFfmi = clamp(round(ffmiScore(ffmi, sex), 0));
  const scoreGvri = clamp(round(gvriScore(Number(input.visceral)), 0));
  const cri = round(clamp(0.4 * scoreGvri + 0.3 * scoreMfr + 0.2 * scoreFmi + 0.1 * scoreG), 0);
  const sori = round(clamp(soriScore(fmi, ffmi, sex)), 0);
  const fbi = round(clamp(0.45 * scoreG + 0.35 * scoreMfr + 0.2 * scoreGvri), 0);
  const health = round(clamp(0.6 * cri + 0.3 * sori + 0.1 * fbi), 1);

  const backRm = oneRm(Number(input.backLoad), Number(input.backReps));
  const pressRm = oneRm(Number(input.pressLoad), Number(input.pressReps));
  const backRelative = bw ? backRm / bw : 0;
  const pressRelative = bw ? pressRm / bw : 0;
  const backScore = clamp(backRelative / (sex === "M" ? 2 : 1.5) * 100);
  const pressScore = sex === "M"
    ? interpolateStrength(pressRelative, [[0.4, 25], [0.6, 50], [0.8, 75], [1, 100]])
    : interpolateStrength(pressRelative, [[0.25, 25], [0.4, 50], [0.55, 75], [0.7, 100]]);
  const pull = pullScore(input.pullVariant, Number(input.pullLoad), Number(input.pullReps), sex);
  const strength = round(clamp(backScore * 0.34 + pressScore * 0.33 + pull * 0.33), 1);

  const seconds = parseTime(input.rowTime);
  const vo2TwoK = seconds && bw ? (((14.2 - 1.5 * (seconds / 60)) * 1000) / bw) + 3.5 : 0;
  const distance = Number(input.rowDistance);
  const vo2Six = distance && bw ? 1.74 * (((2.8 / ((360 / distance) ** 3)) * 6.12) / bw) + 3.5 : 0;
  const vo2 = Math.max(vo2TwoK, vo2Six);
  const endurance = round(clamp(enduranceScore(vo2, sex, Number(athlete.age))), 1);

  const metcon = metconScore(input.metconLevel, input.rounds, input.reps);
  const total = round(clamp(health * 0.4 + strength * 0.2 + endurance * 0.2 + metcon.score * 0.2), 1);
  return {
    id: crypto.randomUUID(),
    athleteId: athlete.id,
    date: input.date,
    inputs: input,
    derived: {
      massFat: round(massFat), mfr: round(mfr), fmi: round(fmi), ffmi: round(ffmi), whtr: input.waist && height ? round(Number(input.waist) / (height * 100), 2) : 0,
      cri, sori, fbi, health, backRm: round(backRm), pressRm: round(pressRm), backScore: round(backScore), pressScore: round(pressScore), pullScore: round(pull),
      strength, vo2: round(vo2), endurance, metconTotal: metcon.total, metcon: round(metcon.score), total
    },
    notes: input.notes || "",
    createdAt: new Date().toISOString()
  };
}

function interpolateStrength(value, points) {
  if (value >= points[points.length - 1][0]) return 100;
  for (let i = 0; i < points.length; i++) {
    if (value < points[i][0]) {
      const prev = points[i - 1] || [0, 0];
      const curr = points[i];
      return prev[1] + (value - prev[0]) * ((curr[1] - prev[1]) / (curr[0] - prev[0]));
    }
  }
  return 100;
}

function switchView(view) {
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === view));
  $$(".view").forEach(v => v.classList.toggle("active", v.id === view));
}

function render() {
  renderAthletes();
  renderDashboard();
  renderSelect();
}

function latestAssessments() {
  return state.athletes.map(a => {
    const assessments = state.assessments.filter(x => x.athleteId === a.id).sort((x, y) => x.date.localeCompare(y.date));
    return { athlete: a, assessments, latest: assessments.at(-1) };
  }).filter(x => x.latest);
}

function renderDashboard() {
  const rows = latestAssessments().filter(row => {
    const sex = $("#filterSex").value;
    const group = $("#filterGroup").value.trim().toLowerCase();
    return (!sex || row.athlete.sex === sex) && (!group || (row.athlete.group || "").toLowerCase().includes(group));
  });
  const scores = rows.map(r => r.latest.derived.total);
  $("#metricAthletes").textContent = rows.length;
  $("#metricAverage").textContent = round(average(scores), 1);
  const zoneCounts = { Sickness: 0, Wellness: 0, Fitness: 0 };
  rows.forEach(r => zoneCounts[zone(r.latest.derived.total).key]++);
  $("#metricZone").textContent = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  $("#metricProgress").textContent = bestProgress();
  drawDonut($("#zoneChart"), zoneCounts);
  drawBoxTrend($("#boxTrend"));
  renderDifficulty(rows);
}

function bestProgress() {
  let best = null;
  state.athletes.forEach(a => {
    const list = state.assessments.filter(x => x.athleteId === a.id).sort((x, y) => x.date.localeCompare(y.date));
    if (list.length > 1) {
      const delta = list.at(-1).derived.total - list[0].derived.total;
      if (!best || delta > best.delta) best = { name: a.name, delta };
    }
  });
  return best ? `${best.name} +${round(best.delta, 1)}` : "-";
}

function renderAthletes() {
  const list = $("#athleteList");
  list.innerHTML = "";
  state.athletes.forEach(a => {
    const count = state.assessments.filter(x => x.athleteId === a.id).length;
    const item = document.createElement("button");
    item.className = "list-item";
    item.type = "button";
    item.innerHTML = `<span><strong>${a.name}</strong><span>${a.code} · ${a.sex} · ${a.group || "sem grupo"}</span></span><span class="pill">${count} aval.</span>`;
    item.addEventListener("click", () => {
      $("#selectedAthlete").value = a.id;
      switchView("admin");
    });
    list.appendChild(item);
  });
}

function renderSelect() {
  const select = $("#selectedAthlete");
  select.innerHTML = state.athletes.map(a => `<option value="${a.id}">${a.name} · ${a.code}</option>`).join("");
}

function renderDifficulty(rows) {
  const tests = [
    ["Health Index", r => r.latest.derived.health],
    ["Força relativa", r => r.latest.derived.strength],
    ["Endurance", r => r.latest.derived.endurance],
    ["Metcon", r => r.latest.derived.metcon],
  ].map(([name, getter]) => [name, average(rows.map(getter))]).sort((a, b) => a[1] - b[1]);
  $("#difficultyList").innerHTML = tests.map(([name, value]) => `
    <div>
      <div class="row"><strong>${name}</strong><span>${round(value, 1)}/100</span></div>
      <div class="bar"><span style="width:${clamp(value)}%"></span></div>
    </div>`).join("");
}

function drawDonut(canvas, counts) {
  const ctx = canvas.getContext("2d");
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "700 14px Inter, sans-serif";
  ctx.fillStyle = "#151518";
  ctx.fillText("Distribuição S-W-F", 24, 30);
  if (!total) return;
  let start = -Math.PI / 2;
  const colors = { Sickness: "#e04444", Wellness: "#f5a524", Fitness: "#1fb56f" };
  Object.entries(counts).forEach(([key, value]) => {
    const angle = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(132, 128, 72, start, start + angle);
    ctx.lineWidth = 34;
    ctx.strokeStyle = colors[key];
    ctx.stroke();
    start += angle;
  });
  ctx.fillStyle = "#6f737a";
  Object.keys(colors).forEach((key, i) => {
    ctx.fillStyle = colors[key]; ctx.fillRect(245, 82 + i * 32, 12, 12);
    ctx.fillStyle = "#151518"; ctx.fillText(`${key}: ${counts[key]}`, 266, 94 + i * 32);
  });
}

function drawBoxTrend(canvas) {
  const byDate = {};
  state.assessments.forEach(a => {
    byDate[a.date] ||= [];
    byDate[a.date].push(a.derived.total);
  });
  const points = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, scores]) => ({ date, value: average(scores) }));
  drawLine(canvas, points, "Evolução média da box");
}

function drawLine(canvas, points, title) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "700 14px Inter, sans-serif";
  ctx.fillStyle = "#151518";
  ctx.fillText(title, 24, 30);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = 54 + i * 34;
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(canvas.width - 24, y); ctx.stroke();
  }
  if (!points.length) return;
  const minX = 48, maxX = canvas.width - 32, minY = 198, maxY = 54;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = points.length === 1 ? (minX + maxX) / 2 : minX + i * ((maxX - minX) / (points.length - 1));
    const y = minY - clamp(p.value) * ((minY - maxY) / 100);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#ff6a00"; ctx.lineWidth = 4; ctx.stroke();
  points.forEach((p, i) => {
    const x = points.length === 1 ? (minX + maxX) / 2 : minX + i * ((maxX - minX) / (points.length - 1));
    const y = minY - clamp(p.value) * ((minY - maxY) / 100);
    ctx.fillStyle = "#0b0b0d"; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
  });
}

function drawRadar(canvas, assessment) {
  const ctx = canvas.getContext("2d");
  const values = [
    ["HI", assessment.derived.health],
    ["Força", assessment.derived.strength],
    ["Row", assessment.derived.endurance],
    ["Metcon", assessment.derived.metcon],
    ["Total", assessment.derived.total],
  ];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2, cy = 148, radius = 86;
  ctx.font = "700 13px Inter, sans-serif";
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    values.forEach((_, i) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / values.length;
      const r = radius * ring / 4;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath(); ctx.strokeStyle = "#e5e7eb"; ctx.stroke();
  }
  ctx.beginPath();
  values.forEach(([, value], i) => {
    const a = -Math.PI / 2 + i * Math.PI * 2 / values.length;
    const r = radius * clamp(value) / 100;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath(); ctx.fillStyle = "rgba(255,106,0,.22)"; ctx.fill(); ctx.strokeStyle = "#ff6a00"; ctx.lineWidth = 3; ctx.stroke();
  values.forEach(([label], i) => {
    const a = -Math.PI / 2 + i * Math.PI * 2 / values.length;
    ctx.fillStyle = "#151518"; ctx.fillText(label, cx + Math.cos(a) * 112 - 18, cy + Math.sin(a) * 112 + 4);
  });
}

function showReport(athlete, assessments) {
  const template = $("#reportTemplate").content.cloneNode(true);
  const card = $(".report-card", template);
  const latest = assessments.at(-1);
  const previous = assessments.at(-2);
  const z = zone(latest.derived.total);
  $("[data-name]", card).textContent = athlete.name;
  $("[data-meta]", card).textContent = `${latest.date} · ${athlete.sex} · ${athlete.age} anos · Código ${athlete.code}`;
  $("[data-score]", card).textContent = latest.derived.total;
  $("[data-score-ring]", card).style.setProperty("--score", `${latest.derived.total}%`);
  $("[data-curve]", card).innerHTML = `
    <div class="curve-track"><div class="curve-marker" style="--x:${clamp(latest.derived.total)}%" data-label="${z.label}"></div></div>
    <div class="curve-labels"><span>Sickness 0-39</span><span>Wellness 40-69</span><span>Fitness 70-100</span></div>`;
  $("[data-results]", card).innerHTML = resultRows(latest, previous);
  $("[data-notes]", card).innerHTML = `<strong>Notas do coach</strong><p>${latest.notes || "Sem notas registadas."}</p><p><strong>Recomendação geral:</strong> manter consistência semanal, atacar o ponto mais baixo do radar e repetir avaliação em 8 a 12 semanas.</p>`;
  $("#athleteReport").innerHTML = "";
  $("#athleteReport").appendChild(template);
  $("#athleteReport").classList.remove("hidden");
  drawRadar($("[data-radar]", card), latest);
  drawLine($("[data-trend]", card), assessments.map(a => ({ date: a.date, value: a.derived.total })), "Evolução do score total");
}

function resultRows(latest, previous) {
  const rows = [
    ["Health Index", latest.derived.health],
    ["Força Relativa", latest.derived.strength],
    ["Endurance Row", latest.derived.endurance],
    ["Metcon", latest.derived.metcon],
    ["CRI", latest.derived.cri],
    ["SORI", latest.derived.sori],
    ["FBI", latest.derived.fbi],
  ];
  return rows.map(([label, value]) => {
    const prev = previous ? previous.derived[keyFor(label)] : null;
    const delta = prev == null ? "" : `${value - prev >= 0 ? "+" : ""}${round(value - prev, 1)}`;
    return `<div class="result-row"><strong>${label}</strong><span>${round(value, 1)}</span><span class="pill">${delta || "novo"}</span></div>`;
  }).join("");
}

function keyFor(label) {
  return { "Health Index": "health", "Força Relativa": "strength", "Endurance Row": "endurance", "Metcon": "metcon", "CRI": "cri", "SORI": "sori", "FBI": "fbi" }[label];
}

function readAssessmentForm() {
  return Object.fromEntries($$("#assessmentForm input, #assessmentForm select, #assessmentForm textarea").map(el => [el.id, el.value]));
}

function seedDemoData() {
  const athletes = [
    { id: crypto.randomUUID(), name: "Marta Silva", sex: "F", age: 34, group: "18h30", code: "MAR-24FHT" },
    { id: crypto.randomUUID(), name: "João Pereira", sex: "M", age: 41, group: "07h00", code: "JOA-41FHT" },
    { id: crypto.randomUUID(), name: "Ana Costa", sex: "F", age: 28, group: "12h30", code: "ANA-28FHT" },
  ];
  const base = [
    { date: "2026-01-12", bw: 68, fat: 24, muscle: 31, visceral: 6, tbw: 51, height: 1.65, waist: 78, backLoad: 72, backReps: 3, pressLoad: 32, pressReps: 3, pullVariant: "BANDA SEMI LEVE", pullLoad: 6, pullReps: 8, rowTime: "", rowDistance: 1230, metconLevel: "Intermediate", rounds: 5, reps: 9, notes: "Boa base. Priorizar força de puxar e consistência no row." },
    { date: "2026-04-18", bw: 67, fat: 21, muscle: 32, visceral: 5, tbw: 53, height: 1.65, waist: 75, backLoad: 82, backReps: 3, pressLoad: 35, pressReps: 3, pullVariant: "BANDA LEVE", pullLoad: 8, pullReps: 9, rowTime: "", rowDistance: 1320, metconLevel: "Intermediate", rounds: 6, reps: 4, notes: "Evolução clara. Próximo foco: RX progressivo no metcon." },
  ];
  state.athletes = athletes;
  state.assessments = [];
  athletes.forEach((athlete, i) => {
    base.forEach((sample, j) => {
      const shifted = { ...sample, fat: sample.fat + i * 2 - j, bw: sample.bw + i * 5, muscle: sample.muscle + i * 4, backLoad: sample.backLoad + i * 20, pressLoad: sample.pressLoad + i * 12 };
      state.assessments.push(calculateAssessment(shifted, athlete));
    });
  });
  saveState();
  render();
}

$$(".tab").forEach(tab => tab.addEventListener("click", () => switchView(tab.dataset.view)));
$("#newAthleteCode").addEventListener("click", () => { $("#athleteCode").value = generateCode($("#athleteName").value); });
$("#athleteName").addEventListener("input", () => { if (!$("#athleteCode").value) $("#athleteCode").value = generateCode($("#athleteName").value); });
$("#loginForm").addEventListener("submit", event => {
  event.preventDefault();
  if ($("#adminPassword").value === ADMIN_PASSWORD) $("#adminTools").classList.remove("hidden");
  else alert("Palavra-passe incorreta neste protótipo.");
});
$("#athleteForm").addEventListener("submit", event => {
  event.preventDefault();
  state.athletes.push({ id: crypto.randomUUID(), name: $("#athleteName").value, sex: $("#athleteSex").value, age: Number($("#athleteAge").value), group: $("#athleteGroup").value, code: $("#athleteCode").value || generateCode($("#athleteName").value) });
  saveState();
  event.target.reset();
  render();
});
$("#assessmentForm").addEventListener("submit", event => {
  event.preventDefault();
  const athlete = state.athletes.find(a => a.id === $("#selectedAthlete").value);
  if (!athlete) return alert("Cria ou seleciona um atleta primeiro.");
  state.assessments.push(calculateAssessment(readAssessmentForm(), athlete));
  saveState();
  render();
  alert("Avaliação guardada.");
});
$("#codeForm").addEventListener("submit", event => {
  event.preventDefault();
  const code = $("#accessCode").value.trim().toUpperCase();
  const athlete = state.athletes.find(a => a.code.toUpperCase() === code);
  if (!athlete) return alert("Código não encontrado.");
  const assessments = state.assessments.filter(a => a.athleteId === athlete.id).sort((a, b) => a.date.localeCompare(b.date));
  if (!assessments.length) return alert("Este atleta ainda não tem avaliações.");
  showReport(athlete, assessments);
});
$("#seedDemo").addEventListener("click", seedDemoData);
$("#resetData").addEventListener("click", () => { localStorage.removeItem(STORAGE_KEY); state = loadState(); render(); });
$("#filterSex").addEventListener("change", renderDashboard);
$("#filterGroup").addEventListener("input", renderDashboard);

$("#date").valueAsDate = new Date();
$("#athleteCode").value = generateCode();
render();
