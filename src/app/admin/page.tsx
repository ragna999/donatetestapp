'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ethers, Contract, ContractTransactionResponse } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { RPC, FACTORY_ADDRESS } from '../lib/config';

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

type Tab = 'campaigns' | 'withdraws' | 'refunds';

type PendingCampaign  = { address: string; title: string; image: string; creator: string; metadataUrl?: string };
type PendingRequest   = { index: number; amount: string; reason: string; timestamp: number; campaign: string; title: string; creator: string };
type RefundableCampaign = { address: string; title: string; image: string; creator: string; balance: string; donorCount: number; cancelled: boolean; isRefundable: boolean; deadline: number; raised: string; goal: string };

export default function AdminPage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [tab, setTab] = useState<Tab>('campaigns');

  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [pendingCampaigns, setPendingCampaigns] = useState<PendingCampaign[]>([]);

  const [loadingReq,      setLoadingReq]      = useState(true);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  const [loadingRefunds,       setLoadingRefunds]       = useState(true);
  const [refundableCampaigns,  setRefundableCampaigns]  = useState<RefundableCampaign[]>([]);

  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

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
    const wallet = wallets[0];
    if (!wallet) throw new Error('Wallet tidak ditemukan');
    const eip1193 = await wallet.getEthereumProvider();
    return new ethers.BrowserProvider(eip1193).getSigner();
  }

  async function safeTx(p: Promise<ContractTransactionResponse>) {
    const tx = await p; await tx.wait();
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
          if (!refundable && balanceBN === 0n) return null;
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

  useEffect(() => {
    if (!authenticated) return;
    fetchPendingCampaigns();
    fetchPendingWithdraws();
    fetchRefundableCampaigns();
  }, [authenticated]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  async function setWithdrawStatusTx(campaignAddr: string, index: number, approve: boolean) {
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
      await tx.wait();
    } catch (e) { throw new Error(errText(e)); }
  }

  const handleApproveCampaign = async (address: string) => {
    try { const s = await getSigner(); const f = new Contract(FACTORY_ADDRESS, FACTORY_ABI, s); await safeTx(f.approveCampaign(address)); alert('✅ Campaign disetujui'); await fetchPendingCampaigns(); }
    catch (e: any) { alert('❌ ' + errText(e)); }
  };
  const handleDenyCampaign = async (address: string) => {
    try { const s = await getSigner(); const f = new Contract(FACTORY_ADDRESS, FACTORY_ABI, s); await safeTx(f.denyCampaign(address)); alert('⛔ Campaign ditolak'); await fetchPendingCampaigns(); }
    catch (e: any) { alert('❌ ' + errText(e)); }
  };
  const handleApproveWithdraw = async (addr: string, idx: number) => {
    try { await setWithdrawStatusTx(addr, idx, true); alert('✅ Withdraw disetujui'); await fetchPendingWithdraws(); }
    catch (e: any) { alert('❌ ' + errText(e)); }
  };
  const handleDenyWithdraw = async (addr: string, idx: number) => {
    try { await setWithdrawStatusTx(addr, idx, false); alert('⛔ Withdraw ditolak'); await fetchPendingWithdraws(); }
    catch (e: any) { alert('❌ ' + errText(e)); }
  };
  const handleCancelCampaign = async (addr: string) => {
    if (!confirm('Batalkan kampanye ini? Donor akan bisa klaim refund.')) return;
    try { const s = await getSigner(); const c = new Contract(addr, CAMPAIGN_ABI, s); const tx = await (c as any).cancelCampaign(); await tx.wait(); alert('✅ Kampanye dibatalkan'); await fetchRefundableCampaigns(); }
    catch (e: any) { alert('❌ ' + errText(e)); }
  };
  const handleRefundAll = async (addr: string, donorCount: number) => {
    if (!confirm(`Refund ke ${donorCount} donor sekaligus?`)) return;
    try { const s = await getSigner(); const c = new Contract(addr, CAMPAIGN_ABI, s); const tx = await (c as any).refundAll(); await tx.wait(); alert('✅ Refund berhasil!'); await fetchRefundableCampaigns(); }
    catch (e: any) { alert('❌ ' + errText(e)); }
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
    { key: 'campaigns', label: 'Kampanye',         count: pendingCampaigns.length },
    { key: 'withdraws', label: 'Withdraw',          count: pendingRequests.length },
    { key: 'refunds',   label: 'Refund',            count: refundableCampaigns.length },
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
                      { label: '✅ Approve', onClick: () => handleApproveCampaign(c.address), color: 'green' },
                      { label: '❌ Deny',    onClick: () => handleDenyCampaign(c.address),    color: 'red'   },
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
                        className="flex-1 py-2 bg-green-600/20 hover:bg-green-600 border border-green-600/30 hover:border-green-500 text-green-400 hover:text-white text-sm rounded-xl transition-all">
                        ✅ Approve
                      </button>
                      <button onClick={() => handleDenyWithdraw(r.campaign, r.index)}
                        className="flex-1 py-2 bg-red-600/20 hover:bg-red-600 border border-red-600/30 hover:border-red-500 text-red-400 hover:text-white text-sm rounded-xl transition-all">
                        ❌ Deny
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
                              className="w-full py-2 bg-blue-600/20 hover:bg-blue-600 border border-blue-600/30 hover:border-blue-500 text-blue-400 hover:text-white text-sm rounded-xl transition-all font-medium">
                              💸 Refund All ({c.donorCount} donor)
                            </button>
                          )}
                          {canCancel && (
                            <button onClick={() => handleCancelCampaign(c.address)}
                              className="w-full py-2 bg-red-600/20 hover:bg-red-600 border border-red-600/30 hover:border-red-500 text-red-400 hover:text-white text-sm rounded-xl transition-all">
                              🚫 Batalkan Kampanye
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
      </div>
    </div>
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
  actions: { label: string; onClick: () => void; color: 'green' | 'red' }[];
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
            <button key={a.label} onClick={a.onClick}
              className={`flex-1 py-2 border text-sm rounded-xl transition-all ${colorMap[a.color]}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
