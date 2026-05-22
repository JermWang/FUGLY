import React, { useEffect, useState } from 'react';
import { 
  Wallet, CheckCircle, XCircle, AlertCircle, Shield, Search, 
  Copy, Check, ExternalLink, Lock, Unlock, Settings, 
  Download, Upload, Plus, Trash2, Users, CheckSquare, 
  Globe, ArrowLeft, RefreshCw, Layers
} from 'lucide-react';
import { MerkleTree, standardizeAddress, hashLeaf } from './merkle';

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

export default function App() {
  // Navigation State
  const [currentPage, setCurrentPage] = useState<'explore' | 'hub' | 'apply' | 'checker' | 'admin'>('explore');
  
  // Wallet Connection State
  const [connectedWallet, setConnectedWallet] = useState<string>('');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [customWalletInput, setCustomWalletInput] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Application Form State
  const [formUsername, setFormUsername] = useState<string>('');
  const [formLikeUsername, setFormLikeUsername] = useState<string>('');
  const [formQtLink, setFormQtLink] = useState<string>('');
  const [formCommentLink, setFormCommentLink] = useState<string>('');
  const [formWallet, setFormWallet] = useState<string>('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [showFormSuccessAlert, setShowFormSuccessAlert] = useState<boolean>(false);

  // Whitelist Checker State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [checkerSearchResult, setCheckerSearchResult] = useState<Applicant | null>(null);
  const [checkerHasSearched, setCheckerHasSearched] = useState<boolean>(false);

  // Admin Portal State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [adminPasscode, setAdminPasscode] = useState<string>('');
  const [adminPasscodeError, setAdminPasscodeError] = useState<boolean>(false);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [merkleTree, setMerkleTree] = useState<MerkleTree | null>(null);
  const [proofAddress, setProofAddress] = useState<string>('');
  const [generatedProof, setGeneratedProof] = useState<string[]>([]);
  const [manualAddressInput, setManualAddressInput] = useState<string>('');
  const [passcodeModalOpen, setPasscodeModalOpen] = useState<boolean>(false);

  const fetchApplicants = async () => {
    try {
      const res = await fetch(`${API}/applicants`);
      const data = await res.json();
      setApplicants(data);
    } catch {
      console.error('API offline — applicants unavailable');
    }
  };

  useEffect(() => { fetchApplicants(); }, []);

  // Compute Merkle Tree dynamically whenever approved applicants change
  useEffect(() => {
    const approvedAddresses = applicants
      .filter(app => app.status === 'approved')
      .map(app => app.wallet);
    
    if (approvedAddresses.length > 0) {
      const tree = new MerkleTree(approvedAddresses);
      setMerkleTree(tree);
    } else {
      setMerkleTree(null);
    }
  }, [applicants]);

  // Refresh from API after any mutation
  const refreshApplicants = () => fetchApplicants();

  // ── Web3 Connection Logic ───────────────────────
  const connectMetaMask = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts[0]) {
          const addr = accounts[0];
          setConnectedWallet(addr);
          setFormWallet(addr);
          setIsWalletModalOpen(false);
          triggerAlert('MetaMask connected successfully!');
        }
      } catch (err) {
        console.error('MetaMask connection failed:', err);
        triggerAlert('MetaMask connection rejected by user.');
      }
    } else {
      triggerAlert('MetaMask not detected! Opening EVM Sandbox Sandbox.');
      setIsWalletModalOpen(true);
    }
  };

  const connectSimulatedWallet = (addr: string) => {
    setConnectedWallet(addr);
    setFormWallet(addr);
    setIsWalletModalOpen(false);
    triggerAlert(`Simulated wallet connected: ${addr.substring(0, 6)}...${addr.substring(38)}`);
  };

  const handleCustomWalletConnect = () => {
    if (/^0x[a-fA-F0-9]{40}$/.test(customWalletInput)) {
      connectSimulatedWallet(customWalletInput);
      setCustomWalletInput('');
    } else {
      alert('Please enter a valid 20-byte EVM address (0x followed by 40 hex characters)');
    }
  };

  const disconnectWallet = () => {
    setConnectedWallet('');
    triggerAlert('Wallet disconnected.');
  };

  const copyWalletToClipboard = () => {
    if (connectedWallet) {
      navigator.clipboard.writeText(connectedWallet);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Helper alert function
  const triggerAlert = (msg: string) => {
    alert(msg);
  };

  // Get Whitelist Status of Connected Wallet
  const getConnectedWalletStatus = (): 'not_applied' | 'pending' | 'approved' | 'rejected' => {
    if (!connectedWallet) return 'not_applied';
    const found = applicants.find(app => standardizeAddress(app.wallet) === standardizeAddress(connectedWallet));
    if (!found) return 'not_applied';
    return found.status;
  };

  // ── Whitelist Submission Logic ───────────────────
  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    if (!formUsername.trim()) errors.push('Twitter username is required (Step 1: Follow)');
    if (!formLikeUsername.trim()) errors.push('Twitter username confirming the like is required (Step 2: Like)');

    const isTwitter = (url: string) => url.includes('twitter.com') || url.includes('x.com');
    if (!isTwitter(formQtLink)) errors.push('Quote Tweet Link must be a valid Twitter/X link (Step 3)');
    if (!isTwitter(formCommentLink)) errors.push('Comment Link must be a valid Twitter/X link (Step 4)');
    if (!/^0x[a-fA-F0-9]{40}$/.test(formWallet.trim())) errors.push('EVM Wallet must be a valid 0x address (Step 5)');

    if (errors.length > 0) { setFormErrors(errors); return; }

    try {
      const res = await fetch(`${API}/applicants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formUsername.trim().replace('@', ''),
          likeUsername: formLikeUsername.trim().replace('@', ''),
          qtLink: formQtLink.trim(),
          commentLink: formCommentLink.trim(),
          wallet: formWallet.trim(),
        }),
      });
      const result = await res.json();
      if (!result.success) { setFormErrors([result.message]); return; }

      setFormErrors([]);
      setShowFormSuccessAlert(true);
      setFormUsername(''); setFormLikeUsername('');
      setFormQtLink(''); setFormCommentLink('');
      setFormWallet(connectedWallet || '');
      refreshApplicants();
    } catch {
      setFormErrors(['Could not reach the server. Make sure the API is running on port 3001.']);
    }
  };

  // ── Checker Logic ──────────────────────────────
  const handleSearchCheck = () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    const found = applicants.find(
      app => app.wallet.toLowerCase() === query || app.username.toLowerCase() === query.replace('@', '')
    );

    setCheckerSearchResult(found || null);
    setCheckerHasSearched(true);
  };

  // ── Admin Lock & Key passcode logic ──────────────
  const handleUnlockAdmin = () => {
    if (adminPasscode.toLowerCase() === 'bobo' || adminPasscode.toLowerCase() === 'fugly') {
      setIsAdminUnlocked(true);
      setAdminPasscodeError(false);
      setPasscodeModalOpen(false);
      setCurrentPage('admin');
      setAdminPasscode('');
    } else {
      setAdminPasscodeError(true);
    }
  };

  const handleAdminAction = async (wallet: string, action: 'approved' | 'rejected') => {
    try {
      await fetch(`${API}/applicants/${encodeURIComponent(wallet)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      });
      refreshApplicants();
    } catch { triggerAlert('API error updating status.'); }
  };

  const handleAdminDelete = async (wallet: string) => {
    if (!confirm('Delete this application?')) return;
    try {
      await fetch(`${API}/applicants/${encodeURIComponent(wallet)}`, { method: 'DELETE' });
      refreshApplicants();
    } catch { triggerAlert('API error deleting applicant.'); }
  };

  const handleManualWhitelist = async () => {
    const wallets = manualAddressInput.split(/[\n,]/).map(l => l.trim()).filter(l => /^0x[a-fA-F0-9]{40}$/.test(l));
    if (wallets.length === 0) { triggerAlert('No valid EVM addresses found.'); return; }
    try {
      const res = await fetch(`${API}/applicants/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallets }),
      });
      const result = await res.json();
      setManualAddressInput('');
      triggerAlert(`Whitelisted ${result.added} wallets!`);
      refreshApplicants();
    } catch { triggerAlert('API error during batch import.'); }
  };

  // Generate Merkle Proof for select address in Admin
  const handleGenerateProof = () => {
    if (!merkleTree) {
      triggerAlert('Merkle Tree is empty! Approve some wallets first.');
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(proofAddress)) {
      triggerAlert('Please enter a valid 0x address to check proof.');
      return;
    }

    const proof = merkleTree.getProof(proofAddress);
    setGeneratedProof(proof);
  };

  // Database Suite (JSON / CSV Exporters)
  const exportToJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(applicants, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "fugly_whitelist_applicants.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Username,Wallet,QT Link,Comment Link,Status,Applied At\n";
    
    applicants.forEach(app => {
      csvContent += `"${app.username}","${app.wallet}","${app.qtLink}","${app.commentLink}","${app.status}","${app.appliedAt}"\n`;
    });

    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", "fugly_whitelist.csv");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            // Basic validation
            const valid = parsed.every(item => 
              'username' in item && 'wallet' in item && 'status' in item
            );
            if (valid) {
              saveApplicants(parsed);
              triggerAlert('Whitelist database successfully restored!');
            } else {
              triggerAlert('Invalid file structure. Make sure keys match whitelist entries.');
            }
          }
        } catch (error) {
          triggerAlert('Failed to parse JSON file.');
        }
      };
    }
  };

  const resetLocalDatabase = () => {
    if (confirm('CRITICAL WARNING: This will delete ALL applications and revert to default demo data! Proceed?')) {
      saveApplicants(INITIAL_MOCK_APPLICANTS);
      triggerAlert('Database reset to defaults.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative font-bobo overflow-x-hidden pb-12">
      
      {/* BACKGROUND DECORATIVE GRID */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:30px_30px] opacity-35 z-0 pointer-events-none"></div>

      {/* HEADER SECTION */}
      <header className="relative z-10 border-b-6 border-black bg-pinkCard p-4 text-black flex items-center justify-between shadow-retro">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentPage('explore')}>
          <img 
            src="/logo-with-bg-white.png" 
            alt="Fugly Logo" 
            className="w-12 h-12 rounded-xl border-3 border-black shadow-retro" 
            onError={(e) => {
              // Fallback if logo not found
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <h1 className="text-2xl tracking-wider leading-none glow-pink">FUGLY FAM</h1>
            <span className="text-[10px] tracking-widest font-jersey border-2 border-black bg-yellow-300 px-2 py-0.5 rounded-md mt-1 inline-block">ETH MINT WL</span>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          {connectedWallet ? (
            <div className="flex items-center border-3 border-black bg-white rounded-xl overflow-hidden shadow-retro">
              <span 
                className="font-jersey text-base px-3 py-1 bg-[#77EBFF] border-r-3 border-black cursor-pointer hover:bg-opacity-85 flex items-center gap-1.5"
                onClick={copyWalletToClipboard}
              >
                {copySuccess ? <Check size={14} className="text-green-700" /> : <Copy size={14} />}
                {connectedWallet.substring(0, 5)}...{connectedWallet.substring(38)}
              </span>
              <button 
                onClick={disconnectWallet}
                className="px-2.5 py-1 text-[11px] font-jersey bg-red-400 hover:bg-red-500 font-bold border-0 text-black cursor-pointer transition-all"
              >
                DISCONNECT
              </button>
            </div>
          ) : (
            <button 
              onClick={connectMetaMask}
              className="border-3 border-black bg-[#77EBFF] text-black rounded-xl px-4 py-1.5 text-xs tracking-widest shadow-retro active:scale-95 transition-all cursor-pointer flex items-center gap-2"
            >
              <Wallet size={14} />
              CONNECT WALLET
            </button>
          )}

          <button 
            onClick={() => {
              if (isAdminUnlocked) {
                setCurrentPage('admin');
              } else {
                setPasscodeModalOpen(true);
              }
            }}
            className="border-3 border-black bg-black text-white hover:bg-neutral-800 rounded-xl p-1.5 shadow-retro cursor-pointer"
            title="Admin Portal"
          >
            <Settings size={18} />
          </button>
        </nav>
      </header>

      {/* MAIN CONTAINER */}
      <main className="container mx-auto px-4 mt-8 relative z-10">
        
        {/* EXPLORE PAGE */}
        {currentPage === 'explore' && (
          <section className="flex flex-col items-center justify-center min-h-[80vh] relative rounded-3xl border-8 border-black overflow-hidden shadow-retro-lg bg-black">
            {/* Full-bleed banner artwork */}
            <img
              src="/banner.png"
              alt="FUGLY FAM Banner"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            {/* Subtle bottom gradient so text remains readable */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>

            <div className="relative z-10 flex flex-col items-center max-w-2xl px-6 text-center gap-6 pb-12 pt-8">
              <img
                src="/logo-with-bg-white.png"
                alt="Fuglyfam"
                className="w-28 h-28 rounded-full border-6 border-black shadow-retro-lg drop-shadow-2xl"
              />

              <h2 className="text-4xl md:text-6xl text-white tracking-widest leading-none glow-pink drop-shadow-lg">
                FUGLY FAM
              </h2>

              <p className="font-jersey text-xl md:text-2xl text-[#77EBFF] leading-relaxed max-w-lg glow-cyan drop-shadow-lg">
                WE ARE EXTREMELY UGLY, BUT RETRO IS ETERNAL. JOIN THE ETH WHITELIST TO SECURE YOUR NFT MINT.
              </p>

              <button
                onClick={() => setCurrentPage('hub')}
                className="mt-4 border-4 border-black bg-[#FF9393] text-black text-xl md:text-2xl rounded-2xl px-12 py-4 tracking-wider shadow-retro hover:-translate-y-1 hover:shadow-glow active:scale-95 transition-all cursor-pointer"
              >
                ENTER THE PORTAL
              </button>
            </div>
          </section>
        )}

        {/* HUB PAGE */}
        {currentPage === 'hub' && (
          <section className="max-w-4xl mx-auto flex flex-col gap-8">
            
            {/* WELCOME BANNER WITH USER ARTWORK */}
            <div className="rounded-3xl border-6 border-black bg-pinkCard p-6 md:p-8 text-black shadow-retro relative overflow-hidden flex flex-col md:flex-row items-center gap-6">
              <div
                className="absolute inset-0 opacity-30 bg-center bg-cover z-0 pointer-events-none"
                style={{ backgroundImage: `url('/banner.png')` }}
              ></div>

              <div className="relative z-10 flex-1 flex flex-col gap-2">
                <h3 className="text-3xl md:text-4xl leading-none">MINT ENTRY HUB</h3>
                <p className="font-jersey text-lg md:text-xl text-neutral-800 leading-tight">
                  Welcome to the official FuglyFam Ethereum portal. Complete social actions to qualify for the whitelist. Minting live soon on Ethereum Mainnet.
                </p>
                
                {/* Connected status badge */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="border-2 border-black bg-white rounded-lg px-3 py-1 text-xs flex items-center gap-1.5">
                    Wallet status: 
                    {connectedWallet ? (
                      <span className="text-green-600 font-jersey font-bold text-sm">CONNECTED</span>
                    ) : (
                      <span className="text-red-500 font-jersey font-bold text-sm">DISCONNECTED</span>
                    )}
                  </span>

                  {connectedWallet && (
                    <span className="border-2 border-black bg-white rounded-lg px-3 py-1 text-xs flex items-center gap-1.5">
                      Your status: 
                      {getConnectedWalletStatus() === 'approved' && (
                        <span className="text-green-600 font-jersey font-bold text-sm bg-green-50 px-1.5 py-0.5 rounded">APPROVED 🎉</span>
                      )}
                      {getConnectedWalletStatus() === 'pending' && (
                        <span className="text-yellow-600 font-jersey font-bold text-sm bg-yellow-50 px-1.5 py-0.5 rounded">PENDING REVIEW ⏳</span>
                      )}
                      {getConnectedWalletStatus() === 'rejected' && (
                        <span className="text-red-600 font-jersey font-bold text-sm bg-red-50 px-1.5 py-0.5 rounded">REJECTED ❌</span>
                      )}
                      {getConnectedWalletStatus() === 'not_applied' && (
                        <span className="text-blue-600 font-jersey font-bold text-sm bg-blue-50 px-1.5 py-0.5 rounded">NOT YET APPLIED</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              <img 
                src="/logo-with-bg-white.png" 
                alt="Fugly logo" 
                className="w-24 h-24 rounded-2xl border-4 border-black shadow-retro relative z-10"
              />
            </div>

            {/* ACTION PANELS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* APPLY WHITE LIST CARD */}
              <div className="border-6 border-black bg-[#FF9393] rounded-3xl p-6 text-black shadow-retro flex flex-col gap-4 relative overflow-hidden">
                <h4 className="text-2xl md:text-3xl leading-none">1. APPLY WHITELIST</h4>
                <p className="font-jersey text-base md:text-lg leading-snug">
                  Link your Twitter account, verify your social tasks (Follow, Quote Tweet, Comment with 3 Friends), and submit your Ethereum address.
                </p>
                <div className="flex-1"></div>
                
                {getConnectedWalletStatus() === 'approved' ? (
                  <div className="border-3 border-black bg-green-100 p-3 rounded-2xl text-green-800 text-xs flex items-center gap-2">
                    <CheckCircle size={18} className="shrink-0" />
                    <span>You are already whitelisted! Prepare for mint day.</span>
                  </div>
                ) : getConnectedWalletStatus() === 'pending' ? (
                  <div className="border-3 border-black bg-yellow-100 p-3 rounded-2xl text-yellow-800 text-xs flex items-center gap-2">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>Your application is currently pending developer review. Check back later!</span>
                  </div>
                ) : (
                  <button 
                    onClick={() => setCurrentPage('apply')}
                    className="border-3 border-black bg-black text-white hover:bg-neutral-800 rounded-2xl py-3 text-center text-lg tracking-wider shadow-retro cursor-pointer transition-all active:scale-95"
                  >
                    START APPLICATION
                  </button>
                )}
              </div>

              {/* WHITELIST CHECKER CARD */}
              <div className="border-6 border-black bg-[#77EBFF] rounded-3xl p-6 text-black shadow-retro flex flex-col gap-4 relative overflow-hidden">
                <h4 className="text-2xl md:text-3xl leading-none">2. WL STATUS CHECKER</h4>
                <p className="font-jersey text-base md:text-lg leading-snug">
                  Query the live whitelist directory to see if your address is approved. Export options are available in the checker.
                </p>
                <div className="flex-1"></div>
                <button 
                  onClick={() => setCurrentPage('checker')}
                  className="border-3 border-black bg-black text-white hover:bg-neutral-800 rounded-2xl py-3 text-center text-lg tracking-wider shadow-retro cursor-pointer transition-all active:scale-95"
                >
                  OPEN CHECKER
                </button>
              </div>

            </div>
          </section>
        )}

        {/* APPLY PAGE */}
        {currentPage === 'apply' && (
          <section className="max-w-xl mx-auto flex flex-col gap-6">

            <div className="flex justify-between items-center">
              <button
                onClick={() => setCurrentPage('hub')}
                className="border-3 border-black bg-white hover:bg-neutral-100 text-black px-4 py-1.5 rounded-xl text-xs tracking-wider shadow-retro cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> BACK
              </button>
              <h3 className="text-2xl md:text-3xl leading-none glow-pink">APPLY WHITELIST</h3>
            </div>

            {/* Success State */}
            {showFormSuccessAlert ? (
              <div className="border-6 border-black bg-[#ffd5ec] text-black rounded-3xl p-8 shadow-retro-lg flex flex-col items-center gap-4 text-center">
                <CheckCircle size={64} className="text-green-600 animate-bounce" />
                <h4 className="text-3xl">APPLICATION SUBMITTED!</h4>
                <p className="font-jersey text-lg leading-relaxed max-w-md">
                  Your details have been saved to our queue. The team will verify your Twitter tasks and approve your EVM wallet shortly!
                </p>
                <div className="flex gap-4 mt-2">
                  <button
                    onClick={() => { setShowFormSuccessAlert(false); setCurrentPage('hub'); }}
                    className="border-3 border-black bg-black text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-retro hover:bg-neutral-800 cursor-pointer"
                  >
                    GO TO HUB
                  </button>
                  <button
                    onClick={() => { setShowFormSuccessAlert(false); setCurrentPage('checker'); }}
                    className="border-3 border-black bg-[#77EBFF] text-black px-6 py-2.5 rounded-xl text-sm font-bold shadow-retro hover:bg-cyan-400 cursor-pointer"
                  >
                    CHECK STATUS
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleApplySubmit} className="border-6 border-black bg-pinkCard rounded-[2.2rem] p-6 text-black shadow-retro flex flex-col gap-4">

                {/* Errors */}
                {formErrors.length > 0 && (
                  <div className="border-3 border-black bg-red-100 p-4 rounded-2xl text-red-800 text-xs flex flex-col gap-1">
                    <span className="font-bold flex items-center gap-1.5 mb-1"><XCircle size={16} /> FIX BEFORE SUBMITTING:</span>
                    {formErrors.map((err, idx) => (
                      <span key={idx} className="font-jersey text-sm">• {err}</span>
                    ))}
                  </div>
                )}

                {/* TASK 1 — Follow */}
                <div className="flex items-center justify-between gap-3 bg-black text-white rounded-2xl px-5 py-3.5">
                  <div className="flex-1">
                    <span className="text-[10px] text-[#FF9393] tracking-widest block">STEP 1</span>
                    <span className="text-sm tracking-wide">FOLLOW FUGLYFAM</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="text"
                      placeholder="Username"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      className="w-28 bg-white text-black text-center rounded-lg px-2 py-2 text-xs outline-none placeholder-black/40 font-jersey border-0"
                    />
                    <a
                      href="https://x.com/fuglyfam"
                      target="_blank"
                      rel="noreferrer"
                      className="bg-white text-black rounded-lg px-4 py-2 text-xs font-jersey cursor-pointer border-0 hover:bg-neutral-200 transition-all whitespace-nowrap"
                    >
                      Follow
                    </a>
                  </div>
                </div>

                {/* TASK 2 — Like */}
                <div className="flex items-center justify-between gap-3 bg-black text-white rounded-2xl px-5 py-3.5">
                  <div className="flex-1">
                    <span className="text-[10px] text-[#FF9393] tracking-widest block">STEP 2</span>
                    <span className="text-sm tracking-wide">LIKE PINNED POST</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Username"
                    value={formLikeUsername}
                    onChange={(e) => setFormLikeUsername(e.target.value)}
                    className="w-32 bg-white text-black text-center rounded-lg px-2 py-2 text-xs outline-none placeholder-black/40 font-jersey border-0 shrink-0"
                  />
                </div>

                {/* TASK 3 — QT */}
                <div className="flex items-center justify-between gap-3 bg-black text-white rounded-2xl px-5 py-3.5">
                  <div className="flex-1">
                    <span className="text-[10px] text-[#FF9393] tracking-widest block">STEP 3</span>
                    <span className="text-sm tracking-wide leading-tight">QT PINNED POST WITH<br />&quot;fuglys are coming&quot;</span>
                  </div>
                  <input
                    type="text"
                    placeholder="QT Link"
                    value={formQtLink}
                    onChange={(e) => setFormQtLink(e.target.value)}
                    className="w-32 bg-white text-black text-center rounded-lg px-2 py-2 text-xs outline-none placeholder-black/40 font-jersey border-0 shrink-0"
                  />
                </div>

                {/* TASK 4 — Tag 3 friends */}
                <div className="flex items-center justify-between gap-3 bg-black text-white rounded-2xl px-5 py-3.5">
                  <div className="flex-1">
                    <span className="text-[10px] text-[#FF9393] tracking-widest block">STEP 4</span>
                    <span className="text-sm tracking-wide">TAG 3 FRIENDS ON PINNED POST</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Comment link"
                    value={formCommentLink}
                    onChange={(e) => setFormCommentLink(e.target.value)}
                    className="w-32 bg-white text-black text-center rounded-lg px-2 py-2 text-xs outline-none placeholder-black/40 font-jersey border-0 shrink-0"
                  />
                </div>

                {/* TASK 5 — EVM Wallet */}
                <div className="flex items-center justify-between gap-3 bg-black text-white rounded-2xl px-5 py-3.5">
                  <div className="flex-1">
                    <span className="text-[10px] text-[#FF9393] tracking-widest block">STEP 5</span>
                    <span className="text-sm tracking-wide">SUBMIT EVM WALLET</span>
                  </div>
                  <input
                    type="text"
                    placeholder="0x......."
                    value={formWallet}
                    onChange={(e) => setFormWallet(e.target.value)}
                    disabled={!!connectedWallet}
                    className={`w-32 text-black text-center rounded-lg px-2 py-2 text-xs outline-none font-jersey border-0 shrink-0 ${connectedWallet ? 'bg-neutral-300 cursor-not-allowed' : 'bg-white placeholder-black/40'}`}
                  />
                </div>

                {connectedWallet && (
                  <p className="font-jersey text-xs text-neutral-600 text-center -mt-2">
                    Wallet auto-filled from MetaMask. Disconnect in header to change.
                  </p>
                )}

                <button
                  type="submit"
                  className="self-center bg-black text-white rounded-xl px-12 py-3 text-base font-bobo cursor-pointer border-0 hover:bg-neutral-800 transition-all mt-2 shadow-retro active:scale-95"
                >
                  SUBMIT
                </button>
              </form>
            )}

          </section>
        )}

        {/* WHITELIST CHECKER PAGE */}
        {currentPage === 'checker' && (
          <section className="max-w-3xl mx-auto flex flex-col gap-6">
            
            <div className="flex justify-between items-center">
              <button 
                onClick={() => setCurrentPage('hub')}
                className="border-3 border-black bg-white hover:bg-neutral-100 text-black px-4 py-1.5 rounded-xl text-xs tracking-wider shadow-retro cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> BACK
              </button>
              <h3 className="text-2xl md:text-3xl leading-none glow-cyan">WHITELIST DIRECTORY</h3>
            </div>

            {/* LIVE QUERY STATS */}
            <div className="grid grid-cols-3 gap-4 border-4 border-black bg-pinkCard text-black rounded-2xl p-4 shadow-retro">
              <div className="text-center border-r-3 border-black">
                <span className="font-jersey text-sm text-neutral-700 block">WHITELISTED</span>
                <span className="text-3xl leading-none font-jersey text-green-700">{applicants.filter(a => a.status === 'approved').length}</span>
              </div>
              <div className="text-center border-r-3 border-black">
                <span className="font-jersey text-sm text-neutral-700 block">PENDING</span>
                <span className="text-3xl leading-none font-jersey text-yellow-700">{applicants.filter(a => a.status === 'pending').length}</span>
              </div>
              <div className="text-center">
                <span className="font-jersey text-sm text-neutral-700 block">TOTAL QUEUED</span>
                <span className="text-3xl leading-none font-jersey">{applicants.length}</span>
              </div>
            </div>

            {/* SEARCH BOX */}
            <div className="border-6 border-black bg-[#77EBFF] rounded-3xl p-6 text-black shadow-retro flex flex-col gap-4">
              <h4 className="text-xl">QUERY WHITELIST STATUS</h4>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3.5 text-black/50" size={20} />
                  <input 
                    type="text" 
                    placeholder="Enter EVM address (0x...) or Twitter handle"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchCheck();
                    }}
                    className="w-full border-3 border-black rounded-xl py-3 pl-12 pr-4 bg-white text-black outline-none font-jersey text-lg"
                  />
                </div>
                <button 
                  onClick={handleSearchCheck}
                  className="border-3 border-black bg-black text-white hover:bg-neutral-800 rounded-xl px-6 font-bold cursor-pointer transition-all active:scale-95 shadow-retro shrink-0"
                >
                  SEARCH
                </button>
              </div>

              {/* SEARCH RESULTS BOX */}
              {checkerHasSearched && (
                <div className="border-3 border-black bg-white rounded-2xl p-4 flex flex-col gap-3 mt-2 shadow-inner">
                  {checkerSearchResult ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center border-b border-neutral-200 pb-2">
                        <div>
                          <span className="font-jersey text-base text-neutral-600">APPLICANT</span>
                          <h5 className="text-lg leading-none">@{checkerSearchResult.username}</h5>
                        </div>
                        
                        {checkerSearchResult.status === 'approved' && (
                          <span className="font-jersey font-bold text-sm bg-green-100 text-green-800 px-3 py-1 rounded-xl border border-green-300">WHITELISTED 🎉</span>
                        )}
                        {checkerSearchResult.status === 'pending' && (
                          <span className="font-jersey font-bold text-sm bg-yellow-100 text-yellow-800 px-3 py-1 rounded-xl border border-yellow-300">PENDING REVIEW ⏳</span>
                        )}
                        {checkerSearchResult.status === 'rejected' && (
                          <span className="font-jersey font-bold text-sm bg-red-100 text-red-800 px-3 py-1 rounded-xl border border-red-300">REJECTED ❌</span>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-xs mt-1">
                        <span className="font-jersey text-neutral-500 font-bold">ETH WALLET:</span>
                        <span className="font-mono text-sm break-all">{checkerSearchResult.wallet}</span>
                      </div>

                      {checkerSearchResult.status === 'approved' && merkleTree && (
                        <div className="mt-2 border-t border-neutral-100 pt-2 flex flex-col gap-1 text-[11px] font-jersey">
                          <div className="flex justify-between text-neutral-500">
                            <span>CRYPTOGRAPHIC MERKLE ROOT:</span>
                            <span className="font-mono text-black font-bold select-all">{merkleTree.getRoot().substring(0, 10)}...{merkleTree.getRoot().substring(56)}</span>
                          </div>
                          <div className="flex justify-between text-neutral-500">
                            <span>MINT LEAF PROOF GENERATION:</span>
                            <span className="text-green-700 font-bold">AVAILABLE IN MINT APP</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-4 text-center text-neutral-500 gap-1.5">
                      <XCircle size={32} className="text-red-500" />
                      <h5 className="text-base font-bold text-black">NO APPLICATION FOUND</h5>
                      <p className="font-jersey text-sm text-neutral-600 max-w-xs">
                        This address or username was not found in our database. Complete the whitelist application form first.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* LIVE WHITE LIST DIRECTORY TABLE */}
            <div className="border-6 border-black bg-white text-black rounded-3xl shadow-retro overflow-hidden">
              <div className="bg-neutral-100 border-b-4 border-black p-4 flex justify-between items-center">
                <span className="text-lg">APPROVED ETH MINT WALLETS ({applicants.filter(a => a.status === 'approved').length})</span>
                
                <div className="flex gap-2">
                  <button onClick={exportToCSV} className="font-jersey border-2 border-black bg-white hover:bg-neutral-100 px-3 py-0.5 rounded-lg text-sm shadow-retro flex items-center gap-1.5">
                    <Download size={12} /> CSV
                  </button>
                  <button onClick={exportToJSON} className="font-jersey border-2 border-black bg-white hover:bg-neutral-100 px-3 py-0.5 rounded-lg text-sm shadow-retro flex items-center gap-1.5">
                    <Download size={12} /> JSON
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse font-jersey text-lg">
                  <thead>
                    <tr className="border-b-3 border-black bg-neutral-50">
                      <th className="py-2.5 px-4 text-center border-r-2 border-black text-xs" style={{ width: '80px' }}>NO</th>
                      <th className="py-2.5 px-4 text-left border-r-2 border-black text-xs">ETH MINT WALLET</th>
                      <th className="py-2.5 px-4 text-center text-xs" style={{ width: '120px' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicants.filter(a => a.status === 'approved').length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-neutral-400 font-bobo text-sm">
                          No whitelisted wallets found in directory.
                        </td>
                      </tr>
                    ) : (
                      applicants.filter(a => a.status === 'approved').map((app, index) => (
                        <tr key={index} className="border-b border-neutral-200 hover:bg-neutral-50 transition-colors">
                          <td className="py-2 px-4 text-center border-r-2 border-black font-bold font-mono">{index + 1}</td>
                          <td className="py-2 px-4 font-mono break-all text-sm select-all">{app.wallet}</td>
                          <td className="py-2 px-4 text-center">
                            <span className="text-xs bg-green-100 text-green-800 font-bold px-2.5 py-0.5 rounded border border-green-300">WHITELISTED</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </section>
        )}

        {/* ADMIN PORTAL PAGE */}
        {currentPage === 'admin' && isAdminUnlocked && (
          <section className="max-w-5xl mx-auto flex flex-col gap-8">
            
            <div className="flex justify-between items-center">
              <button 
                onClick={() => setCurrentPage('hub')}
                className="border-3 border-black bg-white hover:bg-neutral-100 text-black px-4 py-1.5 rounded-xl text-xs tracking-wider shadow-retro cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> LEAVE ADMIN
              </button>
              
              <div className="flex items-center gap-2">
                <span className="border-2 border-black bg-red-400 text-black px-3 py-1 rounded-xl text-xs tracking-wider flex items-center gap-1.5 shadow-retro">
                  <Shield size={14} /> ADMIN ACTIVE
                </span>
              </div>
            </div>

            {/* DASHBOARD STATS CARD */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border-4 border-black bg-[#ffd5ec] text-black p-4 rounded-2xl shadow-retro">
                <span className="font-jersey text-sm text-neutral-600 block leading-tight">TOTAL APPLICATIONS</span>
                <span className="text-4xl font-jersey leading-none font-bold">{applicants.length}</span>
              </div>
              <div className="border-4 border-black bg-[#d4f9d4] text-black p-4 rounded-2xl shadow-retro">
                <span className="font-jersey text-sm text-neutral-600 block leading-tight text-green-700">APPROVED MINT</span>
                <span className="text-4xl font-jersey leading-none font-bold text-green-700">{applicants.filter(a => a.status === 'approved').length}</span>
              </div>
              <div className="border-4 border-black bg-[#fff4cc] text-black p-4 rounded-2xl shadow-retro">
                <span className="font-jersey text-sm text-neutral-600 block leading-tight text-yellow-700">PENDING REVIEW</span>
                <span className="text-4xl font-jersey leading-none font-bold text-yellow-700">{applicants.filter(a => a.status === 'pending').length}</span>
              </div>
              <div className="border-4 border-black bg-[#ffd6d6] text-black p-4 rounded-2xl shadow-retro">
                <span className="font-jersey text-sm text-neutral-600 block leading-tight text-red-700">REJECTED / SPAM</span>
                <span className="text-4xl font-jersey leading-none font-bold text-red-700">{applicants.filter(a => a.status === 'rejected').length}</span>
              </div>
            </div>

            {/* CRYPTOGRAPHIC MERKLE ENGINE TERMINAL */}
            <div className="border-6 border-black bg-black text-[#77EBFF] rounded-3xl p-6 shadow-retro-lg flex flex-col gap-4 font-jersey">
              <div className="flex items-center justify-between border-b border-[#77EBFF]/30 pb-3">
                <span className="text-2xl tracking-wider text-white flex items-center gap-2"><Layers size={22} className="text-[#FF9393]" /> CRYPTOGRAPHIC MERKLE TREE COMPILER</span>
                <span className="bg-[#77EBFF]/10 text-xs px-2.5 py-0.5 rounded border border-[#77EBFF]/30 font-mono">HASH: SHA-256</span>
              </div>

              {/* Dynamic Merkle Root */}
              <div className="bg-neutral-900 border-2 border-neutral-800 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-sm">
                <div>
                  <span className="text-[#FF9393] text-xs font-bold font-jersey block mb-1">SOLIDITY CONTRACT MERKLE ROOT:</span>
                  <span className="text-white text-base select-all">{merkleTree ? merkleTree.getRoot() : '0x' + '0'.repeat(64)}</span>
                </div>
                {merkleTree && (
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(merkleTree.getRoot());
                      triggerAlert('Merkle Root copied to clipboard!');
                    }}
                    className="font-jersey border-2 border-[#77EBFF] hover:bg-[#77EBFF]/10 px-4 py-1.5 rounded-xl text-xs text-[#77EBFF] cursor-pointer transition-all shrink-0"
                  >
                    COPY MERKLE ROOT
                  </button>
                )}
              </div>

              {/* Merkle Proof Exporter Panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                
                {/* Proof Query */}
                <div className="flex flex-col gap-3 bg-neutral-950 p-4 rounded-2xl border border-neutral-900">
                  <span className="text-white text-sm">GENERATE PROOF FOR WHITELISTED ADDRESS:</span>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="0x Address"
                      value={proofAddress}
                      onChange={(e) => setProofAddress(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono text-xs outline-none"
                    />
                    <button 
                      onClick={handleGenerateProof}
                      className="bg-[#77EBFF] text-black hover:bg-cyan-400 font-bold px-4 rounded-xl text-xs cursor-pointer transition-all active:scale-95"
                    >
                      PROOF ➔
                    </button>
                  </div>

                  {generatedProof.length > 0 ? (
                    <div className="flex flex-col gap-1.5 mt-1 font-mono text-xs">
                      <span className="text-green-400">MEMBER PROOF GENERATED:</span>
                      <pre className="bg-neutral-900 p-2.5 rounded-lg text-white border border-neutral-800 overflow-x-auto select-all leading-tight">
                        {JSON.stringify(generatedProof, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <span className="text-neutral-500 text-xs italic block mt-1">Proof array will compile here for Solidity whitelist minting arguments.</span>
                  )}
                </div>

                {/* Solidity Snippet */}
                <div className="flex flex-col gap-2 bg-neutral-950 p-4 rounded-2xl border border-neutral-900 text-xs">
                  <span className="text-white text-sm font-jersey">SOLIDITY SMART CONTRACT PROOF VERIFICATION:</span>
                  <pre className="bg-neutral-900 p-2.5 rounded-lg text-[#FF9393] border border-neutral-800 overflow-x-auto select-all leading-tight font-mono whitespace-pre-wrap max-h-[140px] overflow-y-auto">
{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract FuglyMint {
    bytes32 public merkleRoot = ${merkleTree ? merkleTree.getRoot().substring(0, 14) + '...' : '0xYOUR_MERKLE_ROOT'};

    function mint(bytes32[] calldata proof) external {
        bytes32 leaf = sha256(abi.encodePacked(msg.sender));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Not whitelisted!");
        // Proceed with whitelist mint...
    }
}`}
                  </pre>
                </div>

              </div>
            </div>

            {/* MANUAL WHITELIST & FILE IMPORT ACTIONS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-black">
              
              {/* Batch Manual Whitelist */}
              <div className="border-4 border-black bg-pinkCard p-6 rounded-3xl shadow-retro md:col-span-2 flex flex-col gap-3">
                <h4 className="text-xl">BATCH MANUAL WHITELISTER</h4>
                <p className="font-jersey text-sm text-neutral-700 leading-tight">
                  Directly paste raw EVM wallets (separated by commas or newlines) to immediately grant approved Whitelisted status.
                </p>
                <textarea 
                  rows={4}
                  placeholder="0x90F8bf3f24C1069f3F24C1069F3F24C1069f3F24&#10;0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
                  value={manualAddressInput}
                  onChange={(e) => setManualAddressInput(e.target.value)}
                  className="w-full border-3 border-black rounded-xl p-3 bg-white text-black outline-none font-mono text-xs shadow-inner"
                ></textarea>
                <button 
                  onClick={handleManualWhitelist}
                  className="border-3 border-black bg-[#77EBFF] text-black hover:bg-cyan-400 font-bold py-2 rounded-xl text-xs shadow-retro cursor-pointer transition-all active:scale-95"
                >
                  BATCH ADD WALLETS TO WHITELIST
                </button>
              </div>

              {/* Data controls */}
              <div className="border-4 border-black bg-[#77EBFF] p-6 rounded-3xl shadow-retro flex flex-col gap-4">
                <h4 className="text-xl">DATABASE CONTROL</h4>
                
                <div className="flex flex-col gap-2 font-jersey text-lg">
                  {/* CSV Export */}
                  <button 
                    onClick={exportToCSV}
                    className="w-full border-3 border-black bg-white hover:bg-neutral-100 py-1.5 rounded-xl shadow-retro flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download size={16} /> EXPORT TO CSV
                  </button>

                  {/* JSON Export */}
                  <button 
                    onClick={exportToJSON}
                    className="w-full border-3 border-black bg-white hover:bg-neutral-100 py-1.5 rounded-xl shadow-retro flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download size={16} /> EXPORT TO JSON
                  </button>

                  {/* JSON Import */}
                  <label className="w-full border-3 border-black bg-white hover:bg-neutral-100 py-1.5 rounded-xl shadow-retro flex items-center justify-center gap-2 cursor-pointer text-center select-none">
                    <Upload size={16} /> IMPORT FROM JSON
                    <input 
                      type="file" 
                      accept=".json"
                      onChange={handleImportJSON}
                      className="hidden"
                    />
                  </label>

                  {/* Reset DB */}
                  <button 
                    onClick={resetLocalDatabase}
                    className="w-full border-3 border-black bg-red-400 hover:bg-red-500 py-1.5 rounded-xl shadow-retro flex items-center justify-center gap-2 cursor-pointer font-bold text-black mt-2"
                  >
                    <Trash2 size={16} /> RESET QUEUE
                  </button>
                </div>
              </div>

            </div>

            {/* APPLICANTS ADMINISTRATIVE QUEUE TABLE */}
            <div className="border-6 border-black bg-white text-black rounded-3xl shadow-retro-lg overflow-hidden">
              
              <div className="bg-neutral-100 border-b-4 border-black p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span className="text-xl">APPLICANTS PORTAL QUEUE ({applicants.length} TOTAL)</span>
                
                <div className="flex flex-wrap gap-2 text-xs font-jersey">
                  <span className="border border-neutral-300 bg-white rounded-lg px-2 py-1">PENDING: {applicants.filter(a => a.status === 'pending').length}</span>
                  <span className="border border-green-300 bg-green-50 rounded-lg px-2 py-1 text-green-700">APPROVED: {applicants.filter(a => a.status === 'approved').length}</span>
                  <span className="border border-red-300 bg-red-50 rounded-lg px-2 py-1 text-red-700">REJECTED: {applicants.filter(a => a.status === 'rejected').length}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse font-jersey text-lg">
                  <thead>
                    <tr className="border-b-3 border-black bg-neutral-50 text-xs">
                      <th className="py-3 px-4 text-center border-r-2 border-black" style={{ width: '60px' }}>NO</th>
                      <th className="py-3 px-4 text-left border-r-2 border-black">TWITTER INFO</th>
                      <th className="py-3 px-4 text-left border-r-2 border-black">ETH MINT WALLET</th>
                      <th className="py-3 px-4 text-center border-r-2 border-black" style={{ width: '130px' }}>STATUS</th>
                      <th className="py-3 px-4 text-center" style={{ width: '190px' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicants.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-neutral-400 font-bobo text-sm">
                          No whitelist applicants found in system queue.
                        </td>
                      </tr>
                    ) : (
                      applicants.map((app, index) => (
                        <tr key={index} className="border-b border-neutral-200 hover:bg-neutral-50 transition-colors">
                          <td className="py-3 px-4 text-center border-r-2 border-black font-bold font-mono text-sm">{index + 1}</td>
                          <td className="py-3 px-4 border-r-2 border-black">
                            <span className="font-bold text-sm block">@{app.username}</span>
                            <div className="flex gap-2 text-[10px] text-blue-600 font-mono mt-0.5">
                              {app.qtLink !== 'https://twitter.com/manual' ? (
                                <>
                                  <a href={app.qtLink} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-0.5">QT LINK <ExternalLink size={8} /></a>
                                  <span>|</span>
                                  <a href={app.commentLink} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-0.5">COMMENT <ExternalLink size={8} /></a>
                                </>
                              ) : (
                                <span className="text-neutral-500 font-jersey text-xs">Manual Admin Override Add</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs border-r-2 border-black select-all">
                            {app.wallet}
                          </td>
                          <td className="py-3 px-4 text-center border-r-2 border-black">
                            {app.status === 'approved' && (
                              <span className="text-xs bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded border border-green-300">APPROVED</span>
                            )}
                            {app.status === 'pending' && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 font-bold px-2 py-0.5 rounded border border-yellow-300">PENDING</span>
                            )}
                            {app.status === 'rejected' && (
                              <span className="text-xs bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded border border-red-300">REJECTED</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center flex items-center justify-center gap-1.5 mt-1 border-0">
                            {app.status !== 'approved' && (
                              <button 
                                onClick={() => handleAdminAction(app.wallet, 'approved')}
                                className="border border-green-600 bg-green-500 hover:bg-green-600 text-white text-xs px-2.5 py-1 rounded font-bold cursor-pointer"
                              >
                                APPROVE
                              </button>
                            )}
                            {app.status !== 'rejected' && (
                              <button 
                                onClick={() => handleAdminAction(app.wallet, 'rejected')}
                                className="border border-yellow-600 bg-yellow-500 hover:bg-yellow-600 text-black text-xs px-2.5 py-1 rounded font-bold cursor-pointer"
                              >
                                REJECT
                              </button>
                            )}
                            <button 
                              onClick={() => handleAdminDelete(app.wallet)}
                              className="border border-red-600 bg-red-500 hover:bg-red-600 text-white text-xs px-2.5 py-1 rounded font-bold cursor-pointer"
                            >
                              DELETE
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </section>
        )}

      </main>

      {/* FOOTER */}
      <footer className="relative z-10 text-center text-xs font-jersey text-neutral-500 mt-16 pt-6 border-t border-neutral-900 max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center px-4 gap-2">
        <span>© 2026 FUGLYFAM. ETHEREUM BLOCKCHAIN NFT MINT. ALL RIGHTS RESERVED.</span>
        <span className="cursor-pointer hover:text-white" onClick={() => setPasscodeModalOpen(true)}>SECRET DEV ACCESS</span>
      </footer>

      {/* SECRET DEV PASSCODE POPUP */}
      {passcodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm border-6 border-black bg-pinkCard text-black p-6 rounded-3xl shadow-retro-lg flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-black/10 pb-2">
              <h4 className="text-xl flex items-center gap-1.5"><Lock size={18} /> UNLOCK DEVELOPER CONSOLE</h4>
              <button 
                onClick={() => setPasscodeModalOpen(false)}
                className="font-jersey text-lg font-bold border-0 bg-transparent hover:text-neutral-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="font-jersey text-sm text-neutral-600 leading-tight">
              Please enter the administrator passcode to access whitelister approvals and the cryptographic Merkle Tree generator. (Default is &quot;bobo&quot; or &quot;fugly&quot;)
            </p>

            <div className="flex flex-col gap-1">
              <input 
                type="password" 
                placeholder="Enter password..."
                value={adminPasscode}
                onChange={(e) => setAdminPasscode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUnlockAdmin();
                }}
                className="border-3 border-black rounded-xl p-3 bg-white text-black outline-none font-mono text-center text-lg"
              />
              {adminPasscodeError && (
                <span className="font-jersey text-xs text-red-600 text-center font-bold">Incorrect administrator passcode! Try &quot;bobo&quot;.</span>
              )}
            </div>

            <button 
              onClick={handleUnlockAdmin}
              className="border-3 border-black bg-black text-white hover:bg-neutral-800 font-bold py-3 rounded-2xl text-center shadow-retro transition-all cursor-pointer"
            >
              UNLOCK ADMINISTRATION
            </button>
          </div>
        </div>
      )}

      {/* WEB3 SANDBOX WALLET CONNECT DIALOG */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md border-6 border-black bg-[#ffd5ec] text-black p-6 rounded-3xl shadow-retro-lg flex flex-col gap-4">
            
            <div className="flex justify-between items-center border-b border-black/10 pb-2">
              <h4 className="text-xl flex items-center gap-1.5"><Wallet size={18} /> EVM WALLET SANDBOX</h4>
              <button 
                onClick={() => setIsWalletModalOpen(false)}
                className="font-jersey text-lg font-bold border-0 bg-transparent hover:text-neutral-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="font-jersey text-sm text-neutral-600 leading-tight">
              MetaMask or other EVM wallet providers were not detected. You can easily connect a simulated test address from below, or enter a custom hex address!
            </p>

            {/* PRE-MADE MOCK WALLETS */}
            <div className="flex flex-col gap-2 font-jersey text-base">
              <span className="text-xs font-bold font-bobo tracking-wider">SELECT MOCK DEV ADDRESS:</span>
              
              <button 
                onClick={() => connectSimulatedWallet('0x90F8bf3f24C1069f3F24C1069F3F24C1069f3F24')}
                className="border-2 border-black bg-white hover:bg-neutral-100 rounded-xl p-2.5 font-mono text-xs flex justify-between items-center cursor-pointer shadow-retro"
              >
                <span className="font-jersey text-sm font-bold text-blue-700">Bobo Dev Account (Whitelisted)</span>
                <span>0x90F8...3F24</span>
              </button>

              <button 
                onClick={() => connectSimulatedWallet('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC')}
                className="border-2 border-black bg-white hover:bg-neutral-100 rounded-xl p-2.5 font-mono text-xs flex justify-between items-center cursor-pointer shadow-retro"
              >
                <span className="font-jersey text-sm font-bold text-yellow-600">Simulated Applicant (Pending)</span>
                <span>0x3C44...93BC</span>
              </button>

              <button 
                onClick={() => connectSimulatedWallet('0x976EA74026E726554dB657fA54763abd0C3a0aa9')}
                className="border-2 border-black bg-white hover:bg-neutral-100 rounded-xl p-2.5 font-mono text-xs flex justify-between items-center cursor-pointer shadow-retro"
              >
                <span className="font-jersey text-sm font-bold text-blue-700">Solidity Enthusiast (Whitelisted)</span>
                <span>0x976E...0aa9</span>
              </button>

              <button 
                onClick={() => connectSimulatedWallet('0xF39Fd6e51aad88F6F4ce6aB8827279cffFb92266')}
                className="border-2 border-black bg-white hover:bg-neutral-100 rounded-xl p-2.5 font-mono text-xs flex justify-between items-center cursor-pointer shadow-retro"
              >
                <span className="font-jersey text-sm font-bold text-neutral-600">Hardhat Node Account 0 (New)</span>
                <span>0xF39F...2266</span>
              </button>
            </div>

            {/* CUSTOM ADDRESS INPUT */}
            <div className="flex flex-col gap-1.5 border-t border-black/10 pt-3">
              <label className="text-xs tracking-wider">OR SUBMIT CUSTOM HEX ADDRESS (20-BYTES):</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="0x..."
                  value={customWalletInput}
                  onChange={(e) => setCustomWalletInput(e.target.value)}
                  className="flex-1 border-2 border-black rounded-xl px-3 py-2 font-mono text-xs outline-none bg-white text-black"
                />
                <button 
                  onClick={handleCustomWalletConnect}
                  className="border-2 border-black bg-black text-white hover:bg-neutral-800 rounded-xl px-4 text-xs font-bold cursor-pointer"
                >
                  CONNECT
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}