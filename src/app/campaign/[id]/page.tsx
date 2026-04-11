// CampaignDetailPage.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ethers, Contract } from 'ethers';
import { RPC } from '../../lib/config';

const EXPLORER = 'https://sepolia.etherscan.io';

const CAMPAIGN_ABI = [
  { name: 'title',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'description',  type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'image',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'goal',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDonated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'creator',      type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'location',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'deadline',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'social',       type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  {
    name: 'getDonations', type: 'function', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'tuple[]', components: [{ name: 'donor', type: 'address' }, { name: 'amount', type: 'uint256' }] }]
  },
  {
    name: 'requests', type: 'function', stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'amount', type: 'uint256' }, { name: 'reason', type: 'string' },
      { name: 'timestamp', type: 'uint256' }, { name: 'status', type: 'uint8' },
    ]
  },
  { name: 'requestWithdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }, { type: 'string' }], outputs: [] },
  { name: 'executeWithdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
  { name: 'donate',          type: 'function', stateMutability: 'payable',    inputs: [], outputs: [] },
  { name: 'isRefundable',    type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'claimRefund',     type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'donorTotal',      type: 'function', stateMutability: 'view',       inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'refundClaimed',   type: 'function', stateMutability: 'view',       inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'totalWithdrawn',  type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'refundAmountFor', type: 'function', stateMutability: 'view',       inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'event', name: 'WithdrawExecuted', inputs: [{ name: 'id', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'WithdrawDenied',   inputs: [{ name: 'id', type: 'uint256', indexed: false }] },
] as const;

type DonationRow  = { donor: string; amount: string };
type WithdrawRow  = { amount: string; reason: string; timestamp: number; status: number };
type Comment      = { cid: string; campaignAddress: string; author: string; text: string; timestamp: number; signature: string; verified: boolean };

function errText(err: any): string {
  const nested = err?.info?.error?.message || err?.data?.message || err?.cause?.message || err?.shortMessage || err?.reason || err?.message;
  try {
    const body = err?.body || err?.info?.error?.body;
    if (typeof body === 'string' && body.startsWith('{')) {
      const j = JSON.parse(body);
      const m = j?.error?.message || j?.message;
      if (m) return m;
    }
  } catch {}
  try {
    const data: string | undefined = err?.info?.error?.data || err?.data || err?.error?.data;
    if (typeof data === 'string' && data.startsWith('0x08c379a0')) {
      const [msg] = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + data.slice(10));
      if (msg) return String(msg);
    }
  } catch {}
  return nested || String(err || 'Unknown error');
}

function executedKey(addr: string) { return `wd:executed:${addr.toLowerCase()}`; }
function loadExecutedLS(addr: string): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem(executedKey(addr)) || '[]')); } catch { return new Set(); }
}
function saveExecutedLS(addr: string, set: Set<number>) {
  try { localStorage.setItem(executedKey(addr), JSON.stringify([...set])); } catch {}
}

export default function CampaignDetailPage() {
  const params   = useParams();
  const id       = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const provider = useMemo(() => new ethers.JsonRpcProvider(RPC), []);

  const [data,           setData]           = useState<any>(null);
  const [ready,          setReady]          = useState(false);
  const [currentAccount, setCurrentAccount] = useState('');
  const [isOwner,        setIsOwner]        = useState(false);
  const [donationAmount, setDonationAmount] = useState('');
  const [timeLeft,       setTimeLeft]       = useState('');
  const [withdrawals,    setWithdrawals]    = useState<WithdrawRow[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [executedIds,    setExecutedIds]    = useState<Set<number>>(new Set());
  const [deniedIds,      setDeniedIds]      = useState<Set<number>>(new Set());
  const [donating,          setDonating]          = useState(false);
  const [requesting,        setRequesting]        = useState(false);
  const [withdrawing,       setWithdrawing]       = useState(false);
  const [imgError,          setImgError]          = useState(false);
  const [comments,          setComments]          = useState<Comment[]>([]);
  const [commentText,       setCommentText]       = useState('');
  const [loadingComments,   setLoadingComments]   = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isRefundable,      setIsRefundable]      = useState(false);
  const [refundAmount,      setRefundAmount]      = useState('0');
  const [refundClaimed,     setRefundClaimed]     = useState(false);
  const [claiming,          setClaiming]          = useState(false);
  const [metadata,          setMetadata]          = useState<any>(null);

  // ─── Fetch Data ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !ethers.isAddress(id)) { setReady(true); return; }

    (async () => {
      try {
        const code = await provider.getCode(id);
        if (code === '0x') throw new Error('Bukan alamat kontrak');

        const contract = new Contract(id, CAMPAIGN_ABI, provider);

        const [title, description, image, goalBN, totalDonatedBN, creator, location, deadlineBN, social, donationsRaw] =
          await Promise.all([
            contract.title(), contract.description(), contract.image(),
            contract.goal(), contract.totalDonated(), contract.creator(),
            contract.location(), contract.deadline(), contract.social(),
            contract.getDonations(),
          ]);

        const deadline   = Number(deadlineBN);
        const now        = Math.floor(Date.now() / 1000);
        const isFinished = now > deadline || BigInt(totalDonatedBN) >= BigInt(goalBN);

        const donations: DonationRow[] = (donationsRaw as any[]).map((d) => ({
          donor: d.donor, amount: ethers.formatEther(d.amount),
        }));

        // Withdraw requests
        const reqs: WithdrawRow[] = [];
        for (let i = 0; i < 1000; i++) {
          try {
            const r = await contract.requests(i);
            reqs.push({ amount: ethers.formatEther(r.amount), reason: r.reason, timestamp: Number(r.timestamp), status: Number(r.status) });
          } catch { break; }
        }

        // Render halaman DULU sebelum scan logs
        setData({ title, description, image, goal: ethers.formatEther(goalBN), raised: ethers.formatEther(totalDonatedBN), creator, location, deadline, social, isFinished, donations });
        setWithdrawals(reqs);

        // Fetch refund state
        const refundable = await contract.isRefundable();
        setIsRefundable(refundable);

        if ((window as any).ethereum) {
          try {
            const bp     = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await bp.getSigner();
            const addr   = await signer.getAddress();
            setCurrentAccount(addr);
            setIsOwner(addr.toLowerCase() === String(creator).toLowerCase());

            if (refundable) {
              const [refundAmt, claimed] = await Promise.all([
                contract.refundAmountFor(addr),
                contract.refundClaimed(addr),
              ]);
              setRefundAmount(ethers.formatEther(refundAmt));
              setRefundClaimed(claimed);
            }
          } catch {}
        }

        setReady(true); // ← halaman tampil sekarang

        // Fetch metadata legitimasi jika social adalah IPFS URL
        if (social?.includes('gateway.pinata.cloud/ipfs/')) {
          fetch(social)
            .then(r => r.json())
            .then(json => { if (json?.version === '1') setMetadata(json); })
            .catch(() => {});
        }

        // Fetch komentar dari IPFS di background
        fetchComments(id).catch(() => {});

        // Scan logs di background (tidak blokir render)
        scanWithdrawLogs(id, reqs).then(({ execSet, denySet }) => {
          setExecutedIds(execSet);
          setDeniedIds(denySet);
        }).catch(() => {
          setExecutedIds(loadExecutedLS(id));
        });

      } catch (e) {
        console.error('❌ fetchData error:', e);
        setReady(true);
      }
    })();
  }, [id, provider]);

  // Scan dari ~200k block terakhir saja (bukan dari block 0)
  async function scanWithdrawLogs(campaignAddr: string, reqs: WithdrawRow[]) {
    const latest    = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - 200000);

    const topicExec  = ethers.id('WithdrawExecuted(uint256)');
    const topicDenied = ethers.id('WithdrawDenied(uint256)');

    const [logsExec, logsDenied] = await Promise.all([
      provider.getLogs({ address: campaignAddr, topics: [topicExec],  fromBlock, toBlock: latest }),
      provider.getLogs({ address: campaignAddr, topics: [topicDenied], fromBlock, toBlock: latest }),
    ]);

    const execSet  = new Set<number>(loadExecutedLS(campaignAddr));
    const denySet  = new Set<number>();

    const decode = (lg: any) => {
      try { const [n] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], lg.data); return Number(n); } catch { return null; }
    };

    for (const lg of logsExec)  { const n = decode(lg); if (n !== null) execSet.add(n); }
    for (const lg of logsDenied) { const n = decode(lg); if (n !== null) denySet.add(n); }

    // staticCall fallback untuk status=2 yang belum teridentifikasi
    const c = new Contract(campaignAddr, CAMPAIGN_ABI, provider);
    for (let i = 0; i < reqs.length; i++) {
      if (reqs[i].status !== 2 || execSet.has(i) || denySet.has(i)) continue;
      try {
        await (c as any).executeWithdraw.staticCall(i);
      } catch (e: any) {
        const msg = errText(e).toLowerCase();
        if (msg.includes('denied') || msg.includes('not approved')) denySet.add(i);
        else if (msg.includes('already executed') || msg.includes('executed')) execSet.add(i);
      }
    }

    return { execSet, denySet };
  }

  // ─── Countdown ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!data?.deadline) return;
    const intv = setInterval(() => {
      const diff = data.deadline * 1000 - Date.now();
      if (diff <= 0) { setTimeLeft('Campaign telah selesai'); clearInterval(intv); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff / 3600000) % 24);
      const m = Math.floor((diff / 60000) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimeLeft(`${d}h ${h}j ${m}m ${s}d`);
    }, 1000);
    return () => clearInterval(intv);
  }, [data?.deadline]);

  // ─── Actions ─────────────────────────────────────────────────────────────
  async function handleDonate(e: React.FormEvent) {
    e.preventDefault();
    if (!(window as any).ethereum) return alert('Wallet belum terhubung');
    setDonating(true);
    try {
      const bp       = new ethers.BrowserProvider((window as any).ethereum);
      const signer   = await bp.getSigner();
      const contract = new Contract(id, CAMPAIGN_ABI, signer);
      const tx       = await contract.donate({ value: ethers.parseEther(donationAmount) });
      await tx.wait();
      window.location.reload();
    } catch (err: any) {
      alert('Donasi gagal: ' + errText(err));
    } finally { setDonating(false); }
  }

  async function handleRequestWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!withdrawAmount || !withdrawReason.trim()) return alert('Isi jumlah & alasan dulu');
    if (!(window as any).ethereum) return alert('Wallet belum terhubung');
    setRequesting(true);
    try {
      const bp       = new ethers.BrowserProvider((window as any).ethereum);
      const signer   = await bp.getSigner();
      const contract = new Contract(id, CAMPAIGN_ABI, signer);
      const tx       = await contract.requestWithdraw(ethers.parseEther(withdrawAmount), withdrawReason.trim());
      await tx.wait();
      alert('Request withdraw terkirim!');
      window.location.reload();
    } catch (err: any) {
      alert('Gagal request withdraw: ' + errText(err));
    } finally { setRequesting(false); }
  }

  async function handleWithdraw() {
    const approvedIdxs = withdrawals.map((w, i) => w.status === 1 ? i : -1).filter(i => i >= 0);
    if (approvedIdxs.length === 0) return alert('Belum ada request yang disetujui admin');
    if (!(window as any).ethereum) return alert('Wallet belum terhubung');
    setWithdrawing(true);
    try {
      const bp       = new ethers.BrowserProvider((window as any).ethereum);
      const signer   = await bp.getSigner();
      const contract = new Contract(id, CAMPAIGN_ABI, signer);
      let chosen: bigint | null = null;
      for (const i of approvedIdxs) {
        try { await (contract as any).executeWithdraw.staticCall(BigInt(i)); chosen = BigInt(i); break; } catch {}
      }
      if (chosen === null) return alert('Tidak ada request yang bisa dieksekusi sekarang.');
      const tx = await (contract as any).executeWithdraw(chosen);
      await tx.wait();
      const executed = new Set(executedIds);
      executed.add(Number(chosen));
      setExecutedIds(executed);
      saveExecutedLS(id, executed);
      alert('Withdraw berhasil!');
      window.location.reload();
    } catch (err: any) {
      alert('Withdraw gagal: ' + errText(err));
    } finally { setWithdrawing(false); }
  }

  // ─── Status Label ────────────────────────────────────────────────────────
  function statusLabel(i: number, r: WithdrawRow) {
    if (r.status === 0) return { text: 'Pending',    cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' };
    if (r.status === 1) return { text: 'Approved',   cls: 'bg-green-500/20 text-green-300 border-green-500/30' };
    if (deniedIds.has(i)) return { text: 'Denied',   cls: 'bg-red-500/20 text-red-300 border-red-500/30' };
    return { text: 'Withdrawn', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
  }

  // ─── Claim Refund ────────────────────────────────────────────────────────
  async function handleClaimRefund() {
    if (!(window as any).ethereum) return alert('Wallet belum terhubung');
    setClaiming(true);
    try {
      const bp       = new ethers.BrowserProvider((window as any).ethereum);
      const signer   = await bp.getSigner();
      const contract = new Contract(id, CAMPAIGN_ABI, signer);
      const tx       = await (contract as any).claimRefund();
      await tx.wait();
      setRefundClaimed(true);
      setRefundAmount('0');
      alert('✅ Refund berhasil diklaim!');
    } catch (err: any) {
      alert('Gagal klaim refund: ' + errText(err));
    } finally {
      setClaiming(false);
    }
  }

  // ─── Comments ─────────────────────────────────────────────────────────────
  function buildSignMessage(campaignAddr: string, author: string, text: string, timestamp: number) {
    return `campaign:${campaignAddr.toLowerCase()}|author:${author.toLowerCase()}|text:${text}|timestamp:${timestamp}`;
  }

  async function fetchComments(campaignAddr: string) {
    setLoadingComments(true);
    try {
      const res = await fetch(
        `/api/pinata/comments?campaignAddress=${campaignAddr.toLowerCase()}`
      );
      const data = await res.json();
      const rows: any[] = data.rows || [];

      const fetched = await Promise.all(
        rows.map(async (pin: any) => {
          try {
            const r = await fetch(`https://gateway.pinata.cloud/ipfs/${pin.ipfs_pin_hash}`);
            const json = await r.json();
            const message = buildSignMessage(json.campaignAddress, json.author, json.text, json.timestamp);
            let verified = false;
            try {
              const recovered = ethers.verifyMessage(message, json.signature);
              verified = recovered.toLowerCase() === json.author.toLowerCase();
            } catch {}
            return { ...json, cid: pin.ipfs_pin_hash, verified } as Comment;
          } catch { return null; }
        })
      );

      setComments(
        (fetched.filter(Boolean) as Comment[]).sort((a, b) => b.timestamp - a.timestamp)
      );
    } catch (e) {
      console.error('Gagal fetch komentar:', e);
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (!(window as any).ethereum) return alert('Wallet belum terhubung');
    setSubmittingComment(true);
    try {
      const bp        = new ethers.BrowserProvider((window as any).ethereum);
      const signer    = await bp.getSigner();
      const author    = await signer.getAddress();
      const timestamp = Math.floor(Date.now() / 1000);
      const text      = commentText.trim();

      const message   = buildSignMessage(id, author, text, timestamp);
      const signature = await signer.signMessage(message);

      const comment = {
        campaignAddress: id.toLowerCase(),
        author,
        text,
        timestamp,
        signature,
      };

      const res = await fetch('/api/pinata/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment, campaignAddress: id.toLowerCase() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      setCommentText('');
      await fetchComments(id);
    } catch (err: any) {
      alert('Gagal kirim komentar: ' + errText(err));
    } finally {
      setSubmittingComment(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Memuat kampanye...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <p className="text-red-400">Kampanye tidak ditemukan.</p>
      </div>
    );
  }

  const raised       = Number(data.raised);
  const goal         = Number(data.goal);
  const pct          = Math.min(100, goal > 0 ? (raised / goal) * 100 : 0);
  const hasApproved  = withdrawals.some(w => w.status === 1);
  const withdrawnHistory = withdrawals
    .map((r, i) => ({ ...r, index: i }))
    .filter(r => executedIds.has(r.index) || (r.status === 2 && !deniedIds.has(r.index)));

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white" suppressHydrationWarning>

      {/* ── Hero Banner ── */}
      <div className="relative w-full h-72 md:h-96 overflow-hidden">
        {data.image && !imgError ? (
          <img
            src={data.image}
            alt={data.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center">
            <span className="text-6xl opacity-30">🌱</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e] via-[#0a0f1e]/40 to-transparent" />

        {data.isFinished && (
          <div className="absolute top-4 left-4">
            <span className="bg-red-500/90 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur">
              ⛔ Campaign Selesai
            </span>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="max-w-3xl mx-auto px-4 pb-16 -mt-8 relative z-10">

        {/* Card utama */}
        <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 shadow-2xl mb-6">
          <h1 className="text-2xl md:text-3xl font-bold mb-3 leading-tight">{data.title}</h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-5">{data.description}</p>

          <div className="flex flex-wrap gap-3 text-xs text-gray-400 mb-6">
            {data.location && (
              <span className="flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                📍 {data.location}
              </span>
            )}
            {data.deadline && (
              <span className="flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                ⏳ {timeLeft || '...'}
              </span>
            )}
            {(metadata?.social || (!metadata && data.social && !data.social.includes('gateway.pinata.cloud'))) && (
              <a
                href={metadata?.social || data.social} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 hover:border-indigo-500 transition"
              >
                🔗 Sosial Media
              </a>
            )}
          </div>

          {/* Progress */}
          <div className="mb-2 flex justify-between text-sm font-medium">
            <span className="text-white">{data.raised} ETH <span className="text-gray-500 font-normal">terkumpul</span></span>
            <span className="text-gray-400">Target: {data.goal} ETH</span>
          </div>
          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-1">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-right text-xs text-gray-500">{pct.toFixed(1)}%</p>

          <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-500">
            Penyelenggara:{' '}
            <a href={`/profile/${data.creator}`} className="text-indigo-400 hover:underline font-mono">
              {data.creator}
            </a>
            <a
              href={`${EXPLORER}/address/${data.creator}`}
              target="_blank" rel="noopener noreferrer"
              className="ml-2 text-gray-500 hover:text-indigo-400 transition"
              title="Lihat di Etherscan"
            >↗</a>
          </div>
        </div>

        {/* ── Donate Form ── */}
        {!data.isFinished && currentAccount && (
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">💸 Donasi Sekarang</h2>
            <form onSubmit={handleDonate} className="flex gap-3">
              <input
                type="number" step="any" min="0" value={donationAmount}
                onChange={e => setDonationAmount(e.target.value)}
                placeholder="Jumlah (ETH)"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 transition"
                required
              />
              <button
                type="submit" disabled={donating}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl transition disabled:opacity-50"
              >
                {donating ? '⏳' : 'Donasi'}
              </button>
            </form>
          </div>
        )}

        {/* ── Claim Refund ── */}
        {isRefundable && currentAccount && Number(refundAmount) > 0 && (
          <div className="bg-[#111827] border border-red-500/30 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-1 text-red-400">💸 Klaim Refund</h2>
            <p className="text-sm text-gray-400 mb-4">
              Kampanye ini {data.cancelled ? 'dibatalkan' : 'gagal mencapai target'}.
              Dana yang sudah ditarik creator ditanggung bersama secara proporsional.
            </p>
            <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 mb-2">
              <span className="text-gray-400 text-sm">Refund yang bisa diklaim</span>
              <span className="text-white font-semibold">{Number(refundAmount).toFixed(6)} ETH</span>
            </div>
            <p className="text-xs text-gray-500 mb-4 px-1">
              * Sudah dikurangi proporsi kerugian dari dana yang terlanjur ditarik creator.
            </p>
            {refundClaimed ? (
              <div className="text-center py-3 text-green-400 text-sm font-medium">
                ✅ Refund sudah diklaim
              </div>
            ) : (
              <button
                onClick={handleClaimRefund}
                disabled={claiming}
                className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-semibold rounded-xl transition disabled:opacity-50"
              >
                {claiming ? '⏳ Memproses...' : '↩ Klaim Refund'}
              </button>
            )}
          </div>
        )}

        {/* ── Riwayat Donasi ── */}
        <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">📋 Riwayat Donasi</h2>
          {data.donations?.length === 0 ? (
            <p className="text-gray-500 text-sm">Belum ada donasi.</p>
          ) : (
            <ul className="space-y-2">
              {data.donations?.map((d: DonationRow, i: number) => (
                <li key={i} className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-xl text-sm">
                  <a
                    href={`${EXPLORER}/address/${d.donor}`}
                    target="_blank" rel="noopener noreferrer"
                    className="font-mono text-gray-400 text-xs hover:text-indigo-400 transition"
                    title={d.donor}
                  >
                    {d.donor.slice(0, 8)}...{d.donor.slice(-6)} ↗
                  </a>
                  <span className="text-indigo-400 font-semibold">{d.amount} ETH</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Withdraw Section (Owner only) ── */}
        {isOwner && (
          <div className="bg-[#111827] border border-amber-500/20 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-amber-400">🏦 Manajemen Dana</h2>

            <form onSubmit={handleRequestWithdraw} className="space-y-3 mb-4">
              <input
                type="number" step="any" min="0" value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                placeholder="Jumlah withdraw (ETH)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500 transition"
              />
              <input
                type="text" value={withdrawReason}
                onChange={e => setWithdrawReason(e.target.value)}
                placeholder="Alasan penarikan dana"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500 transition"
              />
              <button
                type="submit" disabled={requesting}
                className="w-full py-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold rounded-xl transition disabled:opacity-50"
              >
                {requesting ? '⏳ Mengirim...' : '📝 Ajukan Request Withdraw'}
              </button>
            </form>

            {hasApproved && (
              <button
                onClick={handleWithdraw} disabled={withdrawing}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold rounded-xl transition disabled:opacity-50"
              >
                {withdrawing ? '⏳ Memproses...' : '💸 Eksekusi Withdraw (Approved)'}
              </button>
            )}
          </div>
        )}

        {/* ── Withdraw Requests ── */}
        {withdrawals.length > 0 && (
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">📤 Permintaan Penarikan</h2>
            <ul className="space-y-3">
              {withdrawals.map((r, i) => {
                const s = statusLabel(i, r);
                return (
                  <li key={i} className="bg-white/5 rounded-xl p-4 text-sm space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-semibold text-white">{r.amount} ETH</span>
                        <span className="text-gray-400 ml-2 italic">— {r.reason}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full border ${s.cls}`}>{s.text}</span>
                    </div>
                    <p className="text-xs text-gray-500">🕒 {new Date(r.timestamp * 1000).toLocaleString()}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ── Withdraw History ── */}
        {withdrawnHistory.length > 0 && (
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">📚 Riwayat Withdraw</h2>
            <ul className="space-y-3">
              {withdrawnHistory.map(r => (
                <li key={`wd-${r.index}`} className="bg-white/5 rounded-xl p-4 text-sm">
                  <div className="font-semibold text-white">Withdrawn — <span className="italic text-gray-400">{r.reason}</span></div>
                  <div className="text-xs text-gray-500 mt-1">#{r.index} · {new Date(r.timestamp * 1000).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Komentar ── */}
        <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">💬 Komentar</h2>

          {/* Form kirim komentar */}
          {currentAccount ? (
            <form onSubmit={handleSubmitComment} className="flex gap-3 mb-6">
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Tulis komentar..."
                maxLength={500}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 transition text-sm"
                required
              />
              <button
                type="submit"
                disabled={submittingComment}
                className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl transition disabled:opacity-50 text-sm whitespace-nowrap"
              >
                {submittingComment ? '⏳' : 'Kirim'}
              </button>
            </form>
          ) : (
            <p className="text-gray-500 text-sm mb-6">Hubungkan wallet untuk berkomentar.</p>
          )}

          {/* Daftar komentar */}
          {loadingComments ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Memuat komentar...
            </div>
          ) : comments.length === 0 ? (
            <p className="text-gray-500 text-sm">Belum ada komentar.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map(c => (
                <li key={c.cid} className="bg-white/5 rounded-xl px-4 py-3 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={`/profile/${c.author}`}
                      className="font-mono text-xs text-indigo-400 hover:underline"
                    >
                      {c.author.slice(0, 8)}...{c.author.slice(-6)}
                    </a>
                    {c.verified ? (
                      <span className="text-xs text-green-400 border border-green-500/30 bg-green-500/10 px-2 py-0.5 rounded-full">
                        ✓ Terverifikasi
                      </span>
                    ) : (
                      <span className="text-xs text-red-400 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded-full">
                        ✗ Tidak valid
                      </span>
                    )}
                    <span className="text-xs text-gray-600 ml-auto">
                      {new Date(c.timestamp * 1000).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-300 leading-relaxed">{c.text}</p>
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${c.cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-600 hover:text-indigo-400 transition font-mono"
                  >
                    IPFS: {c.cid.slice(0, 16)}... ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <a
          href={`${EXPLORER}/address/${id}`}
          target="_blank" rel="noopener noreferrer"
          className="block text-center text-xs text-gray-600 hover:text-indigo-400 mt-8 font-mono break-all transition"
          title="Lihat contract di Etherscan"
        >
          Contract: {id} ↗
        </a>
      </div>
    </div>
  );
}
