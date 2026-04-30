const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyskzOo4jky0pk70GKEXcIgiuXERtdn8ttLbTC16WVqxc7IAk3AAyrFI_mpc6JhnAHyig/exec';

const PUTAWAY_SHEET_ID   = '1iVtfK7zbRbBQ8AcdukVeC2d90Tjf_m1iPqM5QI_EWNw';
const PUTAWAY_SHEET_NAME = 'REKAP PROD PER DAY';

app.use(express.static('public'));

app.get('/api/data', async (req, res) => {
  try {
    const response = await fetch(APPS_SCRIPT_URL, { redirect: 'follow' });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rekap', async (req, res) => {
  try {
    const response = await fetch(APPS_SCRIPT_URL + '?action=rekap', { redirect: 'follow' });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/summary', async (req, res) => {
  try {
    const response = await fetch(APPS_SCRIPT_URL + '?action=summary', { redirect: 'follow' });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/putaway', async (req, res) => {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${PUTAWAY_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(PUTAWAY_SHEET_NAME)}`;
    const response = await fetch(url);
    const text = await response.text();

    const lines = text.replace(/\r/g, '').split('\n');

    const parseRow = line => {
      const result = []; let cur = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQ = !inQ; }
        else if (line[i] === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
        else { cur += line[i]; }
      }
      result.push(cur.trim());
      return result;
    };

    const rows = lines.map(parseRow);
    const headerRow = rows[0];
    const dates = headerRow.slice(3).filter(d => d && d.trim() !== '');

    // Dynamic label mapping: find rows by col C (index 2) label
    const LABEL_MAP = {
      'FR Accuracy':                     { label: 'FR Accuracy %',              isPct: true  },
      'Forcast Qty':                     { label: 'Forecast Qty',               isPct: false },
      'Actual Qty':                      { label: 'Actual Qty',                 isPct: false },
      'Mezanine':                        { label: 'Mezanine',                   isPct: false },
      'Spr':                             { label: 'Spr',                        isPct: false },
      'High Risk':                       { label: 'High Risk',                  isPct: false },
      'Pallet Floor':                    { label: 'Pallet Floor',               isPct: false },
      'Stg Galon':                       { label: 'Stg Galon',                  isPct: false },
      'Stg Relabel':                     { label: 'Stg Relabel',                isPct: false },
      'Mezanine %':                      { label: 'Mezanine %',                 isPct: true  },
      'Spr %':                           { label: 'Spr %',                      isPct: true  },
      'High Risk %':                     { label: 'High Risk %',                isPct: true  },
      'Pallet Floor %':                  { label: 'Pallet Floor %',             isPct: true  },
      'Stg Gin %':                       { label: 'Stg Gin %',                  isPct: true  },
      'Stg Relabel %':                   { label: 'Stg Relabel %',              isPct: true  },
      'DPF':                             { label: 'DPF',                        isPct: false },
      'SPR':                             { label: 'SPR',                        isPct: false },
      'DPF %':                           { label: 'DPF %',                      isPct: true  },
      'SPR %':                           { label: 'SPR %',                      isPct: true  },
      'Direct to Mezanine by manual':    { label: 'Direct to Mezanine (Manual)', isPct: false },
      'Direct to Mezanine by system':    { label: 'Direct to Mezanine (System)', isPct: false },
      'Direct to Mezanine by manual %':  { label: 'Direct to Mezanine Manual %', isPct: true  },
      'Direct to Mezanine by system %':  { label: 'Direct to Mezanine System %', isPct: true  },
      'Total MP':                        { label: 'Total MP',                   isPct: false },
      'Sla Completion %':                { label: 'SLA Completion %',           isPct: true  },
      'Actual prod colective Qty':       { label: 'Actual Prod Qty',            isPct: false },
      'Actual prod colective (% Qty)':   { label: 'Actual Prod %',             isPct: true  },
    };

    const metrics = [];
    let fcRowData = null, actRowData = null, mpRowData = null;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const labelRaw = (row[2] || '').trim();
      if (!labelRaw) continue;

      const meta = LABEL_MAP[labelRaw];
      if (!meta) continue;

      const daily = {};
      dates.forEach((d, j) => {
        const raw = (row[3 + j] || '').replace('%', '').replace(',', '.').trim();
        const val = parseFloat(raw);
        daily[d] = isNaN(val) ? null : val;
      });
      metrics.push({ label: meta.label, isPct: meta.isPct, daily });

      if (meta.label === 'Forecast Qty') fcRowData = daily;
      if (meta.label === 'Actual Qty')   actRowData = daily;
      if (meta.label === 'Total MP')     mpRowData  = daily;
    }

    const sumDaily = (d) => d ? Object.values(d).reduce((s, v) => s + (v || 0), 0) : 0;
    const totalFC  = Math.round(sumDaily(fcRowData));
    const totalAct = Math.round(sumDaily(actRowData));
    const totalMP  = Math.round(sumDaily(mpRowData));
    const fr = totalFC > 0 ? Math.round(totalAct / totalFC * 100) : 0;

    res.json({ dates, metrics, kpi: { totalFC, totalAct, totalMP, fr } });
  } catch (err) {
    console.error('Putaway error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Debug: see raw CSV labels
app.get('/api/putaway/debug', async (req, res) => {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${PUTAWAY_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(PUTAWAY_SHEET_NAME)}`;
    const response = await fetch(url);
    const text = await response.text();
    const lines = text.replace(/\r/g, '').split('\n');
    const parseRow = line => {
      const result = []; let cur = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQ = !inQ; }
        else if (line[i] === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
        else { cur += line[i]; }
      }
      result.push(cur.trim());
      return result;
    };
    const rows = lines.map(parseRow);
    const labels = rows.map((r, i) => ({ row: i, colA: r[0], colB: r[1], colC: r[2], colD: r[3] }));
    res.json(labels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
