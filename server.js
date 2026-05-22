require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(express.json());

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applicants (
      wallet       TEXT PRIMARY KEY,
      username     TEXT NOT NULL,
      like_username TEXT DEFAULT '',
      qt_link      TEXT NOT NULL DEFAULT '',
      comment_link TEXT NOT NULL DEFAULT '',
      status       TEXT NOT NULL DEFAULT 'pending',
      applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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

  const isTwitter = (url) => url.includes('twitter.com') || url.includes('x.com');
  if (!isTwitter(qtLink)) {
    return res.status(400).json({ success: false, message: 'QT link must be a Twitter/X URL' });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return res.status(400).json({ success: false, message: 'Invalid EVM wallet address' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO applicants (wallet, username, like_username, qt_link, comment_link, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [wallet, username.replace('@', ''), likeUsername.replace('@', ''), qtLink, commentLink]
    );
    res.json({ success: true, message: 'Application submitted!', applicant: rowToApplicant(rows[0]) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'This wallet has already applied' });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
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
