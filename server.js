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
    // dates start at col3 (index 3)
    const dates = headerRow.slice(3).filter(d => d && d.trim() !== '');

    // Row mapping confirmed from /api/putaway/debug:
    // row0 = header (dates), row1 = FR Accuracy %, row2 = Forecast Qty,
    // row3 = Actual Qty, row4 = Mezanine, row5 = Spr, row6 = High Risk,
    // row7 = Pallet Floor, row8 = Stg Galon, row9 = Stg Relabel,
    // row10 = blank, row11 = Mezanine %, row12 = Spr %, row13 = High Risk %,
    // row14 = Pallet Floor %, row15 = Stg Gin %, row16 = Stg Relabel %,
    // row17 = blank, row18 = DPF, row19 = SPR, row20 = DPF %, row21 = SPR %,
    // row22 = blank, row23 = Direct Manual, row24 = Direct System,
    // row25 = Direct Manual %, row26 = Direct System %,
    // row27 = blank, row28 = Total MP, row29 = SLA %, row30 = Actual Prod Qty, row31 = Actual Prod %
    const METRIC_ROWS = [
      { rowIdx: 1,  label: 'FR Accuracy %',              isPct: true  },
      { rowIdx: 2,  label: 'Forecast Qty',               isPct: false },
      { rowIdx: 3,  label: 'Actual Qty',                 isPct: false },
      { rowIdx: 4,  label: 'Mezanine',                   isPct: false },
      { rowIdx: 5,  label: 'Spr',                        isPct: false },
      { rowIdx: 6,  label: 'High Risk',                  isPct: false },
      { rowIdx: 7,  label: 'Pallet Floor',               isPct: false },
      { rowIdx: 8,  label: 'Stg Galon',                  isPct: false },
      { rowIdx: 9,  label: 'Stg Relabel',                isPct: false },
      { rowIdx: 11, label: 'Mezanine %',                 isPct: true  },
      { rowIdx: 12, label: 'Spr %',                      isPct: true  },
      { rowIdx: 13, label: 'High Risk %',                isPct: true  },
      { rowIdx: 14, label: 'Pallet Floor %',             isPct: true  },
      { rowIdx: 15, label: 'Stg Gin %',                  isPct: true  },
      { rowIdx: 16, label: 'Stg Relabel %',              isPct: true  },
      { rowIdx: 18, label: 'DPF',                        isPct: false },
      { rowIdx: 19, label: 'SPR',                        isPct: false },
      { rowIdx: 20, label: 'DPF %',                      isPct: true  },
      { rowIdx: 21, label: 'SPR %',                      isPct: true  },
      { rowIdx: 23, label: 'Direct to Mezanine (Manual)',isPct: false },
      { rowIdx: 24, label: 'Direct to Mezanine (System)',isPct: false },
      { rowIdx: 25, label: 'Direct to Mezanine Manual %',isPct: true  },
      { rowIdx: 26, label: 'Direct to Mezanine System %',isPct: true  },
      { rowIdx: 28, label: 'Total MP',                   isPct: false },
      { rowIdx: 29, label: 'SLA Completion %',           isPct: true  },
      { rowIdx: 30, label: 'Actual Prod Qty',            isPct: false },
      { rowIdx: 31, label: 'Actual Prod %',              isPct: true  },
    ];

    const metrics = [];
    let fcDaily = null, actDaily = null, mpDaily = null;

    for (const meta of METRIC_ROWS) {
      const row = rows[meta.rowIdx];
      if (!row) continue;
      const daily = {};
      dates.forEach((d, i) => {
        const raw = (row[3 + i] || '').replace('%', '').replace(/,/g, '').trim();
        const val = parseFloat(raw);
        daily[d] = isNaN(val) ? null : val;
      });
      metrics.push({ label: meta.label, isPct: meta.isPct, daily });
      if (meta.label === 'Forecast Qty') fcDaily  = daily;
      if (meta.label === 'Actual Qty')   actDaily = daily;
      if (meta.label === 'Total MP')     mpDaily  = daily;
    }

    const sumDaily = (d) => d ? Object.values(d).reduce((s, v) => s + (v || 0), 0) : 0;
    const totalFC  = Math.round(sumDaily(fcDaily));
    const totalAct = Math.round(sumDaily(actDaily));
    const totalMP  = Math.round(sumDaily(mpDaily));
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
    // Show ALL columns of first few rows
    const out = rows.slice(0, 5).map((r, i) => {
      const obj = { row: i };
      r.forEach((v, j) => { obj['col'+j] = v; });
      return obj;
    });
    res.json({ totalCols: rows[0].length, rows: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));