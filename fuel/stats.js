// Motore di calcolo condiviso da app mobile (fuel/index.html) e dashboard web (fuel/web/web.html).
// JavaScript puro senza dipendenze: espone window.FuelStats. Ogni numero mostrato dalle due app nasce qui.
(function (global) {
  "use strict";

  const TANK_CAP = 71;
  const FUEL_TYPES = ["B7", "HVO", "Diesel+", "Mix"];
  const CETANE = { B7: 51, HVO: 75, "Diesel+": 60, Mix: 55 };
  const DAY = 86400000;
  const MIN_TREND_SEGMENTS = 3;   // sotto questa soglia un grafico di andamento non dice nulla
  const MIN_SCATTER_SEGMENTS = 8;

  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const isMissed = (e) => /\[missed\]/i.test(e.notes || "");
  const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const dayMs = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const daysBetween = (a, b) => (dayMs(b) - dayMs(a)) / DAY;
  const itToIso = (s) => { const [d, m, y] = s.split("/"); return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; };
  const monthLabel = (ym) => new Date(ym + "-15").toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
  const fmtDay = (iso) => new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "2-digit" });
  const nextMonth = (ym) => { let y = +ym.slice(0, 4), m = +ym.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } return `${y}-${String(m).padStart(2, "0")}`; };

  // Affidabilità di una media di consumo, in base ai km e ai tratti che la sostengono
  const reliability = (km, n) => !n ? null : km >= 2000 && n >= 3 ? "alta" : km >= 800 ? "media" : "bassa";

  // Consumo "full-to-full": accumula i rifornimenti parziali e misura la distanza dall'ultimo pieno completo.
  // Segmento con un rifornimento non registrato (nota "[MISSED]", da Fuelio) → consumo non calcolabile.
  // calc.fuel = carburante bruciato nel segmento (quello presente nel serbatoio mentre si guida, ≥80% del volume), null se misto.
  const enrich = (sorted) => {
    const out = sorted.map(e => ({ ...e, calc: null }));
    const seg = sorted.map(() => -1);                                   // pieno che chiude il segmento in cui ricadono i km prima di e
    let lastFull = -1, L = 0, cost = 0, missed = false;
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      if (lastFull >= 0) { L += e.liters; cost += e.totalCost; if (isMissed(e)) missed = true; }   // include anche i parziali
      if (e.fullTank) {
        const km = lastFull >= 0 ? e.odometer - sorted[lastFull].odometer : 0;
        if (km > 0) {
          if (!missed) out[i].calc = { kmDriven: km, lPer100: L / km * 100, costPerKm: cost / km, liters: L, cost, fuel: null, startDate: sorted[lastFull].date };
          for (let j = lastFull + 1; j <= i; j++) seg[j] = i;
          lastFull = i; L = 0; cost = 0; missed = false;
        } else if (lastFull < 0) { lastFull = i; }                    // primo pieno = baseline
      }
    }
    // Simula la composizione del serbatoio per sapere quale carburante è stato bruciato in ogni segmento
    const done = out.filter(e => e.calc), sumKm = sum(done, e => e.calc.kmDriven);
    const avgRate = sumKm > 0 ? sum(done, e => e.calc.liters) / sumKm * 100 : 7;
    const tank = {}, burned = {};
    const tot = () => Object.values(tank).reduce((a, b) => a + b, 0);
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      if (i === 0) { tank[e.fuelType] = e.fullTank ? TANK_CAP : e.liters; continue; }   // residuo iniziale ignoto: si assume stesso carburante
      const t = tot(), s = seg[i];
      const rate = s >= 0 && out[s].calc ? out[s].calc.lPer100 : avgRate;
      const want = e.fullTank ? t - (TANK_CAP - e.liters) : (e.odometer - sorted[i - 1].odometer) * rate / 100;
      const b = Math.min(t, Math.max(0, want));
      if (t > 0 && b > 0) {
        const r = b / t;
        for (const f in tank) { const x = tank[f] * r; tank[f] -= x; if (s >= 0) { burned[s] = burned[s] || {}; burned[s][f] = (burned[s][f] || 0) + x; } }
      }
      tank[e.fuelType] = (tank[e.fuelType] || 0) + e.liters;
      const t2 = tot(); if (t2 > TANK_CAP) for (const f in tank) tank[f] *= TANK_CAP / t2;
    }
    out.forEach((e, i) => {
      if (!e.calc) return;
      const b = Object.entries(burned[i] || {}).sort((x, y) => y[1] - x[1]), tb = b.reduce((a, x) => a + x[1], 0);
      e.calc.fuel = tb > 0 && b[0][1] / tb >= 0.8 ? b[0][0] : null;
    });
    return out;
  };

  // Composizione stimata del serbatoio dopo l'ultimo rifornimento registrato
  const tankComposition = (sorted, avgL) => {
    const tank = { B7: 0, HVO: 0, "Diesel+": 0, Mix: 0 };
    const avgCons = avgL || 7;
    const getTot = () => tank.B7 + tank.HVO + tank["Diesel+"] + tank.Mix;
    const sc = (r) => { for (const f in tank) tank[f] *= r; };
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      if (i > 0) {
        const tot = getTot();
        if (e.fullTank) { if (tot > 0) sc(Math.max(0, TANK_CAP - e.liters) / tot); }
        else if (tot > 0) sc(Math.max(0, tot - (e.odometer - sorted[i - 1].odometer) * avgCons / 100) / tot);
      }
      tank[e.fuelType] = (tank[e.fuelType] || 0) + e.liters;
      const tot = getTot(); if (tot > TANK_CAP) sc(TANK_CAP / tot);
    }
    const tot = getTot();
    const cetane = tot > 0 ? sum(FUEL_TYPES, f => tank[f] * CETANE[f]) / tot : 0;
    const pct = (f) => tot > 0 ? tank[f] / tot * 100 : 0;
    return { B7: tank.B7, HVO: tank.HVO, "Diesel+": tank["Diesel+"], Mix: tank.Mix, total: tot, cetane,
      pctB7: pct("B7"), pctHVO: pct("HVO"), "pctDiesel+": pct("Diesel+"), pctMix: pct("Mix") };
  };

  // cfg: { insuranceAnnual, insuranceStart, ownershipStart (ISO), depreciationPerYear (€/anno, opzionale) }
  const computeStats = (entries, maint, cfg = {}) => {
    const sorted = [...entries].sort((a, b) => a.odometer - b.odometer || a.date.localeCompare(b.date));
    const enriched = enrich(sorted);
    const withCalc = enriched.filter(e => e.calc);
    const byDate = [...entries].sort((a, b) => a.date.localeCompare(b.date));

    // ── Totali ──
    const liters = sum(entries, e => e.liters), cost = sum(entries, e => e.totalCost);
    const km = sum(withCalc, e => e.calc.kmDriven);
    const segL = sum(withCalc, e => e.calc.liters), segC = sum(withCalc, e => e.calc.cost);
    const avgL = km > 0 ? segL / km * 100 : null, avgC = km > 0 ? segC / km : null;
    const firstDate = byDate.length ? byDate[0].date : null, lastDate = byDate.length ? byDate[byDate.length - 1].date : null;
    const odoSpan = sorted.length ? sorted[sorted.length - 1].odometer - sorted[0].odometer : 0;
    const months = byDate.map(e => e.date.slice(0, 7));
    const monthCount = months.length ? (+months[months.length - 1].slice(0, 4) - +months[0].slice(0, 4)) * 12 + (+months[months.length - 1].slice(5) - +months[0].slice(5)) + 1 : 0;
    const lp = withCalc.map(e => e.calc.lPer100), cp = withCalc.map(e => e.calc.costPerKm);
    const stats = {
      n: entries.length, liters, cost, km, avgL, avgC,
      per100: avgC != null ? avgC * 100 : null,
      minL: lp.length ? Math.min(...lp) : null, maxL: lp.length ? Math.max(...lp) : null,
      minC: cp.length ? Math.min(...cp) : null, maxC: cp.length ? Math.max(...cp) : null,
      avgLiters: entries.length ? liters / entries.length : null,
      avgPrice: liters > 0 ? cost / liters : null,                                   // pesato sui litri
      avgDist: withCalc.length ? km / withCalc.length : null,
      avgMonthly: monthCount > 0 ? cost / monthCount : null,                         // include i mesi senza rifornimenti
      odometer: sorted.length ? sorted[sorted.length - 1].odometer : null,
      segments: withCalc.length, firstDate, lastDate, odoSpan,
      autonomy: avgL ? TANK_CAP / avgL * 100 : null,
      autonomyRange: avgL && lp.length ? [TANK_CAP / Math.max(...lp) * 100, TANK_CAP / Math.min(...lp) * 100] : null,
    };

    // ── Per carburante (consumo solo da tratti "puri") ──
    const byFuel = FUEL_TYPES.map(ft => {
      const f = withCalc.filter(e => e.calc.fuel === ft), all = entries.filter(e => e.fuelType === ft);
      const fk = sum(f, e => e.calc.kmDriven), fl = sum(all, e => e.liters);
      const avgLf = fk > 0 ? sum(f, e => e.calc.liters) / fk * 100 : null;
      const price = fl > 0 ? sum(all, e => e.totalCost) / fl : null;
      return { type: ft, count: all.length, liters: fl, cost: sum(all, e => e.totalCost), price,
        segments: f.length, km: fk, avgL: avgLf, avgC: fk > 0 ? sum(f, e => e.calc.cost) / fk : null,
        minL: f.length ? Math.min(...f.map(e => e.calc.lPer100)) : null, maxL: f.length ? Math.max(...f.map(e => e.calc.lPer100)) : null,
        reliability: reliability(fk, f.length) };
    }).filter(s => s.count > 0);

    // ── Mensile (mesi senza rifornimenti inclusi, a zero) ──
    const m = {};
    if (months.length) for (let ym = months[0]; ym <= months[months.length - 1]; ym = nextMonth(ym)) m[ym] = { month: ym, liters: 0, cost: 0, count: 0, types: {}, km: 0, totL: 0, totC: 0 };
    entries.forEach(e => { const x = m[e.date.slice(0, 7)]; x.liters += e.liters; x.cost += e.totalCost; x.count++; x.types[e.fuelType] = (x.types[e.fuelType] || 0) + e.liters; });
    withCalc.forEach(e => { const x = m[e.date.slice(0, 7)]; x.km += e.calc.kmDriven; x.totL += e.calc.liters; x.totC += e.calc.cost; });
    const monthly = Object.values(m).map(x => ({
      ...x, label: monthLabel(x.month),
      "l/100km": x.km > 0 ? +(x.totL / x.km * 100).toFixed(2) : null,
      "€/km": x.km > 0 ? +(x.totC / x.km).toFixed(3) : null,
      "€/L": x.liters > 0 ? +(x.cost / x.liters).toFixed(3) : null,
      cost: +x.cost.toFixed(2),
      B7: x.types.B7 || 0, HVO: x.types.HVO || 0, "Diesel+": x.types["Diesel+"] || 0, Mix: x.types.Mix || 0,
    }));

    // ── Serie temporali (asse = tempo reale; ogni tratto sta a metà del suo periodo, il pallino è proporzionale ai km) ──
    const maxKm = Math.max(1, ...withCalc.map(e => e.calc.kmDriven));
    const series = withCalc.map(e => ({
      t: (dayMs(e.calc.startDate) + dayMs(e.date)) / 2, date: fmtDay(e.date), from: fmtDay(e.calc.startDate),
      "l/100km": +e.calc.lPer100.toFixed(2), "€/km": +e.calc.costPerKm.toFixed(3), km: e.calc.kmDriven,
      liters: +e.calc.liters.toFixed(1), fuel: e.calc.fuel || "Mix", r: 2.5 + 5.5 * Math.sqrt(e.calc.kmDriven / maxKm),
    }));
    const priceSeries = byDate.map(e => ({ t: dayMs(e.date), date: fmtDay(e.date), "€/L": +e.pricePerLiter.toFixed(3), fuel: e.fuelType }));
    let cC = 0, cL = 0, cK = 0;
    const kmAt = {}; withCalc.forEach(e => { kmAt[e.id] = e.calc.kmDriven; });
    const cumulative = byDate.map(e => { cC += e.totalCost; cL += e.liters; cK += kmAt[e.id] || 0;
      return { t: dayMs(e.date), date: fmtDay(e.date), "€ Totali": +cC.toFixed(0), "Litri Totali": +cL.toFixed(0), "Km Totali": cK }; });

    const buckets = [0, 20, 30, 40, 50, 60, Infinity];
    const fillSizes = buckets.slice(0, -1).map((b, i) => ({
      range: isFinite(buckets[i + 1]) ? `${b}-${buckets[i + 1]}L` : `${b}+L`,
      count: entries.filter(e => e.liters >= b && e.liters < buckets[i + 1]).length }));

    // ── Manutenzione ──
    const maintCost = sum(maint, x => x.cost);
    const mt = {}; maint.forEach(x => { mt[x.type] = mt[x.type] || { type: x.type, cost: 0, count: 0 }; mt[x.type].cost += x.cost; mt[x.type].count++; });
    const maintByType = Object.values(mt).sort((a, b) => b.cost - a.cost);

    // ── Costo di possesso nello stesso periodo coperto dai km (dall'inizio possesso all'ultimo rifornimento) ──
    let ownership = null;
    if (lastDate) {
      const from = cfg.ownershipStart && cfg.ownershipStart < lastDate ? cfg.ownershipStart : firstDate;
      const days = Math.max(1, daysBetween(from, lastDate));
      const insDays = cfg.insuranceStart ? Math.max(0, daysBetween(cfg.insuranceStart > from ? cfg.insuranceStart : from, lastDate)) : 0;
      const insurance = cfg.insuranceAnnual ? cfg.insuranceAnnual * Math.min(insDays, 365) / 365 : 0;
      const depreciation = cfg.depreciationPerYear ? cfg.depreciationPerYear * days / 365 : 0;
      const total = cost + maintCost + insurance + depreciation;
      const items = [
        { name: "Carburante", value: cost, color: "#0099ff" },
        { name: "Manutenzione", value: maintCost, color: "#ffa832" },
        { name: "Assicurazione", value: insurance, color: "#c080ff", note: `${Math.round(insDays)} gg su 365` },
        { name: "Svalutazione", value: depreciation, color: "#ff6b6b" },
      ].filter(x => x.value > 0).map(x => ({ ...x, value: +x.value.toFixed(0), pct: total > 0 ? x.value / total * 100 : 0 }));
      ownership = { from, to: lastDate, days, fuel: cost, maint: maintCost, insurance, depreciation, total, items,
        perKm: odoSpan > 0 ? total / odoSpan : null, per100: odoSpan > 0 ? total / odoSpan * 100 : null };
    }

    // ── Proiezione annua (serve almeno un mese di dati) ──
    let projection = null;
    const spanDays = firstDate ? daysBetween(firstDate, lastDate) : 0;
    if (spanDays >= 30 && odoSpan > 0) {
      const kmYear = odoSpan / spanDays * 365;
      const fuelYear = avgC != null ? kmYear * avgC : null;
      const insuranceYear = cfg.insuranceAnnual || 0, depYear = cfg.depreciationPerYear || 0;
      const totalYear = fuelYear != null ? fuelYear + insuranceYear + depYear : null;
      projection = { kmYear, kmMonth: kmYear / 12, fuelYear, insuranceYear, depreciationYear: depYear, totalYear, totalMonth: totalYear != null ? totalYear / 12 : null, basisDays: spanDays };
    }

    // ── HVO vs B7: sovrapprezzo stimato ──
    let hvoVsB7 = null;
    const H = byFuel.find(f => f.type === "HVO"), B = byFuel.find(f => f.type === "B7");
    if (H && B && H.price && B.price && avgL) {
      const premium = H.price - B.price;                                           // €/L in più pagati per l'HVO
      const byPrice = projection ? projection.kmYear * avgL / 100 * premium : null; // a parità di consumo (dato robusto)
      const measured = H.avgL && B.avgL ? {
        hvoPer100: H.avgL * H.price, b7Per100: B.avgL * B.price,
        extraYear: projection ? (H.avgL * H.price - B.avgL * B.price) * projection.kmYear / 100 : null,
        reliability: [H.reliability, B.reliability].includes("bassa") ? "bassa" : [H.reliability, B.reliability].includes("media") ? "media" : "alta",
        hvoKm: H.km, b7Km: B.km } : null;
      hvoVsB7 = { premium, hvoPrice: H.price, b7Price: B.price, extraYearByPrice: byPrice, measured };
    }

    const tankComp = tankComposition(sorted, avgL);
    const enough = { trend: withCalc.length >= MIN_TREND_SEGMENTS, scatter: withCalc.length >= MIN_SCATTER_SEGMENTS,
      monthly: monthly.filter(x => x.count > 0).length >= 2, monthlyCons: monthly.filter(x => x.km > 0).length >= 2 };

    return { sorted, enriched, withCalc, stats, byFuel, monthly, series, priceSeries, cumulative, fillSizes,
      maintCost, maintByType, ownership, projection, hvoVsB7, tankComp, enough };
  };

  global.FuelStats = { TANK_CAP, FUEL_TYPES, CETANE, today, isMissed, itToIso, dayMs, enrich, tankComposition, computeStats, reliability };
})(typeof window !== "undefined" ? window : globalThis);
