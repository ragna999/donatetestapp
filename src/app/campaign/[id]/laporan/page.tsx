'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ethers, Contract } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import Link from 'next/link';
import { RPC } from '../../../lib/config';

const EXPLORER = 'https://sepolia.etherscan.io';

const CAMPAIGN_ABI = [
  { name: 'title',   type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'creator', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    name: 'requests', type: 'function', stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'amount',    type: 'uint256' },
      { name: 'reason',    type: 'string'  },
      { name: 'timestamp', type: 'uint256' },
      { name: 'status',    type: 'uint8'   },
    ],
  },
  { type: 'event', name: 'WithdrawExecuted', inputs: [{ name: 'id', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'WithdrawDenied',   inputs: [{ name: 'id', type: 'uint256', indexed: false }] },
] as const;

type WithdrawRow = { amount: string; reason: string; timestamp: number; status: number };
type Report = {
  cid: string; withdrawIndex: number; title: string; description: string;
  amountUsed: string; photoUrl: string; timestamp: number; creator: string; verified: boolean;
};
type DraftEntry = { title: string; description: string; amountUsed: string; photoUrl: string; photoUploading: boolean };

function errText(err: any): string {
  const nested = err?.info?.error?.message || err?.data?.message || err?.cause?.message || err?.shortMessage || err?.reason || err?.message;
  return nested || String(err || 'Unknown error');
}

export default function LaporanPage() {
  const params = useParams();
  const id     = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const provider = useMemo(() => new ethers.JsonRpcProvider(RPC), []);
  const { user, authenticated } = usePrivy();
  const { wallets } = useWallets();

  async function getEthProvider() {
    const wallet = wallets.find(w => w.walletClientType === 'privy') || wallets[0];
    if (!wallet) throw new Error('Wallet belum terhubung');
    await wallet.switchChain(11155111);
    const eip1193 = await wallet.getEthereumProvider();
    return new ethers.BrowserProvider(eip1193);
  }

  const [campaignTitle,    setCampaignTitle]    = useState('');
  const [creator,          setCreator]          = useState('');
  const [withdrawals,      setWithdrawals]      = useState<WithdrawRow[]>([]);
  const [executedIds,      setExecutedIds]      = useState<Set<number>>(new Set());
  const [deniedIds,        setDeniedIds]        = useState<Set<number>>(new Set());
  const [executedTxHashes, setExecutedTxHashes] = useState<Record<number, string>>({});
  const [ready,            setReady]            = useState(false);
  const [isOwner,          setIsOwner]          = useState(false);

  const [reports,          setReports]          = useState<Record<number, Report>>({});
  const [reportForms,      setReportForms]      = useState<Record<number, boolean>>({});
  const [reportDraft,      setReportDraft]      = useState<Record<number, DraftEntry>>({});
  const [submittingReport, setSubmittingReport] = useState<Record<number, boolean>>({});

  // ── Fetch contract data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !ethers.isAddress(id)) { setReady(true); return; }

    (async () => {
      try {
        const contract = new Contract(id, CAMPAIGN_ABI, provider);
        const [titleVal, creatorVal] = await Promise.all([contract.title(), contract.creator()]);
        setCampaignTitle(titleVal);
        setCreator(creatorVal);

        const reqs: WithdrawRow[] = [];
        for (let i = 0; i < 1000; i++) {
          try {
            const r = await contract.requests(i);
            reqs.push({ amount: ethers.formatEther(r.amount), reason: r.reason, timestamp: Number(r.timestamp), status: Number(r.status) });
          } catch { break; }
        }
        setWithdrawals(reqs);
        setReady(true);

        // Fetch laporan di background
        fetchReports(id).catch(() => {});

        // Scan logs untuk txhash & status
        const latest    = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latest - 200000);
        const topicExec   = ethers.id('WithdrawExecuted(uint256)');
        const topicDenied = ethers.id('WithdrawDenied(uint256)');
        const [logsExec, logsDenied] = await Promise.all([
          provider.getLogs({ address: id, topics: [topicExec],   fromBlock, toBlock: latest }),
          provider.getLogs({ address: id, topics: [topicDenied], fromBlock, toBlock: latest }),
        ]);

        const execSet = new Set<number>();
        const denySet = new Set<number>();
        const txMap: Record<number, string> = {};

        const decode = (lg: any) => {
          try { const [n] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], lg.data); return Number(n); } catch { return null; }
        };

        for (const lg of logsExec)   { const n = decode(lg); if (n !== null) { execSet.add(n); txMap[n] = lg.transactionHash; } }
        for (const lg of logsDenied) { const n = decode(lg); if (n !== null) denySet.add(n); }

        // Fallback: status === 2 belum terdeteksi di logs
        for (let i = 0; i < reqs.length; i++) {
          if (reqs[i].status === 2 && !execSet.has(i) && !denySet.has(i)) execSet.add(i);
        }

        setExecutedIds(execSet);
        setDeniedIds(denySet);
        setExecutedTxHashes(txMap);
      } catch (e) {
        console.error('❌ laporan fetchData error:', e);
        setReady(true);
      }
    })();
  }, [id, provider]);

  // ── isOwner ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const addr = user?.wallet?.address ?? '';
    if (addr && creator) {
      setIsOwner(addr.toLowerCase() === creator.toLowerCase());
    } else {
      setIsOwner(false);
    }
  }, [authenticated, user?.wallet?.address, creator]);

  // ── Fetch reports ──────────────────────────────────────────────────────────
  async function fetchReports(campaignAddr: string) {
    try {
      const res  = await fetch(`/api/pinata/reports?campaignAddress=${campaignAddr.toLowerCase()}`);
      const data = await res.json();
      const rows: any[] = data.rows ?? [];
      const map: Record<number, Report> = {};
      await Promise.all(rows.map(async (pin: any) => {
        try {
          const r    = await fetch(`https://gateway.pinata.cloud/ipfs/${pin.ipfs_pin_hash}`);
          const json = await r.json();
          const message = `report:${json.campaignAddress}|withdrawIndex:${json.withdrawIndex}|title:${json.title}|timestamp:${json.timestamp}`;
          let verified = false;
          try {
            const recovered = ethers.verifyMessage(message, json.signature);
            verified = recovered.toLowerCase() === json.creator.toLowerCase();
          } catch {}
          map[json.withdrawIndex] = { ...json, cid: pin.ipfs_pin_hash, verified };
        } catch {}
      }));
      setReports(map);
    } catch (e) {
      console.error('Gagal fetch laporan:', e);
    }
  }

  // ── Submit report ──────────────────────────────────────────────────────────
  async function handleSubmitReport(withdrawIndex: number) {
    const draft = reportDraft[withdrawIndex];
    if (!draft?.title.trim() || !draft?.description.trim() || !draft?.photoUrl) {
      return alert('Lengkapi judul, deskripsi, dan foto bukti.');
    }
    setSubmittingReport(prev => ({ ...prev, [withdrawIndex]: true }));
    try {
      const bp        = await getEthProvider();
      const signer    = await bp.getSigner();
      const creatorAddr = await signer.getAddress();
      const timestamp = Math.floor(Date.now() / 1000);
      const message   = `report:${id.toLowerCase()}|withdrawIndex:${withdrawIndex}|title:${draft.title.trim()}|timestamp:${timestamp}`;
      const signature = await signer.signMessage(message);

      const report = {
        campaignAddress: id.toLowerCase(),
        withdrawIndex,
        title:       draft.title.trim(),
        description: draft.description.trim(),
        amountUsed:  draft.amountUsed.trim(),
        photoUrl:    draft.photoUrl,
        timestamp,
        creator:     creatorAddr,
        signature,
      };

      const res = await fetch('/api/pinata/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, campaignAddress: id.toLowerCase(), withdrawIndex }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${res.status}`);
      }

      setReportForms(prev => ({ ...prev, [withdrawIndex]: false }));
      await fetchReports(id);
    } catch (err: any) {
      alert('Gagal kirim laporan: ' + errText(err));
    } finally {
      setSubmittingReport(prev => ({ ...prev, [withdrawIndex]: false }));
    }
  }

  const withdrawnHistory = withdrawals
    .map((r, i) => ({ ...r, index: i }))
    .filter(r => executedIds.has(r.index) || (r.status === 2 && !deniedIds.has(r.index)));

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Memuat laporan...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-8">
          <Link href={`/campaign/${id}`} className="text-gray-500 hover:text-gray-300 text-sm transition inline-block mb-4">
            ← Kembali ke Campaign
          </Link>
          <h1 className="text-2xl font-bold">📊 Laporan Penggunaan Dana</h1>
          {campaignTitle && (
            <p className="text-gray-400 text-sm mt-1">{campaignTitle}</p>
          )}
        </div>

        {/* Content */}
        {withdrawnHistory.length === 0 ? (
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-400 font-medium">Belum ada dana yang ditarik</p>
            <p className="text-gray-600 text-sm mt-1">Laporan akan muncul setelah creator mengeksekusi penarikan dana.</p>
          </div>
        ) : (
          <ul className="space-y-5">
            {withdrawnHistory.map(r => {
              const report     = reports[r.index];
              const formOpen   = reportForms[r.index] ?? false;
              const draft      = reportDraft[r.index] ?? { title: '', description: '', amountUsed: r.amount, photoUrl: '', photoUploading: false };
              const submitting = submittingReport[r.index] ?? false;
              const txHash     = executedTxHashes[r.index];

              return (
                <li key={`wd-${r.index}`} className="border border-white/10 rounded-2xl overflow-hidden bg-[#111827]">

                  {/* Header withdraw */}
                  <div className="bg-white/5 px-5 py-4">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="font-semibold text-white">{r.amount} ETH</span>
                        <span className="text-gray-400 ml-2 italic text-sm">"{r.reason}"</span>
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">
                        {new Date(r.timestamp * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    {txHash ? (
                      <a
                        href={`${EXPLORER}/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 font-mono transition"
                      >
                        ✅ Verifikasi transaksi ↗
                      </a>
                    ) : (
                      <a
                        href={`${EXPLORER}/address/${id}#internaltx`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-400 font-mono transition"
                      >
                        🔍 Lihat riwayat kontrak di Etherscan ↗
                      </a>
                    )}
                  </div>

                  {/* Laporan */}
                  <div className="p-5">
                    {report ? (
                      /* ── Laporan ada ── */
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full">
                            {report.verified ? '✓ Terverifikasi' : 'Laporan'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(report.timestamp * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-white font-medium text-sm">{report.title}</p>
                        {report.amountUsed && (
                          <p className="text-xs text-gray-400">
                            Dana digunakan: <span className="text-white font-medium">{report.amountUsed} ETH</span>
                          </p>
                        )}
                        <p className="text-gray-300 text-sm leading-relaxed">{report.description}</p>
                        {report.photoUrl && (
                          <a href={report.photoUrl} target="_blank" rel="noopener noreferrer">
                            <img
                              src={report.photoUrl}
                              alt="Bukti penggunaan dana"
                              className="w-full max-h-72 object-cover rounded-xl border border-white/10 hover:opacity-90 transition mt-1"
                            />
                          </a>
                        )}
                      </div>

                    ) : isOwner && !formOpen ? (
                      /* ── Owner, belum ada laporan ── */
                      <button
                        onClick={() => setReportForms(prev => ({ ...prev, [r.index]: true }))}
                        className="w-full py-3 border border-dashed border-white/20 hover:border-indigo-500/50 text-gray-400 hover:text-indigo-300 text-sm rounded-xl transition"
                      >
                        + Tambah Laporan Penggunaan Dana
                      </button>

                    ) : isOwner && formOpen ? (
                      /* ── Owner, form terbuka ── */
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Judul laporan"
                          value={draft.title}
                          onChange={e => setReportDraft(prev => ({ ...prev, [r.index]: { ...draft, title: e.target.value } }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 text-sm"
                        />
                        <textarea
                          placeholder="Deskripsi penggunaan dana"
                          rows={3}
                          value={draft.description}
                          onChange={e => setReportDraft(prev => ({ ...prev, [r.index]: { ...draft, description: e.target.value } }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 text-sm resize-none"
                        />
                        <input
                          type="number"
                          step="any"
                          placeholder={`Jumlah ETH yang dipakai (maks ${r.amount} ETH)`}
                          value={draft.amountUsed}
                          onChange={e => setReportDraft(prev => ({ ...prev, [r.index]: { ...draft, amountUsed: e.target.value } }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 text-sm"
                        />
                        <div>
                          <label className="block text-xs text-gray-400 mb-1.5">
                            Foto bukti <span className="text-red-400">*</span>
                          </label>
                          {draft.photoUrl ? (
                            <div className="relative">
                              <img src={draft.photoUrl} alt="Preview" className="w-full max-h-48 object-cover rounded-lg border border-white/10" />
                              <button
                                type="button"
                                onClick={() => setReportDraft(prev => ({ ...prev, [r.index]: { ...draft, photoUrl: '' } }))}
                                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white text-xs px-2 py-1 rounded-lg"
                              >
                                Ganti
                              </button>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="file"
                                accept="image/*"
                                disabled={draft.photoUploading}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setReportDraft(prev => ({ ...prev, [r.index]: { ...draft, photoUploading: true } }));
                                  try {
                                    const fd  = new FormData();
                                    fd.append('file', file);
                                    const res  = await fetch('/api/pinata/upload', { method: 'POST', body: fd });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error);
                                    setReportDraft(prev => ({ ...prev, [r.index]: { ...draft, photoUrl: data.url, photoUploading: false } }));
                                  } catch {
                                    alert('Upload foto gagal');
                                    setReportDraft(prev => ({ ...prev, [r.index]: { ...draft, photoUploading: false } }));
                                  }
                                }}
                                className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white/10 file:text-gray-300 hover:file:bg-white/20"
                              />
                              {draft.photoUploading && <p className="text-xs text-blue-400 mt-1">Mengupload foto...</p>}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSubmitReport(r.index)}
                            disabled={submitting || draft.photoUploading}
                            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition"
                          >
                            {submitting ? '⏳ Mengirim...' : 'Kirim Laporan'}
                          </button>
                          <button
                            onClick={() => setReportForms(prev => ({ ...prev, [r.index]: false }))}
                            className="px-4 py-2.5 border border-white/10 hover:border-white/30 text-gray-400 hover:text-white text-sm rounded-xl transition"
                          >
                            Batal
                          </button>
                        </div>
                      </div>

                    ) : (
                      /* ── Bukan owner, belum ada laporan ── */
                      <p className="text-xs text-gray-500 italic">Belum ada laporan dari penyelenggara.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Footer link kembali */}
        <div className="mt-10 text-center">
          <Link
            href={`/campaign/${id}`}
            className="text-sm text-gray-500 hover:text-gray-300 transition"
          >
            ← Kembali ke halaman campaign
          </Link>
        </div>
      </div>
    </main>
  );
}
