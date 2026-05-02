const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyskzOo4jky0pk70GKEXcIgiuXERtdn8ttLbTC16WVqxc7IAk3AAyrFI_mpc6JhnAHyig/exec';

app.use(express.static('public'));

app.get('/api/data', async (req, res) => {
  try {
    const response = await fetch(APPS_SCRIPT_URL, { redirect: 'follow' });
    const data = await response.json();
    res.json(data);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/rekap', async (req, res) => {
  try {
    const response = await fetch(APPS_SCRIPT_URL + '?action=rekap', { redirect: 'follow' });
    const data = await response.json();
    res.json(data);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/summary', async (req, res) => {
  try {
    const response = await fetch(APPS_SCRIPT_URL + '?action=summary', { redirect: 'follow' });
    const data = await response.json();
    res.json(data);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/putaway', async (req, res) => {
  try {
    const response = await fetch(APPS_SCRIPT_URL + '?action=putaway', { redirect: 'follow' });
    const data = await response.json();
    res.json(data);
  } catch (err) { console.error('Putaway error:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/troubleshoot', async (req, res) => {
  try {
    const response = await fetch(APPS_SCRIPT_URL + '?action=troubleshoot', { redirect: 'follow' });
    const data = await response.json();
    res.json(data);
  } catch (err) { console.error('Troubleshoot error:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/lost', async (req, res) => {
  try {
    const response = await fetch(APPS_SCRIPT_URL + '?action=lost', { redirect: 'follow' });
    const data = await response.json();
    res.json(data);
  } catch (err) { console.error('Lost error:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/lost-found', async (req, res) => {
  try {
    const response = await fetch(APPS_SCRIPT_URL + '?action=lost-found', { redirect: 'follow' });
    const data = await response.json();
    res.json(data);
  } catch (err) { console.error('Lost-found error:', err); res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));