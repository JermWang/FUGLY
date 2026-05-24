require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// ── Twitter verification via fxtwitter (no API key required) ─────────────────
// Extracts the tweet status ID from any x.com / twitter.com URL.
// Returns null if the URL doesn't point to a specific tweet.
function extractTweetId(url) {
  const m = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return m ? m[1] : null;
}

// Fetches tweet metadata from fxtwitter and returns a verification result.
// On network failure, returns { verified: false, error } so submission can still
// proceed as pending (we don't want fxtwitter downtime to block applicants).
async function verifyQT(qtLink, claimedUsername) {
  const tweetId = extractTweetId(qtLink);
  if (!tweetId) {
    return { verified: false, hard: true, error: 'QT link must be a direct tweet URL (x.com/username/status/ID)' };
  }

  let data;
  try {
    const url = `https://api.fxtwitter.com/i/status/${tweetId}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'FuglyFamWL/1.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`fxtwitter ${r.status}`);
    data = await r.json();
  } catch (err) {
    // Soft failure — let the application through as pending, flag for manual review
    console.warn('[QT verify] fxtwitter unreachable:', err.message);
    return { verified: false, hard: false, error: 'Could not reach Twitter API — application flagged for manual review' };
  }

  const tweet = data?.tweet;
  if (!tweet) return { verified: false, hard: true, error: 'Tweet not found or deleted' };

  const author = (tweet.author?.screen_name || '').toLowerCase();
  const claimed = claimedUsername.toLowerCase().replace('@', '');
  if (author !== claimed) {
    return { verified: false, hard: true, error: `QT was posted by @${author}, but you claimed @${claimed}` };
  }

  const isQT = !!(tweet.quote?.url || tweet.quoted_tweet);
  if (!isQT) {
    return { verified: false, hard: true, error: 'That tweet is not a Quote Tweet — please QT the pinned post' };
  }

  return { verified: true };
}

const app = express();
const PORT = process.env.PORT || 3001;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(express.json());

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applicants (
      wallet        TEXT PRIMARY KEY,
      username      TEXT NOT NULL,
      like_username TEXT DEFAULT '',
      qt_link       TEXT NOT NULL DEFAULT '',
      comment_link  TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'pending',
      qt_verified   BOOLEAN NOT NULL DEFAULT false,
      applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Migration: add qt_verified column to existing tables (safe to run multiple times)
  await pool.query(`
    ALTER TABLE applicants ADD COLUMN IF NOT EXISTS qt_verified BOOLEAN NOT NULL DEFAULT false
  `);
}

function rowToApplicant(row) {
  return {
    wallet: row.wallet,
    username: row.username,
    likeUsername: row.like_username,
    qtLink: row.qt_link,
    commentLink: row.comment_link,
    status: row.status,
    qtVerified: row.qt_verified ?? false,
    appliedAt: row.applied_at,
  };
}

// GET /api/applicants
app.get('/api/applicants', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM applicants ORDER BY applied_at DESC');
  res.json(rows.map(rowToApplicant));
});

// POST /api/applicants
app.post('/api/applicants', async (req, res) => {
  const { username, likeUsername, qtLink, commentLink, wallet } = req.body;

  if (!username || !likeUsername || !qtLink || !wallet) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return res.status(400).json({ success: false, message: 'Invalid EVM wallet address' });
  }

  // ── Verify the QT via fxtwitter ──────────────────────────────────────────
  const qt = await verifyQT(qtLink, username);
  if (!qt.verified && qt.hard) {
    // Hard failure: bad URL, wrong author, missing text, not a QT — reject immediately
    return res.status(400).json({ success: false, message: qt.error });
  }
  // qt.verified=false, qt.hard=false → soft failure (API down) — admit as pending
  const qtVerified = qt.verified;

  try {
    const { rows } = await pool.query(
      `INSERT INTO applicants (wallet, username, like_username, qt_link, comment_link, status, qt_verified)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING *`,
      [wallet, username.replace('@', ''), likeUsername.replace('@', ''), qtLink, commentLink || '', qtVerified]
    );
    const msg = qtVerified
      ? 'Application submitted! QT verified ✓'
      : 'Application submitted! QT could not be auto-verified — it will be reviewed manually.';
    res.json({ success: true, message: msg, applicant: rowToApplicant(rows[0]) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'This wallet has already applied' });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// GET /api/tweet-preview?url= — admin: fetch tweet card data for manual review
app.get('/api/tweet-preview', async (req, res) => {
  const { url } = req.query;
  const tweetId = url ? extractTweetId(url) : null;
  if (!tweetId) return res.status(400).json({ error: 'Invalid tweet URL' });
  try {
    const r = await fetch(`https://api.fxtwitter.com/i/status/${tweetId}`, {
      headers: { 'User-Agent': 'FuglyFamWL/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return res.status(502).json({ error: `fxtwitter ${r.status}` });
    const data = await r.json();
    const t = data?.tweet;
    if (!t) return res.status(404).json({ error: 'Tweet not found' });
    res.json({
      id: t.id,
      author: t.author?.screen_name,
      text: t.text,
      isQT: !!(t.quote?.url || t.quoted_tweet),
      quotedAuthor: t.quoted_tweet?.author?.screen_name || t.quote?.author?.screen_name || null,
      url: t.url,
      createdAt: t.created_at,
    });
  } catch (err) {
    res.status(502).json({ error: 'fxtwitter unreachable: ' + err.message });
  }
});

// PATCH /api/applicants/:wallet — update status
app.patch('/api/applicants/:wallet', async (req, res) => {
  const { wallet } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const { rows } = await pool.query(
    'UPDATE applicants SET status = $1 WHERE wallet = $2 RETURNING *',
    [status, wallet]
  );
  if (rows.length === 0) return res.status(404).json({ success: false, message: 'Applicant not found' });
  res.json({ success: true, applicant: rowToApplicant(rows[0]) });
});

// DELETE /api/applicants/:wallet
app.delete('/api/applicants/:wallet', async (req, res) => {
  const { wallet } = req.params;
  const { rowCount } = await pool.query('DELETE FROM applicants WHERE wallet = $1', [wallet]);
  if (rowCount === 0) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true });
});

// POST /api/applicants/batch — admin batch whitelist
app.post('/api/applicants/batch', async (req, res) => {
  const { wallets } = req.body;
  if (!Array.isArray(wallets)) return res.status(400).json({ success: false, message: 'wallets must be an array' });

  let added = 0;
  for (const wallet of wallets) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) continue;
    const { rowCount } = await pool.query(
      `INSERT INTO applicants (wallet, username, like_username, qt_link, comment_link, status)
       VALUES ($1, 'manual_import', '', '', '', 'approved')
       ON CONFLICT (wallet) DO UPDATE SET status = 'approved'`,
      [wallet]
    );
    added++;
  }

  res.json({ success: true, added });
});

initDB()
  .then(() => app.listen(PORT, () => console.log(`FUGLY API on http://localhost:${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });
