'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ethers, Contract, ContractTransactionResponse } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { RPC, FACTORY_ADDRESS } from '../lib/config';
import TxSuccessModal from '../components/TxSuccessModal';
import { useToast } from '../components/Toast';
import { waitForTxWithTimeout } from '../utils/withTimeout';

const FACTORY_ABI = [
  { name: 'getAllCampaigns', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  { name: 'isApproved',      type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'deniedCampaigns', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'approveCampaign', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { name: 'denyCampaign',    type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
] as const;

const CAMPAIGN_ABI = [
  { name: 'title',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'image',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'social',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'creator',       type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'goal',          type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDonated',  type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'deadline',      type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'cancelled',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'isRefundable',  type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'getDonorCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'refundAll',     type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'cancelCampaign',type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    name: 'requests', type: 'function', stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [
      { name: 'amount', type: 'uint256' }, { name: 'reason', type: 'string' },
      { name: 'timestamp', type: 'uint256' }, { name: 'status', type: 'uint8' },
    ],
  },
  { name: 'approveWithdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
  { name: 'denyWithdraw',    type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
] as const;

type Tab = 'campaigns' | 'withdraws' | 'refunds' | 'active' | 'history';

type PendingCampaign  = { address: string; title: string; image: string; creator: string; metadataUrl?: string };
type PendingRequest   = { index: number; amount: string; reason: string; timestamp: number; campaign: string; title: string; creator: string };
type RefundableCampaign = { address: string; title: string; image: string; creator: string; balance: string; donorCount: number; cancelled: boolean; isRefundable: boolean; deadline: number; raised: string; goal: string };
type ActiveCampaign  = { address: string; title: string; image: string; creator: string; raised: string; goal: string; deadline: number; balance: string; donorCount: number };
type HistoryStatus = 'success' | 'expired' | 'cancelled' | 'denied';
type HistoryCampaign = { address: string; title: string; image: string; creator: string; raised: string; goal: string; deadline: number; status: HistoryStatus };

export default function AdminPage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('campaigns');

  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [pendingCampaigns, setPendingCampaigns] = useState<PendingCampaign[]>([]);

  const [loadingReq,      setLoadingReq]      = useState(true);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  const [loadingRefunds,       setLoadingRefunds]       = useState(true);
  const [refundableCampaigns,  setRefundableCampaigns]  = useState<RefundableCampaign[]>([]);

  const [loadingActive,   setLoadingActive]   = useState(true);
  const [activeCampaigns, setActiveCampaigns] = useState<ActiveCampaign[]>([]);

  const [loadingHistory,   setLoadingHistory]   = useState(true);
  const [historyCampaigns, setHistoryCampaigns] = useState<HistoryCampaign[]>([]);

  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [txResult, setTxResult] = useState<{ hash: string; label: string } | null>(null);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const rpcProvider = useMemo(() => new ethers.JsonRpcProvider(RPC), []);

  // ─── Helpers ──────────────────────────────────────────────────────────────
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

  async function getSigner() {
    const wallet = wallets.find(w => w.walletClientType === 'privy') || wallets[0];
    if (!wallet) throw new Error('Wallet tidak ditemukan');
    await wallet.switchChain(11155111);
    const eip1193 = await wallet.getEthereumProvider();
    return new ethers.BrowserProvider(eip1193).getSigner(wallet.address);
  }

  async function safeTx(p: Promise<ContractTransactionResponse>): Promise<string> {
    const tx = await p;
    const receipt = await waitForTxWithTimeout(tx.wait(), 60_000, 'Admin Transaksi');
    return receipt?.hash ?? tx.hash;
  }

  // ─── Loaders ──────────────────────────────────────────────────────────────
  const fetchPendingCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, rpcProvider);
      const all: string[] = await factory.getAllCampaigns();
      const rows = await Promise.all(all.map(async (addr): Promise<PendingCampaign | null> => {
        try {
          const code = await rpcProvider.getCode(addr);
          if (code === '0x') return null;
          const [approved, denied] = await Promise.all([factory.isApproved(addr), factory.deniedCampaigns(addr)]);
          if (approved || denied) return null;
          const c = new Contract(addr, CAMPAIGN_ABI, rpcProvider);
          const [title, image, creator, social] = await Promise.all([c.title(), c.image(), c.creator(), c.social()]);
          const metadataUrl = social?.includes('gateway.pinata.cloud/ipfs/') ? social : undefined;
          return { address: addr, title, image, creator, metadataUrl };
        } catch { return null; }
      }));
      setPendingCampaigns(rows.filter(Boolean) as PendingCampaign[]);
    } catch (e) { console.error(e); }
    finally { setLoadingCampaigns(false); }
  };

  const fetchPendingWithdraws = async () => {
    setLoadingReq(true);
    try {
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, rpcProvider);
      const all: string[] = await factory.getAllCampaigns();
      const rows: PendingRequest[] = [];
      for (const addr of all) {
        try {
          const code = await rpcProvider.getCode(addr);
          if (code === '0x') continue;
          const c = new Contract(addr, CAMPAIGN_ABI, rpcProvider);
          const [title, creator] = await Promise.all([c.title(), c.creator()]);
          for (let i = 0; i < 1000; i++) {
            try {
              const r = await c.requests(i);
              if (Number(r.status) === 0) rows.push({ index: i, amount: ethers.formatEther(r.amount), reason: r.reason, timestamp: Number(r.timestamp), campaign: addr, title, creator });
            } catch { break; }
          }
        } catch {}
      }
      rows.sort((a, b) => b.timestamp - a.timestamp);
      setPendingRequests(rows);
    } catch (e) { console.error(e); }
    finally { setLoadingReq(false); }
  };

  const fetchRefundableCampaigns = async () => {
    setLoadingRefunds(true);
    try {
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, rpcProvider);
      const all: string[] = await factory.getAllCampaigns();
      const rows = await Promise.all(all.map(async (addr): Promise<RefundableCampaign | null> => {
        try {
          const code = await rpcProvider.getCode(addr);
          if (code === '0x') return null;
          const c = new Contract(addr, CAMPAIGN_ABI, rpcProvider);
          const [title, image, creator, goalBN, raisedBN, deadlineBN, isCancelled, refundable, donorCountBN] = await Promise.all([
            c.title(), c.image(), c.creator(), c.goal(), c.totalDonated(), c.deadline(), c.cancelled(), c.isRefundable(), c.getDonorCount(),
          ]);
          const balanceBN = await rpcProvider.getBalance(addr);
          if (!refundable) return null;                     // bukan mode refund → tidak perlu di sini
          if (balanceBN === 0n) return null;                // dana sudah kosong → tampil di Riwayat saja
          return {
            address: addr, title, image, creator, balance: ethers.formatEther(balanceBN),
            donorCount: Number(donorCountBN), cancelled: isCancelled, isRefundable: refundable,
            deadline: Number(deadlineBN), raised: ethers.formatEther(raisedBN), goal: ethers.formatEther(goalBN),
          };
        } catch { return null; }
      }));
      setRefundableCampaigns(rows.filter(Boolean) as RefundableCampaign[]);
    } catch (e) { console.error(e); }
    finally { setLoadingRefunds(false); }
  };

  const fetchActiveCampaigns = async () => {
    setLoadingActive(true);
    try {
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, rpcProvider);
      const all: string[] = await factory.getAllCampaigns();
      const now = Math.floor(Date.now() / 1000);
      const rows = await Promise.all(all.map(async (addr): Promise<ActiveCampaign | null> => {
        try {
          const code = await rpcProvider.getCode(addr);
          if (code === '0x') return null;
          const [approved, denied] = await Promise.all([factory.isApproved(addr), factory.deniedCampaigns(addr)]);
          if (!approved || denied) return null;
          const c = new Contract(addr, CAMPAIGN_ABI, rpcProvider);
          const [title, image, creator, goalBN, raisedBN, deadlineBN, isCancelled, donorCountBN] = await Promise.all([
            c.title(), c.image(), c.creator(), c.goal(), c.totalDonated(), c.deadline(), c.cancelled(), c.getDonorCount(),
          ]);
          if (isCancelled) return null;
          const balanceBN = await rpcProvider.getBalance(addr);
          const goalMet = raisedBN >= goalBN;
          // Tetap tampilkan di Aktif jika: deadline belum habis, ATAU goal tercapai tapi masih ada sisa dana
          if (Number(deadlineBN) < now && !(goalMet && balanceBN > 0n)) return null;
          return {
            address: addr, title, image, creator,
            raised: ethers.formatEther(raisedBN), goal: ethers.formatEther(goalBN),
            deadline: Number(deadlineBN), balance: ethers.formatEther(balanceBN),
            donorCount: Number(donorCountBN),
          };
        } catch { return null; }
      }));
      rows.sort((a, b) => (a?.deadline ?? 0) - (b?.deadline ?? 0));
      setActiveCampaigns(rows.filter(Boolean) as ActiveCampaign[]);
    } catch (e) { console.error(e); }
    finally { setLoadingActive(false); }
  };

  const fetchHistoryCampaigns = async () => {
    setLoadingHistory(true);
    try {
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, rpcProvider);
      const all: string[] = await factory.getAllCampaigns();
      const now = Math.floor(Date.now() / 1000);
      const rows = await Promise.all(all.map(async (addr): Promise<HistoryCampaign | null> => {
        try {
          const code = await rpcProvider.getCode(addr);
          if (code === '0x') return null;
          const [approved, denied] = await Promise.all([factory.isApproved(addr), factory.deniedCampaigns(addr)]);

          if (denied) {
            const c = new Contract(addr, CAMPAIGN_ABI, rpcProvider);
            const [title, image, creator, goalBN, raisedBN, deadlineBN] = await Promise.all([
              c.title(), c.image(), c.creator(), c.goal(), c.totalDonated(), c.deadline(),
            ]);
            return { address: addr, title, image, creator, raised: ethers.formatEther(raisedBN), goal: ethers.formatEther(goalBN), deadline: Number(deadlineBN), status: 'denied' };
          }

          if (!approved) return null;

          const c = new Contract(addr, CAMPAIGN_ABI, rpcProvider);
          const [title, image, creator, goalBN, raisedBN, deadlineBN, isCancelled] = await Promise.all([
            c.title(), c.image(), c.creator(), c.goal(), c.totalDonated(), c.deadline(), c.cancelled(),
          ]);
          const balanceBN = await rpcProvider.getBalance(addr);
          if (balanceBN !== 0n) return null;

          const deadline = Number(deadlineBN);
          const raised = ethers.formatEther(raisedBN);
          const goal = ethers.formatEther(goalBN);

          if (isCancelled) return { address: addr, title, image, creator, raised, goal, deadline, status: 'cancelled' };

          const goalMet = raisedBN >= goalBN;
          const expired = deadline < now;
          if (goalMet || expired) {
            return { address: addr, title, image, creator, raised, goal, deadline, status: goalMet ? 'success' : 'expired' };
          }
          return null;
        } catch { return null; }
      }));
      setHistoryCampaigns(rows.filter(Boolean) as HistoryCampaign[]);
    } catch (e) { console.error(e); }
    finally { setLoadingHistory(false); }
  };

  useEffect(() => {
    if (!authenticated) return;
    fetchPendingCampaigns();
    fetchPendingWithdraws();
    fetchRefundableCampaigns();
    fetchActiveCampaigns();
    fetchHistoryCampaigns();
  }, [authenticated]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  async function setWithdrawStatusTx(campaignAddr: string, index: number, approve: boolean): Promise<string> {
    const signer = await getSigner();
    const c = new Contract(campaignAddr, [
      { name: 'approveWithdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
      { name: 'denyWithdraw',    type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
    ] as const, signer);
    const idx = BigInt(index);
    try {
      if (approve) await (c as any).approveWithdraw.staticCall(idx);
      else         await (c as any).denyWithdraw.staticCall(idx);
    } catch (e) {
      try {
        const iface = new ethers.Interface(['function approveWithdraw(uint256)', 'function denyWithdraw(uint256)']);
        const data  = approve ? iface.encodeFunctionData('approveWithdraw', [idx]) : iface.encodeFunctionData('denyWithdraw', [idx]);
        await (signer.provider as ethers.Provider).call({ to: campaignAddr, data });
      } catch (raw) { throw new Error(errText(raw)); }
    }
    try {
      const tx = approve ? await (c as any).approveWithdraw(idx) : await (c as any).denyWithdraw(idx);
      const receipt = await tx.wait();
      return receipt?.hash ?? tx.hash;
    } catch (e) { throw new Error(errText(e)); }
  }

  const handleApproveCampaign = async (address: string) => {
    setProcessingAction(`approve-${address}`);
    try { const s = await getSigner(); const f = new Contract(FACTORY_ADDRESS, FACTORY_ABI, s); const hash = await safeTx(f.approveCampaign(address)); setTxResult({ hash, label: 'Campaign disetujui!' }); await fetchPendingCampaigns(); }
    catch (e: any) { toast.error(errText(e)); }
    finally { setProcessingAction(null); }
  };
  const handleDenyCampaign = async (address: string) => {
    setProcessingAction(`deny-${address}`);
    try { const s = await getSigner(); const f = new Contract(FACTORY_ADDRESS, FACTORY_ABI, s); const hash = await safeTx(f.denyCampaign(address)); setTxResult({ hash, label: 'Campaign ditolak.' }); await fetchPendingCampaigns(); }
    catch (e: any) { toast.error(errText(e)); }
    finally { setProcessingAction(null); }
  };
  const handleApproveWithdraw = async (addr: string, idx: number) => {
    setProcessingAction(`approve-wd-${addr}-${idx}`);
    try { const hash = await setWithdrawStatusTx(addr, idx, true); setTxResult({ hash, label: 'Withdraw disetujui!' }); await fetchPendingWithdraws(); }
    catch (e: any) { toast.error(errText(e)); }
    finally { setProcessingAction(null); }
  };
  const handleDenyWithdraw = async (addr: string, idx: number) => {
    setProcessingAction(`deny-wd-${addr}-${idx}`);
    try { const hash = await setWithdrawStatusTx(addr, idx, false); setTxResult({ hash, label: 'Withdraw ditolak.' }); await fetchPendingWithdraws(); }
    catch (e: any) { toast.error(errText(e)); }
    finally { setProcessingAction(null); }
  };
  const handleCancelCampaign = async (addr: string) => {
    if (!confirm('Batalkan kampanye ini? Donor akan bisa klaim refund.')) return;
    setProcessingAction(`cancel-${addr}`);
    try {
      const s = await getSigner(); const c = new Contract(addr, CAMPAIGN_ABI, s);
      const receipt = await waitForTxWithTimeout(
        (c as any).cancelCampaign().then(async (tx: any) => tx.wait()),
        60_000, 'Batalkan Kampanye'
      );
      setTxResult({ hash: receipt?.hash, label: 'Kampanye dibatalkan.' });
      await Promise.all([fetchActiveCampaigns(), fetchRefundableCampaigns(), fetchHistoryCampaigns()]);
    }
    catch (e: any) { toast.error(errText(e)); }
    finally { setProcessingAction(null); }
  };
  const handleRefundAll = async (addr: string, donorCount: number) => {
    if (!confirm(`Refund ke ${donorCount} donor sekaligus?`)) return;
    setProcessingAction(`refund-${addr}`);
    try {
      const s = await getSigner(); const c = new Contract(addr, CAMPAIGN_ABI, s);
      const receipt = await waitForTxWithTimeout(
        (c as any).refundAll().then(async (tx: any) => tx.wait()),
        60_000, 'Refund All'
      );
      setTxResult({ hash: receipt?.hash, label: 'Refund berhasil!' });
      await fetchRefundableCampaigns();
    }
    catch (e: any) { toast.error(errText(e)); }
    finally { setProcessingAction(null); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (!ready) return (
    <div className="min-h-screen bg-[#060d1a] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!authenticated) return (
    <div className="min-h-screen bg-[#060d1a] flex items-center justify-center text-white text-center">
      <div>
        <p className="text-4xl mb-4">🔒</p>
        <p className="text-gray-400">Akses terbatas untuk admin</p>
      </div>
    </div>
  );

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'campaigns', label: 'Kampanye',  count: pendingCampaigns.length },
    { key: 'withdraws', label: 'Withdraw',  count: pendingRequests.length },
    { key: 'refunds',   label: 'Refund',    count: refundableCampaigns.length },
    { key: 'active',    label: 'Aktif',     count: activeCampaigns.length },
    { key: 'history',   label: 'Riwayat',   count: historyCampaigns.length },
  ];

  const Skeleton = () => (
    <div className="bg-[#0d1526] border border-white/10 rounded-2xl overflow-hidden animate-pulse">
      <div className="h-36 bg-white/5" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-white/5 rounded-full w-3/4" />
        <div className="h-3 bg-white/5 rounded-full w-1/2" />
        <div className="flex gap-2 pt-1">
          <div className="flex-1 h-8 bg-white/5 rounded-lg" />
          <div className="flex-1 h-8 bg-white/5 rounded-lg" />
        </div>
      </div>
    </div>
  );

  return (
    <>
    {txResult && (
      <TxSuccessModal
        hash={txResult.hash}
        label={txResult.label}
        onClose={() => setTxResult(null)}
      />
    )}
    <div className="min-h-screen bg-[#060d1a] text-white">

      {/* Header */}
      <div className="bg-gradient-to-b from-[#0d1526] to-transparent border-b border-white/10 px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-base shadow-lg shadow-emerald-500/20">
              🛠️
            </div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <p className="text-gray-500 text-sm ml-12">Kelola kampanye, withdraw, dan refund</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 border border-white/10 p-1 rounded-2xl mb-8 w-fit">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-white/10'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Kampanye Pending ── */}
        {tab === 'campaigns' && (
          <div>
            <h2 className="text-base font-semibold text-gray-300 mb-5">Menunggu Persetujuan</h2>
            {loadingCampaigns ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(3)].map((_, i) => <Skeleton key={i} />)}
              </div>
            ) : pendingCampaigns.length === 0 ? (
              <EmptyState icon="✅" message="Tidak ada kampanye yang menunggu approval" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {pendingCampaigns.map(c => (
                  <CampaignCard key={c.address} title={c.title} image={c.image} creator={c.creator} address={c.address}
                    metadataUrl={c.metadataUrl}
                    imgError={imgErrors[c.address]} onImgError={() => setImgErrors(p => ({ ...p, [c.address]: true }))}
                    actions={[
                      { label: '✅ Approve', onClick: () => handleApproveCampaign(c.address), color: 'green', disabled: processingAction === `approve-${c.address}`, loadingLabel: 'Approving...' },
                      { label: '❌ Deny',    onClick: () => handleDenyCampaign(c.address),    color: 'red',   disabled: processingAction === `deny-${c.address}`, loadingLabel: 'Denying...' },
                    ]}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Withdraw Requests ── */}
        {tab === 'withdraws' && (
          <div>
            <h2 className="text-base font-semibold text-gray-300 mb-5">Permintaan Penarikan Dana</h2>
            {loadingReq ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-[#0d1526] border border-white/10 rounded-2xl p-5 animate-pulse space-y-3">
                    <div className="h-3 bg-white/5 rounded-full w-2/3" />
                    <div className="h-4 bg-white/5 rounded-full w-1/2" />
                    <div className="flex gap-2 pt-2">
                      <div className="flex-1 h-9 bg-white/5 rounded-lg" />
                      <div className="flex-1 h-9 bg-white/5 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pendingRequests.length === 0 ? (
              <EmptyState icon="✅" message="Tidak ada request withdraw yang pending" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {pendingRequests.map((r, idx) => (
                  <div key={`${r.campaign}-${r.index}-${idx}`} className="bg-[#0d1526] border border-white/10 hover:border-amber-500/30 rounded-2xl p-5 transition-all">
                    <p className="text-xs text-gray-600 font-mono truncate mb-1">{r.campaign}</p>
                    <h3 className="font-semibold text-white mb-0.5 line-clamp-1">{r.title}</h3>
                    <p className="text-xs text-gray-500 font-mono truncate mb-4">👤 {r.creator}</p>

                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-amber-300 font-bold">💸 {r.amount} ETH</span>
                        <span className="text-xs text-gray-400">{new Date(r.timestamp * 1000).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1 italic">"{r.reason}"</p>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => handleApproveWithdraw(r.campaign, r.index)}
                        disabled={processingAction === `approve-wd-${r.campaign}-${r.index}`}
                        className="flex-1 py-2 bg-green-600/20 hover:bg-green-600 border border-green-600/30 hover:border-green-500 text-green-400 hover:text-white text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {processingAction === `approve-wd-${r.campaign}-${r.index}` ? (
                          <span className="flex items-center justify-center gap-1.5"><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />Approving...</span>
                        ) : '✅ Approve'}
                      </button>
                      <button onClick={() => handleDenyWithdraw(r.campaign, r.index)}
                        disabled={processingAction === `deny-wd-${r.campaign}-${r.index}`}
                        className="flex-1 py-2 bg-red-600/20 hover:bg-red-600 border border-red-600/30 hover:border-red-500 text-red-400 hover:text-white text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {processingAction === `deny-wd-${r.campaign}-${r.index}` ? (
                          <span className="flex items-center justify-center gap-1.5"><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />Denying...</span>
                        ) : '❌ Deny'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Refund ── */}
        {tab === 'refunds' && (
          <div>
            <h2 className="text-base font-semibold text-gray-300 mb-2">Manajemen Refund</h2>
            <p className="text-sm text-gray-500 mb-6">Kampanye yang perlu direfund: deadline lewat & goal tidak tercapai, atau dibatalkan admin.</p>

            {loadingRefunds ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(3)].map((_, i) => <Skeleton key={i} />)}
              </div>
            ) : refundableCampaigns.length === 0 ? (
              <EmptyState icon="✅" message="Tidak ada kampanye yang memerlukan refund" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {refundableCampaigns.map(c => {
                  const isExpired = Date.now() / 1000 > c.deadline && Number(c.raised) < Number(c.goal);
                  const canRefund = c.isRefundable && Number(c.balance) > 0;
                  const canCancel = !c.cancelled && !isExpired;
                  return (
                    <div key={c.address}
                      className={`bg-[#0d1526] border rounded-2xl overflow-hidden transition-all ${
                        c.cancelled ? 'border-red-500/30' : isExpired ? 'border-yellow-500/30' : 'border-white/10'
                      }`}
                    >
                      <div className="relative h-32 bg-gradient-to-br from-slate-800 to-slate-900">
                        {c.image && !imgErrors[c.address] ? (
                          <img src={c.image} alt={c.title} className="w-full h-full object-cover opacity-60"
                            onError={() => setImgErrors(p => ({ ...p, [c.address]: true }))} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl opacity-10">🌱</div>
                        )}
                        <div className="absolute top-2 right-2">
                          {c.cancelled
                            ? <span className="text-xs bg-red-500/80 text-white px-2 py-0.5 rounded-full">Dibatalkan</span>
                            : isExpired
                            ? <span className="text-xs bg-yellow-500/80 text-black px-2 py-0.5 rounded-full font-medium">Expired</span>
                            : null
                          }
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="font-semibold text-white text-sm line-clamp-1 mb-1">{c.title}</h3>
                        <p className="text-xs text-gray-600 font-mono truncate mb-4">👤 {c.creator}</p>

                        <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                          {[
                            { label: 'Terkumpul', value: `${c.raised} ETH`, highlight: false },
                            { label: 'Saldo',     value: `${Number(c.balance).toFixed(4)} ETH`, highlight: Number(c.balance) > 0 },
                            { label: 'Target',    value: `${c.goal} ETH`,   highlight: false },
                            { label: 'Donor',     value: `${c.donorCount} orang`, highlight: false },
                          ].map(item => (
                            <div key={item.label} className="bg-white/5 rounded-lg p-2">
                              <p className="text-gray-500">{item.label}</p>
                              <p className={`font-semibold mt-0.5 ${item.highlight ? 'text-green-400' : 'text-white'}`}>{item.value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2">
                          {canRefund && (
                            <button onClick={() => handleRefundAll(c.address, c.donorCount)}
                              disabled={processingAction === `refund-${c.address}`}
                              className="w-full py-2 bg-blue-600/20 hover:bg-blue-600 border border-blue-600/30 hover:border-blue-500 text-blue-400 hover:text-white text-sm rounded-xl transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                              {processingAction === `refund-${c.address}` ? (
                                <span className="flex items-center justify-center gap-1.5"><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />Refunding...</span>
                              ) : `💸 Refund All (${c.donorCount} donor)`}
                            </button>
                          )}
                          {canCancel && (
                            <button onClick={() => handleCancelCampaign(c.address)}
                              disabled={processingAction === `cancel-${c.address}`}
                              className="w-full py-2 bg-red-600/20 hover:bg-red-600 border border-red-600/30 hover:border-red-500 text-red-400 hover:text-white text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                              {processingAction === `cancel-${c.address}` ? (
                                <span className="flex items-center justify-center gap-1.5"><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />Membatalkan...</span>
                              ) : '🚫 Batalkan Kampanye'}
                            </button>
                          )}
                          {!canRefund && !canCancel && (
                            <p className="text-xs text-gray-600 text-center py-2">
                              {Number(c.balance) === 0 ? '✅ Refund selesai' : 'Tidak ada aksi'}
                            </p>
                          )}
                          <Link href={`/campaign/${c.address}`} className="block text-center text-xs text-indigo-400 hover:text-indigo-300 pt-1">
                            Lihat Detail →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {/* ── Tab: Aktif ── */}
        {tab === 'active' && (
          <div>
            <h2 className="text-base font-semibold text-gray-300 mb-2">Kampanye Sedang Berjalan</h2>
            <p className="text-sm text-gray-500 mb-6">Kampanye yang sudah disetujui, belum dibatalkan, dan deadline belum lewat.</p>

            {loadingActive ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(3)].map((_, i) => <Skeleton key={i} />)}
              </div>
            ) : activeCampaigns.length === 0 ? (
              <EmptyState icon="📭" message="Tidak ada kampanye yang sedang aktif" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {activeCampaigns.map(c => {
                  const now = Math.floor(Date.now() / 1000);
                  const daysLeft = Math.max(0, Math.ceil((c.deadline - now) / 86400));
                  const pct = Number(c.goal) > 0 ? Math.min(100, Math.round((Number(c.raised) / Number(c.goal)) * 100)) : 0;
                  const goalMet = Number(c.raised) >= Number(c.goal);
                  return (
                    <div key={c.address} className="bg-[#0d1526] border border-white/10 hover:border-indigo-500/30 rounded-2xl overflow-hidden transition-all">
                      <div className="relative h-32 bg-gradient-to-br from-indigo-900/20 to-purple-900/20">
                        {c.image && !imgErrors[c.address] ? (
                          <img src={c.image} alt={c.title} className="w-full h-full object-cover opacity-60"
                            onError={() => setImgErrors(p => ({ ...p, [c.address]: true }))} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl opacity-10">🌱</div>
                        )}
                        <div className="absolute top-2 right-2 flex gap-1">
                          {goalMet && (
                            <span className="text-xs bg-emerald-500/80 text-white px-2 py-0.5 rounded-full font-medium">Goal Tercapai</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${daysLeft <= 3 ? 'bg-red-500/80 text-white' : 'bg-white/10 text-gray-300'}`}>
                            {daysLeft}h lagi
                          </span>
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="font-semibold text-white text-sm line-clamp-1 mb-1">{c.title}</h3>
                        <p className="text-xs text-gray-600 font-mono truncate mb-3">👤 {c.creator}</p>

                        <div className="space-y-1 mb-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Terkumpul</span>
                            <span className="text-white font-medium">{Number(c.raised).toFixed(4)} / {Number(c.goal).toFixed(2)} ETH</span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full transition-all ${goalMet ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>{pct}%</span>
                            <span>{c.donorCount} donor</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          <div className="bg-white/5 rounded-lg p-2">
                            <p className="text-gray-500">Saldo</p>
                            <p className="text-white font-semibold mt-0.5">{Number(c.balance).toFixed(4)} ETH</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2">
                            <p className="text-gray-500">Deadline</p>
                            <p className="text-white font-semibold mt-0.5">{new Date(c.deadline * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                          </div>
                        </div>

                        <button onClick={() => handleCancelCampaign(c.address)}
                          disabled={processingAction === `cancel-${c.address}`}
                          className="w-full py-2 mb-2 bg-red-600/20 hover:bg-red-600 border border-red-600/30 hover:border-red-500 text-red-400 hover:text-white text-xs rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                          {processingAction === `cancel-${c.address}` ? (
                            <span className="flex items-center justify-center gap-1.5"><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />Membatalkan...</span>
                          ) : '🚫 Batalkan Kampanye'}
                        </button>
                        <Link href={`/campaign/${c.address}`} className="block text-center text-xs text-indigo-400 hover:text-indigo-300 pt-1">
                          Lihat Detail →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Riwayat ── */}
        {tab === 'history' && (
          <div>
            <h2 className="text-base font-semibold text-gray-300 mb-2">Riwayat Kampanye</h2>
            <p className="text-sm text-gray-500 mb-6">Kampanye yang sudah selesai, ditolak, dibatalkan, atau dananya sudah kosong.</p>

            {loadingHistory ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(3)].map((_, i) => <Skeleton key={i} />)}
              </div>
            ) : historyCampaigns.length === 0 ? (
              <EmptyState icon="📭" message="Belum ada riwayat kampanye" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {historyCampaigns.map(c => {
                  const statusMap: Record<HistoryStatus, { label: string; bg: string; text: string; border: string }> = {
                    success:   { label: '✅ Berhasil',   bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
                    expired:   { label: '⏰ Berakhir',   bg: 'bg-gray-500/10',    text: 'text-gray-400',    border: 'border-gray-500/30'    },
                    cancelled: { label: '🚫 Dibatalkan', bg: 'bg-orange-500/10',  text: 'text-orange-400',  border: 'border-orange-500/30'  },
                    denied:    { label: '❌ Ditolak',    bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30'     },
                  };
                  const s = statusMap[c.status];
                  const deadlineStr = new Date(c.deadline * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                  const pct = Number(c.goal) > 0 ? Math.min(100, Math.round((Number(c.raised) / Number(c.goal)) * 100)) : 0;
                  return (
                    <div key={c.address} className={`bg-[#0d1526] border ${s.border} rounded-2xl overflow-hidden transition-all hover:border-opacity-60`}>
                      <div className="relative h-32 bg-gradient-to-br from-slate-800 to-slate-900">
                        {c.image ? (
                          <img src={c.image} alt={c.title} className="w-full h-full object-cover opacity-50" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl opacity-10">🌱</div>
                        )}
                        <div className="absolute top-2 right-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text} border ${s.border}`}>
                            {s.label}
                          </span>
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="font-semibold text-white text-sm line-clamp-1 mb-1">{c.title}</h3>
                        <p className="text-xs text-gray-600 font-mono truncate mb-3">👤 {c.creator}</p>

                        <div className="space-y-1 mb-3">
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>Terkumpul</span>
                            <span className="text-white font-medium">{Number(c.raised).toFixed(4)} ETH</span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>{pct}% dari {Number(c.goal).toFixed(2)} ETH</span>
                            <span>Berakhir {deadlineStr}</span>
                          </div>
                        </div>

                        <Link href={`/campaign/${c.address}`} className="block text-center text-xs text-indigo-400 hover:text-indigo-300 pt-1">
                          Lihat Detail →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
    </>
  );
}

// ─── Sub Components ────────────────────────────────────────────────────────

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="text-center py-20 bg-[#0d1526] border border-white/10 rounded-2xl">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  );
}

function CampaignCard({ title, image, creator, address, metadataUrl, imgError, onImgError, actions }: {
  title: string; image: string; creator: string; address: string; metadataUrl?: string;
  imgError?: boolean; onImgError?: () => void;
  actions: { label: string; onClick: () => void; color: 'green' | 'red'; disabled?: boolean; loadingLabel?: string }[];
}) {
  const [meta,        setMeta]        = useState<any>(null);
  const [showDocs,    setShowDocs]    = useState(false);

  useEffect(() => {
    if (!metadataUrl) return;
    fetch(metadataUrl)
      .then(r => r.json())
      .then(json => { if (json?.version === '1') setMeta(json); })
      .catch(() => {});
  }, [metadataUrl]);

  const colorMap = {
    green: 'bg-green-600/20 hover:bg-green-600 border-green-600/30 hover:border-green-500 text-green-400 hover:text-white',
    red:   'bg-red-600/20 hover:bg-red-600 border-red-600/30 hover:border-red-500 text-red-400 hover:text-white',
  };

  return (
    <div className="bg-[#0d1526] border border-white/10 hover:border-indigo-500/40 rounded-2xl overflow-hidden transition-all">
      <div className="relative h-36 bg-gradient-to-br from-indigo-900/30 to-purple-900/30">
        {image && !imgError ? (
          <img src={image} alt={title} className="w-full h-full object-cover" onError={onImgError} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl opacity-10">🌱</div>
        )}
        {meta && (
          <div className="absolute top-2 right-2">
            <span className="text-xs bg-indigo-500/80 text-white px-2 py-0.5 rounded-full">
              {meta.categoryLabel || meta.category}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-white text-sm line-clamp-1 mb-1">{title}</h3>
        <p className="text-xs text-gray-600 font-mono truncate mb-1">👤 {creator}</p>

        {/* Kontak ringkas */}
        {meta?.contact && (
          <div className="text-xs text-gray-400 mb-2 space-y-0.5">
            {meta.contact.nama     && <p>📋 {meta.contact.nama}</p>}
            {meta.contact.whatsapp && <p>📱 {meta.contact.whatsapp}</p>}
            {meta.contact.email    && <p>✉️ {meta.contact.email}</p>}
          </div>
        )}

        <Link href={`/campaign/${address}`} className="text-xs text-indigo-400 hover:underline block mb-2">Lihat Detail →</Link>

        {/* Dokumen */}
        {meta?.documents?.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setShowDocs(s => !s)}
              className="text-xs text-amber-400 hover:text-amber-300 transition mb-1"
            >
              📎 {showDocs ? 'Sembunyikan' : 'Lihat'} Dokumen ({meta.documents.length})
            </button>
            {showDocs && (
              <div className="space-y-1">
                {meta.documents.map((doc: any, i: number) => (
                  <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 hover:text-white transition"
                  >
                    <span>{doc.url?.includes('.pdf') ? '📄' : '🖼️'}</span>
                    <span className="truncate">{doc.label}</span>
                    <span className="ml-auto text-gray-500">↗</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {!meta && metadataUrl && (
          <p className="text-xs text-gray-600 mb-2">Memuat dokumen...</p>
        )}
        {!metadataUrl && (
          <p className="text-xs text-red-400/70 mb-2">Tidak ada dokumen legitimasi</p>
        )}

        <div className="flex gap-2">
          {actions.map(a => (
            <button key={a.label} onClick={a.onClick} disabled={a.disabled}
              className={`flex-1 py-2 border text-sm rounded-xl transition-all ${colorMap[a.color]} disabled:opacity-50 disabled:cursor-not-allowed`}>
              {a.disabled && a.loadingLabel ? (
                <span className="flex items-center justify-center gap-1.5">
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  {a.loadingLabel}
                </span>
              ) : a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
