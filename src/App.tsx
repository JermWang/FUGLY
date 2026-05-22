import React, { useEffect, useState } from 'react';
import {
  Wallet, CheckCircle, XCircle, Shield, Search,
  Copy, Check, ExternalLink, Lock, Settings,
  Download, Upload, Trash2, ArrowLeft, Layers, RefreshCw
} from 'lucide-react';
import { MerkleTree, standardizeAddress } from './merkle';

const API = 'http://localhost:3001/api';

interface Applicant {
  username: string;
  likeUsername?: string;
  qtLink: string;
  commentLink: string;
  wallet: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
}

// ─────────────────────────────────────────────────────────
// Ticker strip
// ─────────────────────────────────────────────────────────
const TICKER_TEXT = 'FUGLYFAM  ×  ETH WHITELIST  ×  MINT INCOMING  ×  APPLY NOW  ×  FUGLYFAM  ×  ETH WHITELIST  ×  MINT INCOMING  ×  APPLY NOW  ×  ';

function Ticker() {
  return (
    <div className="w-full overflow-hidden border-t border-b border-[#8B5CF6] py-2 bg-[#090909]">
      <div
        className="whitespace-nowrap text-[#8B5CF6] text-xs tracking-[0.2em] font-display"
        style={{ animation: 'ticker 20s linear infinite', display: 'inline-block', width: 'max-content' }}
      >
        {TICKER_TEXT}{TICKER_TEXT}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: 'pending' | 'approved' | 'rejected' | 'not_applied' }) {
  const map = {
    approved:    { label: 'APPROVED',    cls: 'text-[#8B5CF6] border-[#8B5CF6]' },
    pending:     { label: 'PENDING',     cls: 'text-yellow-400 border-yellow-500' },
    rejected:    { label: 'REJECTED',    cls: 'text-[#FF0055] border-[#FF0055]' },
    not_applied: { label: 'NOT APPLIED', cls: 'text-[#6B7280] border-[#333]' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`border text-[10px] tracking-widest px-2 py-0.5 font-display ${cls}`}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// Main app
// ─────────────────────────────────────────────────────────
export default function App() {
  const [currentPage, setCurrentPage] = useState<'explore' | 'hub' | 'apply' | 'checker' | 'admin'>('explore');

  const [connectedWallet, setConnectedWallet] = useState('');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [customWalletInput, setCustomWalletInput] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const [formUsername, setFormUsername] = useState('');
  const [formLikeUsername, setFormLikeUsername] = useState('');
  const [formQtLink, setFormQtLink] = useState('');
  const [formCommentLink, setFormCommentLink] = useState('');
  const [formWallet, setFormWallet] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [showFormSuccess, setShowFormSuccess] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [checkerResult, setCheckerResult] = useState<Applicant | null>(null);
  const [checkerSearched, setCheckerSearched] = useState(false);

  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminPasscodeError, setAdminPasscodeError] = useState(false);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [merkleTree, setMerkleTree] = useState<MerkleTree | null>(null);
  const [proofAddress, setProofAddress] = useState('');
  const [generatedProof, setGeneratedProof] = useState<string[]>([]);
  const [manualAddressInput, setManualAddressInput] = useState('');
  const [passcodeModalOpen, setPasscodeModalOpen] = useState(false);

  // ── Data ───────────────────────────────────────────────
  const fetchApplicants = async () => {
    try {
      const res = await fetch(`${API}/applicants`);
      setApplicants(await res.json());
    } catch { console.error('API offline'); }
  };

  useEffect(() => { fetchApplicants(); }, []);

  useEffect(() => {
    const approved = applicants.filter(a => a.status === 'approved').map(a => a.wallet);
    setMerkleTree(approved.length > 0 ? new MerkleTree(approved) : null);
  }, [applicants]);

  const refresh = () => fetchApplicants();

  // ── Wallet ─────────────────────────────────────────────
  const connectMetaMask = async () => {
    if ((window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts?.[0]) {
          setConnectedWallet(accounts[0]);
          setFormWallet(accounts[0]);
          setIsWalletModalOpen(false);
        }
      } catch { alert('MetaMask rejected.'); }
    } else {
      setIsWalletModalOpen(true);
    }
  };

  const connectSimulated = (addr: string) => {
    setConnectedWallet(addr);
    setFormWallet(addr);
    setIsWalletModalOpen(false);
  };

  const handleCustomConnect = () => {
    if (/^0x[a-fA-F0-9]{40}$/.test(customWalletInput)) {
      connectSimulated(customWalletInput);
      setCustomWalletInput('');
    } else {
      alert('Invalid EVM address');
    }
  };

  const copyWallet = () => {
    navigator.clipboard.writeText(connectedWallet);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const walletStatus = (): 'not_applied' | 'pending' | 'approved' | 'rejected' => {
    if (!connectedWallet) return 'not_applied';
    const found = applicants.find(a => standardizeAddress(a.wallet) === standardizeAddress(connectedWallet));
    return found?.status ?? 'not_applied';
  };

  // ── Apply ──────────────────────────────────────────────
  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];
    if (!formUsername.trim()) errors.push('Step 01: Twitter username required');
    if (!formLikeUsername.trim()) errors.push('Step 02: Username confirming like required');
    const isTw = (u: string) => u.includes('twitter.com') || u.includes('x.com');
    if (!isTw(formQtLink)) errors.push('Step 03: Must be a valid x.com / twitter.com URL');
    if (!/^0x[a-fA-F0-9]{40}$/.test(formWallet.trim())) errors.push('Step 04: Invalid EVM address');
    if (errors.length) { setFormErrors(errors); return; }

    try {
      const res = await fetch(`${API}/applicants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formUsername.trim().replace('@', ''),
          likeUsername: formLikeUsername.trim().replace('@', ''),
          qtLink: formQtLink.trim(),
          commentLink: '',
          wallet: formWallet.trim(),
        }),
      });
      const result = await res.json();
      if (!result.success) { setFormErrors([result.message]); return; }
      setFormErrors([]);
      setShowFormSuccess(true);
      setFormUsername(''); setFormLikeUsername('');
      setFormQtLink(''); setFormCommentLink('');
      setFormWallet(connectedWallet || '');
      refresh();
    } catch {
      setFormErrors(['Server unreachable. Is the API running on :3001?']);
    }
  };

  // ── Checker ────────────────────────────────────────────
  const handleSearch = () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const found = applicants.find(
      a => a.wallet.toLowerCase() === q || a.username.toLowerCase() === q.replace('@', '')
    );
    setCheckerResult(found ?? null);
    setCheckerSearched(true);
  };

  // ── Admin ──────────────────────────────────────────────
  const unlockAdmin = () => {
    if (['bobo', 'fugly'].includes(adminPasscode.toLowerCase())) {
      setIsAdminUnlocked(true);
      setAdminPasscodeError(false);
      setPasscodeModalOpen(false);
      setCurrentPage('admin');
      setAdminPasscode('');
    } else {
      setAdminPasscodeError(true);
    }
  };

  const adminAction = async (wallet: string, action: 'approved' | 'rejected') => {
    await fetch(`${API}/applicants/${encodeURIComponent(wallet)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: action }),
    });
    refresh();
  };

  const adminDelete = async (wallet: string) => {
    if (!confirm('Delete this application?')) return;
    await fetch(`${API}/applicants/${encodeURIComponent(wallet)}`, { method: 'DELETE' });
    refresh();
  };

  const batchWhitelist = async () => {
    const wallets = manualAddressInput.split(/[\n,]/).map(l => l.trim()).filter(l => /^0x[a-fA-F0-9]{40}$/.test(l));
    if (!wallets.length) { alert('No valid addresses.'); return; }
    const res = await fetch(`${API}/applicants/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallets }),
    });
    const r = await res.json();
    setManualAddressInput('');
    alert(`Added ${r.added} wallets.`);
    refresh();
  };

  const generateProof = () => {
    if (!merkleTree) { alert('No approved wallets.'); return; }
    if (!/^0x[a-fA-F0-9]{40}$/.test(proofAddress)) { alert('Invalid address.'); return; }
    setGeneratedProof(merkleTree.getProof(proofAddress));
  };

  const exportJSON = () => {
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(applicants, null, 2));
    a.download = 'fugly_whitelist.json';
    a.click();
  };

  const exportCSV = () => {
    let csv = 'Username,Wallet,Status,Applied At\n';
    applicants.forEach(a => { csv += `"${a.username}","${a.wallet}","${a.status}","${a.appliedAt}"\n`; });
    const el = document.createElement('a');
    el.href = encodeURI('data:text/csv;charset=utf-8,' + csv);
    el.download = 'fugly_whitelist.csv';
    el.click();
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (Array.isArray(parsed) && parsed.every(i => 'username' in i && 'wallet' in i && 'status' in i)) {
          // batch import via API
          const wallets = parsed.filter(i => i.status === 'approved').map((i: Applicant) => i.wallet);
          if (wallets.length) {
            await fetch(`${API}/applicants/batch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ wallets }),
            });
          }
          refresh();
          alert('Import complete.');
        } else { alert('Invalid file structure.'); }
      } catch { alert('Failed to parse JSON.'); }
    };
    reader.readAsText(file);
  };

  // ── shared input style ─────────────────────────────────
  const input = 'w-full bg-white border border-[#D1D5DB] text-[#1E1040] text-sm px-3 py-2.5 outline-none focus:border-[#8B5CF6] transition-colors font-mono placeholder-[#9CA3AF]';
  const btn = (variant: 'acid' | 'hot' | 'ghost' | 'dark') => {
    const v = {
      acid:  'bg-[#8B5CF6] text-black hover:bg-[#c4ef00]',
      hot:   'bg-[#FF0055] text-white hover:bg-[#e0004a]',
      ghost: 'border border-[#333] text-[#6B7280] hover:border-[#8B5CF6] hover:text-[#8B5CF6]',
      dark:  'bg-[#111] border border-white/70 text-white hover:border-[#8B5CF6]',
    }[variant];
    return `${v} text-xs tracking-widest px-4 py-2 font-display cursor-pointer transition-all active:scale-95`;
  };

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#090909] text-white font-mono overflow-x-hidden">

      {/* ── FIXED HEADER ─────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/60 backdrop-blur-xl backdrop-blur-md border-b border-[#E5E5E5] px-6 h-14 flex items-center justify-between">
        <button
          onClick={() => setCurrentPage('explore')}
          className="flex items-center gap-3 group"
        >
          <img src="/artwork/FUGLY.gif" alt="" className="h-7 w-auto" />
          <span
            className="font-display text-2xl tracking-[0.1em] glitch"
            style={{ color: '#8B5CF6' }}
          >
            FUGLY FAM
          </span>
        </button>

        <nav className="flex items-center gap-2">
          {connectedWallet ? (
            <div className="flex items-center border border-[#8B5CF6]/40 transition-all" style={{ boxShadow: '0 0 8px rgba(139,92,246,0.15)' }}>
              <button
                onClick={copyWallet}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-[#8B5CF6] hover:bg-[#8B5CF6]/10 hover:text-[#6D28D9] transition-all duration-200"
              >
                {copySuccess ? <Check size={12} /> : <Copy size={12} />}
                {connectedWallet.slice(0, 6)}…{connectedWallet.slice(-4)}
              </button>
              <button
                onClick={() => setConnectedWallet('')}
                className="px-3 py-1.5 text-xs text-[#FF0055]/70 hover:text-[#FF0055] hover:bg-[#FF0055]/10 transition-all duration-200 border-l border-[#8B5CF6]/40"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={connectMetaMask}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs tracking-widest font-display text-[#8B5CF6] border border-[#8B5CF6]/50 hover:border-[#8B5CF6] hover:bg-[#8B5CF6] hover:text-white transition-all duration-200 cursor-pointer"
              style={{ boxShadow: '0 0 0 rgba(139,92,246,0)', transition: 'all 0.2s ease' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 16px rgba(139,92,246,0.35)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 0 rgba(139,92,246,0)')}
            >
              <Wallet size={12} />
              CONNECT
            </button>
          )}
          <button
            onClick={() => isAdminUnlocked ? setCurrentPage('admin') : setPasscodeModalOpen(true)}
            className="p-1.5 text-[#ccc] border border-[#E5E5E5] hover:border-[#8B5CF6]/60 hover:text-[#8B5CF6] transition-all duration-200 cursor-pointer"
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 10px rgba(139,92,246,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            <Settings size={14} />
          </button>
        </nav>
      </header>

      {/* ── EXPLORE (full-bleed, outside main container) ─ */}
      {currentPage === 'explore' && (
        <>
          <section className="relative w-full h-screen flex flex-col items-center justify-end overflow-hidden">
            {/* banner */}
            <img
              src="/artwork/BANNER-1.png"
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            {/* stars overlay */}
            <img
              src="/artwork/stars.gif"
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-screen pointer-events-none"
            />
            {/* gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-[#090909]/30 to-transparent" />

            {/* content */}
            <div className="relative z-10 w-full max-w-5xl mx-auto px-6 pb-20 fade-up">
              <p className="font-mono text-white text-xs tracking-[0.3em] mb-4 opacity-80">
                ETH WHITELIST PORTAL — SEASON 01
              </p>
              <h1
                className="font-display leading-none text-white mb-6"
                style={{ fontSize: 'clamp(72px, 12vw, 160px)', letterSpacing: '0.04em' }}
              >
                FUGLY<br />
                <span className="glitch" style={{ color: '#8B5CF6' }}>FAM.</span>
              </h1>
              <p className="font-mono text-white text-sm mb-10 max-w-md leading-relaxed">
                The Fugly Fam is all here.
              </p>
              <button
                onClick={() => setCurrentPage('hub')}
                className="font-display text-xl tracking-[0.15em] bg-[#8B5CF6] text-black px-12 py-4 hover:bg-white transition-colors cursor-pointer border-0"
              >
                ENTER THE PORTAL →
              </button>
            </div>
          </section>

          {/* ticker below fold */}
          <Ticker />
        </>
      )}

      {/* ── ALL OTHER PAGES ──────────────────────────── */}
      {currentPage !== 'explore' && (
        <main className="pt-14 relative min-h-screen">
          {/* artwork background */}
          <div className="fixed inset-0 z-0 pointer-events-none">
            <img src="/artwork/BANNER-2.png" alt="" className="w-full h-full object-cover object-center opacity-50"/>
            <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.55)' }}/>
          </div>
          <div className="relative z-10">

          {/* ── HUB ───────────────────────────────────── */}
          {currentPage === 'hub' && (
            <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-10">

              {/* stats strip */}
              <div className="grid grid-cols-3 border border-white/70 bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/10">
                {[
                  { label: 'WHITELISTED', val: applicants.filter(a => a.status === 'approved').length, color: '#8B5CF6' },
                  { label: 'PENDING',     val: applicants.filter(a => a.status === 'pending').length,  color: '#FFB800' },
                  { label: 'TOTAL QUEUE', val: applicants.length,                                       color: '#888' },
                ].map(({ label, val, color }, i) => (
                  <div key={i} className={`p-6 ${i < 2 ? 'border-r border-white/70' : ''}`}>
                    <p className="text-[10px] tracking-[0.25em] text-[#6B7280] mb-1">{label}</p>
                    <p className="font-display text-5xl" style={{ color }}>{val}</p>
                  </div>
                ))}
              </div>

              {/* wallet status */}
              {connectedWallet && (
                <div className="border border-white/70 bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/10 px-5 py-3 flex items-center justify-between text-xs">
                  <span className="text-[#6B7280] tracking-widest">YOUR STATUS</span>
                  <StatusBadge status={walletStatus()} />
                </div>
              )}

              {/* action cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* APPLY */}
                <div className="border border-white/70 bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/10 p-8 flex flex-col gap-6 hover:border-[#8B5CF6] transition-colors group">
                  <div>
                    <p className="text-[#8B5CF6] text-[10px] tracking-[0.3em] mb-2">01 — APPLICATION</p>
                    <h2 className="font-display text-4xl text-[#1E1040]">APPLY<br />WHITELIST</h2>
                  </div>
                  <p className="text-[#6B7280] text-xs leading-relaxed">
                    Complete 5 social tasks to qualify for the ETH mint. Follow, like, QT, tag friends, and submit your wallet.
                  </p>
                  <div className="mt-auto">
                    {walletStatus() === 'approved' ? (
                      <p className="text-[#8B5CF6] text-xs tracking-widest">✓ YOU ARE WHITELISTED</p>
                    ) : walletStatus() === 'pending' ? (
                      <p className="text-yellow-500 text-xs tracking-widest">⏳ APPLICATION UNDER REVIEW</p>
                    ) : (
                      <button onClick={() => setCurrentPage('apply')} className={btn('acid') + ' w-full py-3 text-base'}>
                        START APPLICATION
                      </button>
                    )}
                  </div>
                </div>

                {/* CHECKER */}
                <div className="border border-white/70 bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/10 p-8 flex flex-col gap-6 hover:border-[#FF0055] transition-colors group">
                  <div>
                    <p className="text-[#FF0055] text-[10px] tracking-[0.3em] mb-2">02 — VERIFICATION</p>
                    <h2 className="font-display text-4xl text-[#1E1040]">WL STATUS<br />CHECKER</h2>
                  </div>
                  <p className="text-[#6B7280] text-xs leading-relaxed">
                    Query the live whitelist directory by wallet address or Twitter handle to verify your approval status.
                  </p>
                  <div className="mt-auto">
                    <button onClick={() => setCurrentPage('checker')} className={btn('hot') + ' w-full py-3 text-base'}>
                      OPEN CHECKER
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── APPLY ─────────────────────────────────── */}
          {currentPage === 'apply' && (
            <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-8">

              <div className="flex items-center gap-4">
                <button onClick={() => setCurrentPage('hub')} className={btn('ghost')}>
                  <ArrowLeft size={12} className="inline mr-1" /> BACK
                </button>
                <h2 className="font-display text-3xl text-[#8B5CF6]">WHITELIST APPLICATION</h2>
              </div>

              {showFormSuccess ? (
                <div className="border border-[#8B5CF6] p-10 flex flex-col items-center gap-6 text-center">
                  <CheckCircle size={48} className="text-[#8B5CF6]" />
                  <h3 className="font-display text-4xl">APPLICATION SUBMITTED</h3>
                  <p className="text-[#6B7280] text-xs leading-relaxed max-w-sm">
                    Your details are queued for review. The team will verify your social tasks and approve your wallet.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => { setShowFormSuccess(false); setCurrentPage('hub'); }} className={btn('dark')}>
                      ← HUB
                    </button>
                    <button onClick={() => { setShowFormSuccess(false); setCurrentPage('checker'); }} className={btn('acid')}>
                      CHECK STATUS
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleApplySubmit} className="flex flex-col gap-1">

                  {/* errors */}
                  {formErrors.length > 0 && (
                    <div className="border border-[#FF0055] bg-[#FF0055]/5 p-4 mb-4 flex flex-col gap-1">
                      {formErrors.map((e, i) => (
                        <p key={i} className="text-[#FF0055] text-xs font-mono">
                          <XCircle size={10} className="inline mr-1.5" />{e}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* task rows */}
                  {[
                    {
                      num: '01',
                      label: 'FOLLOW FUGLYFAM',
                      sub: <a href="https://x.com/FuglyETH" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#8B5CF6] hover:underline">@FuglyETH on X <ExternalLink size={9}/></a>,
                      input: <input type="text" placeholder="@your username" value={formUsername} onChange={e => setFormUsername(e.target.value)} className={input + ' w-44 shrink-0'} />,
                    },
                    {
                      num: '02',
                      label: 'LIKE PINNED POST',
                      sub: 'like the pinned post on our profile',
                      input: <input type="text" placeholder="@your username" value={formLikeUsername} onChange={e => setFormLikeUsername(e.target.value)} className={input + ' w-44 shrink-0'} />,
                    },
                    {
                      num: '03',
                      label: 'QUOTE TWEET',
                      sub: 'QT pinned post with "fuglys are coming"',
                      input: <input type="text" placeholder="x.com/…/status/…" value={formQtLink} onChange={e => setFormQtLink(e.target.value)} className={input + ' w-44 shrink-0'} />,
                    },
                    {
                      num: '04',
                      label: 'SUBMIT EVM WALLET',
                      sub: connectedWallet ? 'auto-filled from connected wallet' : 'ethereum mainnet address',
                      input: <input type="text" placeholder="0x..." value={formWallet} onChange={e => setFormWallet(e.target.value)} disabled={!!connectedWallet} className={input + ' w-44 shrink-0 ' + (connectedWallet ? 'opacity-50 cursor-not-allowed' : '')} />,
                    },
                  ].map(({ num, label, sub, input: inp }) => (
                    <div key={num} className="border border-white/70 hover:border-[#3A3A3A] bg-white/60 backdrop-blur-xl rounded-xl p-4 flex items-center gap-4 transition-colors">
                      <span className="font-display text-2xl text-[#8B5CF6] w-8 shrink-0">{num}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#1E1040] text-xs tracking-widest">{label}</p>
                        <p className="text-[#6B7280] text-[10px] mt-0.5">{sub}</p>
                      </div>
                      <div className="shrink-0">{inp}</div>
                    </div>
                  ))}

                  <button
                    type="submit"
                    className="font-display text-xl tracking-[0.15em] bg-[#8B5CF6] text-black py-4 hover:bg-white transition-colors cursor-pointer border-0 mt-4"
                  >
                    SUBMIT APPLICATION →
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ── CHECKER ───────────────────────────────── */}
          {currentPage === 'checker' && (
            <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-8">

              <div className="flex items-center gap-4">
                <button onClick={() => setCurrentPage('hub')} className={btn('ghost')}>
                  <ArrowLeft size={12} className="inline mr-1" /> BACK
                </button>
                <h2 className="font-display text-3xl text-[#FF0055]">WL DIRECTORY</h2>
              </div>

              {/* stats */}
              <div className="grid grid-cols-3 border border-white/70 bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/10 text-center">
                {[
                  { label: 'WHITELISTED', val: applicants.filter(a => a.status === 'approved').length },
                  { label: 'PENDING',     val: applicants.filter(a => a.status === 'pending').length },
                  { label: 'TOTAL',       val: applicants.length },
                ].map(({ label, val }, i) => (
                  <div key={i} className={`py-4 ${i < 2 ? 'border-r border-white/70' : ''}`}>
                    <p className="text-[10px] tracking-[0.2em] text-[#6B7280]">{label}</p>
                    <p className="font-display text-4xl text-[#1E1040]">{val}</p>
                  </div>
                ))}
              </div>

              {/* search */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] font-mono text-xs">{'>'}</span>
                  <input
                    type="text"
                    placeholder="0x... or twitter handle"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className={input + ' pl-7'}
                  />
                </div>
                <button onClick={handleSearch} className={btn('acid') + ' px-6'}>
                  <Search size={14} />
                </button>
              </div>

              {/* result */}
              {checkerSearched && (
                <div className="border border-white/70 bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/10 p-6 font-mono text-xs flex flex-col gap-3">
                  {checkerResult ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[#6B7280]">APPLICANT</span>
                        <StatusBadge status={checkerResult.status} />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6B7280]">HANDLE</span>
                        <span className="text-[#1E1040]">@{checkerResult.username}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-[#6B7280] shrink-0">WALLET</span>
                        <span className="text-[#8B5CF6] break-all text-right">{checkerResult.wallet}</span>
                      </div>
                      {checkerResult.status === 'approved' && merkleTree && (
                        <div className="flex justify-between">
                          <span className="text-[#6B7280]">MERKLE ROOT</span>
                          <span className="text-[#6B7280]">{merkleTree.getRoot().slice(0, 10)}…{merkleTree.getRoot().slice(-6)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-3 text-[#6B7280]">
                      <XCircle size={16} className="text-[#FF0055]" />
                      <span>NOT FOUND — apply via the whitelist portal</span>
                    </div>
                  )}
                </div>
              )}

              {/* approved wallets table */}
              <div className="border border-white/70 bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/10">
                <div className="px-4 py-3 border-b border-white/70 flex items-center justify-between">
                  <span className="text-[10px] tracking-[0.2em] text-[#6B7280]">
                    APPROVED WALLETS ({applicants.filter(a => a.status === 'approved').length})
                  </span>
                  <div className="flex gap-2">
                    <button onClick={exportCSV} className={btn('ghost')}>CSV</button>
                    <button onClick={exportJSON} className={btn('ghost')}>JSON</button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {applicants.filter(a => a.status === 'approved').length === 0 ? (
                    <p className="text-[#6B7280] text-xs text-center py-10">NO WHITELISTED WALLETS YET</p>
                  ) : (
                    <table className="w-full font-mono text-xs">
                      <tbody>
                        {applicants.filter(a => a.status === 'approved').map((a, i) => (
                          <tr key={i} className="border-b border-[#111] hover:bg-[#0D0D0D]">
                            <td className="px-4 py-2.5 text-[#6B7280] w-10">{String(i + 1).padStart(2, '0')}</td>
                            <td className="px-4 py-2.5 text-[#8B5CF6] break-all">{a.wallet}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ── ADMIN ─────────────────────────────────── */}
          {currentPage === 'admin' && isAdminUnlocked && (
            <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-10">

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setCurrentPage('hub')} className={btn('ghost')}>
                    <ArrowLeft size={12} className="inline mr-1" /> EXIT
                  </button>
                  <h2 className="font-display text-3xl text-[#1E1040]">ADMIN CONSOLE</h2>
                </div>
                <span className="text-[#FF0055] text-[10px] tracking-[0.3em] flex items-center gap-1.5 border border-[#FF0055] px-3 py-1">
                  <Shield size={10} /> ADMIN ACTIVE
                </span>
              </div>

              {/* stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'TOTAL',    val: applicants.length,                                       color: 'text-[#1E1040]' },
                  { label: 'APPROVED', val: applicants.filter(a => a.status === 'approved').length,  color: 'text-[#8B5CF6]' },
                  { label: 'PENDING',  val: applicants.filter(a => a.status === 'pending').length,   color: 'text-yellow-400' },
                  { label: 'REJECTED', val: applicants.filter(a => a.status === 'rejected').length,  color: 'text-[#FF0055]' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="border border-white/70 p-5">
                    <p className="text-[10px] tracking-[0.25em] text-[#6B7280] mb-1">{label}</p>
                    <p className={`font-display text-5xl ${color}`}>{val}</p>
                  </div>
                ))}
              </div>

              {/* Merkle terminal */}
              <div className="border border-white/70 bg-white">
                <div className="px-5 py-3 border-b border-white/70 flex items-center gap-2">
                  <Layers size={12} className="text-[#8B5CF6]" />
                  <span className="text-[10px] tracking-[0.25em] text-[#6B7280]">MERKLE TREE ENGINE</span>
                </div>
                <div className="p-5 flex flex-col gap-4 font-mono text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-[#6B7280] shrink-0">ROOT</span>
                    <span className="text-[#8B5CF6] break-all flex-1">
                      {merkleTree ? merkleTree.getRoot() : '0x' + '0'.repeat(64)}
                    </span>
                    {merkleTree && (
                      <button
                        onClick={() => navigator.clipboard.writeText(merkleTree.getRoot())}
                        className={btn('ghost') + ' shrink-0'}
                      >
                        <Copy size={10} />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="0x address to generate proof"
                      value={proofAddress}
                      onChange={e => setProofAddress(e.target.value)}
                      className={input + ' flex-1'}
                    />
                    <button onClick={generateProof} className={btn('acid')}>PROOF →</button>
                  </div>
                  {generatedProof.length > 0 && (
                    <pre className="bg-[#060606] border border-[#1A1A1A] p-3 text-[#8B5CF6] text-[10px] overflow-x-auto select-all">
                      {JSON.stringify(generatedProof, null, 2)}
                    </pre>
                  )}
                  <pre className="text-[#6B7280] text-[10px] leading-relaxed select-all">
{`// Solidity verification
bytes32 root = ${merkleTree ? merkleTree.getRoot().slice(0, 14) + '...' : '0xYOUR_ROOT'};
function mint(bytes32[] calldata proof) external {
  bytes32 leaf = sha256(abi.encodePacked(msg.sender));
  require(MerkleProof.verify(proof, root, leaf));
}`}
                  </pre>
                </div>
              </div>

              {/* tools row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 border border-white/70 p-6 flex flex-col gap-4">
                  <p className="text-[10px] tracking-[0.25em] text-[#6B7280]">BATCH WHITELIST IMPORT</p>
                  <textarea
                    rows={4}
                    placeholder={'0x...\n0x...'}
                    value={manualAddressInput}
                    onChange={e => setManualAddressInput(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#1A1A1A] text-[#8B5CF6] text-xs font-mono p-3 outline-none resize-none focus:border-[#8B5CF6] transition-colors"
                  />
                  <button onClick={batchWhitelist} className={btn('acid') + ' w-full py-3'}>
                    BATCH ADD TO WHITELIST
                  </button>
                </div>
                <div className="border border-white/70 p-6 flex flex-col gap-3">
                  <p className="text-[10px] tracking-[0.25em] text-[#6B7280] mb-1">DATABASE OPS</p>
                  <button onClick={exportCSV} className={btn('ghost') + ' w-full py-2 text-left flex items-center gap-2'}><Download size={10} /> EXPORT CSV</button>
                  <button onClick={exportJSON} className={btn('ghost') + ' w-full py-2 text-left flex items-center gap-2'}><Download size={10} /> EXPORT JSON</button>
                  <label className={btn('ghost') + ' w-full py-2 text-left flex items-center gap-2 cursor-pointer'}>
                    <Upload size={10} /> IMPORT JSON
                    <input type="file" accept=".json" onChange={importJSON} className="hidden" />
                  </label>
                </div>
              </div>

              {/* applicant table */}
              <div className="border border-white/70 bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/10">
                <div className="px-5 py-3 border-b border-white/70 flex items-center justify-between">
                  <span className="text-[10px] tracking-[0.25em] text-[#6B7280]">APPLICATION QUEUE ({applicants.length})</span>
                  <button onClick={refresh} className={btn('ghost') + ' p-1.5'}><RefreshCw size={10} /></button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[#1A1A1A] text-[#6B7280]">
                        <th className="px-4 py-2.5 text-left w-8">#</th>
                        <th className="px-4 py-2.5 text-left">HANDLE</th>
                        <th className="px-4 py-2.5 text-left">WALLET</th>
                        <th className="px-4 py-2.5 text-center w-28">STATUS</th>
                        <th className="px-4 py-2.5 text-right w-40">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applicants.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-10 text-[#6B7280]">NO APPLICANTS</td></tr>
                      ) : applicants.map((a, i) => (
                        <tr key={i} className="border-b border-[#0F0F0F] hover:bg-[#0D0D0D]">
                          <td className="px-4 py-3 text-[#6B7280]">{String(i + 1).padStart(2, '0')}</td>
                          <td className="px-4 py-3">
                            <span className="text-[#1E1040]">@{a.username}</span>
                            {a.qtLink && a.qtLink !== 'https://twitter.com/manual' && (
                              <div className="flex gap-3 mt-0.5">
                                <a href={a.qtLink} target="_blank" rel="noreferrer" className="text-[#6B7280] hover:text-[#8B5CF6] flex items-center gap-0.5 transition-colors">QT <ExternalLink size={8} /></a>
                                <a href={a.commentLink} target="_blank" rel="noreferrer" className="text-[#6B7280] hover:text-[#8B5CF6] flex items-center gap-0.5 transition-colors">COMMENT <ExternalLink size={8} /></a>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#8B5CF6] break-all max-w-[200px]">{a.wallet}</td>
                          <td className="px-4 py-3 text-center"><StatusBadge status={a.status} /></td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {a.status !== 'approved' && (
                                <button onClick={() => adminAction(a.wallet, 'approved')} className="border border-[#8B5CF6]/40 text-[#8B5CF6] text-[10px] px-2 py-1 hover:bg-[#8B5CF6]/10 transition-colors cursor-pointer">✓</button>
                              )}
                              {a.status !== 'rejected' && (
                                <button onClick={() => adminAction(a.wallet, 'rejected')} className="border border-yellow-600/40 text-yellow-500 text-[10px] px-2 py-1 hover:bg-yellow-600/10 transition-colors cursor-pointer">✗</button>
                              )}
                              <button onClick={() => adminDelete(a.wallet)} className="border border-[#FF0055]/40 text-[#FF0055] text-[10px] px-2 py-1 hover:bg-[#FF0055]/10 transition-colors cursor-pointer">DEL</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* footer */}
          <footer className="border-t border-[#1A1A1A] py-6 px-6 flex justify-between items-center text-[10px] tracking-[0.2em] text-[#6B7280] max-w-6xl mx-auto">
            <span>© 2026 FUGLYFAM. ETH NFT MINT.</span>
            <button onClick={() => setPasscodeModalOpen(true)} className="hover:text-[#8B5CF6] transition-colors">
              ADMIN ACCESS
            </button>
          </footer>

          </div>
        </main>
      )}

      {/* ── PASSCODE MODAL ────────────────────────────── */}
      {passcodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm border border-white/70 bg-white p-8 flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-[#8B5CF6]" />
                <span className="font-display text-xl text-white">ADMIN ACCESS</span>
              </div>
              <button onClick={() => setPasscodeModalOpen(false)} className="text-[#6B7280] hover:text-white text-lg cursor-pointer">×</button>
            </div>
            <p className="text-[#6B7280] text-xs leading-relaxed">
              Enter the admin passcode to access the whitelist approval queue and Merkle tree generator.
            </p>
            <input
              type="password"
              placeholder="passcode..."
              value={adminPasscode}
              onChange={e => setAdminPasscode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && unlockAdmin()}
              className={input + ' text-center text-base'}
            />
            {adminPasscodeError && (
              <p className="text-[#FF0055] text-xs text-center">INCORRECT PASSCODE</p>
            )}
            <button onClick={unlockAdmin} className={btn('acid') + ' w-full py-3 text-base'}>
              UNLOCK →
            </button>
          </div>
        </div>
      )}

      {/* ── WALLET MODAL ──────────────────────────────── */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md border border-white/70 bg-white p-8 flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Wallet size={14} className="text-[#8B5CF6]" />
                <span className="font-display text-xl text-white">EVM SANDBOX</span>
              </div>
              <button onClick={() => setIsWalletModalOpen(false)} className="text-[#6B7280] hover:text-white text-lg cursor-pointer">×</button>
            </div>
            <p className="text-[#6B7280] text-xs leading-relaxed">
              No wallet detected. Use a simulated address for testing, or connect MetaMask.
            </p>
            <div className="flex flex-col gap-1.5">
              {[
                { label: 'Dev Account (Whitelisted)', addr: '0x90F8bf3f24C1069f3F24C1069F3F24C1069f3F24', color: 'text-[#8B5CF6]' },
                { label: 'Simulated (Pending)',       addr: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', color: 'text-yellow-400' },
                { label: 'Hardhat Node 0 (New)',      addr: '0xF39Fd6e51aad88F6F4ce6aB8827279cffFb92266', color: 'text-[#6B7280]' },
              ].map(({ label, addr, color }) => (
                <button
                  key={addr}
                  onClick={() => connectSimulated(addr)}
                  className="border border-white/70 hover:border-[#8B5CF6] bg-[#0A0A0A] px-4 py-3 flex justify-between items-center text-xs transition-colors cursor-pointer"
                >
                  <span className={color}>{label}</span>
                  <span className="text-[#6B7280] font-mono">{addr.slice(0, 6)}…{addr.slice(-4)}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 border-t border-[#1A1A1A] pt-4">
              <input
                type="text"
                placeholder="0x custom address"
                value={customWalletInput}
                onChange={e => setCustomWalletInput(e.target.value)}
                className={input + ' flex-1'}
              />
              <button onClick={handleCustomConnect} className={btn('acid')}>CONNECT</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
