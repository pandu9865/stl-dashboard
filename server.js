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

    const METRIC_ROWS = {
      1:  { label: 'FR Accuracy %',                  isPct: true  },
      2:  { label: 'Forecast Qty',                    isPct: false },
      3:  { label: 'Actual Qty',                      isPct: false },
      4:  { label: 'Mezanine',                        isPct: false },
      5:  { label: 'Spr',                             isPct: false },
      6:  { label: 'High Risk',                       isPct: false },
      7:  { label: 'Pallet Floor',                    isPct: false },
      8:  { label: 'Stg Galon',                       isPct: false },
      9:  { label: 'Stg Relabel',                     isPct: false },
      11: { label: 'Mezanine %',                      isPct: true  },
      12: { label: 'Spr %',                           isPct: true  },
      13: { label: 'High Risk %',                     isPct: true  },
      14: { label: 'Pallet Floor %',                  isPct: true  },
      15: { label: 'Stg Gin %',                       isPct: true  },
      16: { label: 'Stg Relabel %',                   isPct: true  },
      18: { label: 'DPF',                             isPct: false },
      19: { label: 'SPR',                             isPct: false },
      20: { label: 'DPF %',                           isPct: true  },
      21: { label: 'SPR %',                           isPct: true  },
      23: { label: 'Direct to Mezanine (Manual)',     isPct: false },
      24: { label: 'Direct to Mezanine (System)',     isPct: false },
      25: { label: 'Direct to Mezanine Manual %',     isPct: true  },
      26: { label: 'Direct to Mezanine System %',     isPct: true  },
      28: { label: 'Total MP',                        isPct: false },
      29: { label: 'SLA Completion %',                isPct: true  },
      30: { label: 'Actual Prod Qty',                 isPct: false },
      31: { label: 'Actual Prod %',                   isPct: true  },
    };

    const metrics = [];
    for (const [rowIdx, meta] of Object.entries(METRIC_ROWS)) {
      const row = rows[parseInt(rowIdx)];
      if (!row) continue;
      const daily = {};
      dates.forEach((d, i) => {
        const raw = (row[3 + i] || '').replace('%', '').replace(',', '.').trim();
        const val = parseFloat(raw);
        daily[d] = isNaN(val) ? null : val;
      });
      metrics.push({ label: meta.label, isPct: meta.isPct, daily });
    }

    const fcRow  = rows[2]  || [];
    const actRow = rows[3]  || [];
    const mpRow  = rows[28] || [];
    const totalFC  = fcRow.slice(3).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    const totalAct = actRow.slice(3).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    const totalMP  = mpRow.slice(3).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    const fr = totalFC > 0 ? Math.round(totalAct / totalFC * 100) : 0;

    res.json({ dates, metrics, kpi: { totalFC, totalAct, totalMP, fr } });
  } catch (err) {
    console.error('Putaway error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));