'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ethers, Contract, ContractTransactionResponse } from 'ethers';
import { usePrivy } from '@privy-io/react-auth';

const RPC =
  'https://rpc.ankr.com/somnia_testnet/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26';

const FACTORY_ADDRESS = '0xFDa9BEB30b7497d416Cbcb866cF00AF525a710eE';

const FACTORY_ABI = [
  { name: 'getAllCampaigns', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  { name: 'isApproved',      type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'deniedCampaigns', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'approveCampaign', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { name: 'denyCampaign',    type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
] as const;

// Minimal ABI untuk baca data + approve/deny langsung di campaign
const CAMPAIGN_ABI = [
  { name: 'title',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'image',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'creator',  type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    name: 'requests',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [
      { name: 'amount',    type: 'uint256' },
      { name: 'reason',    type: 'string'  },
      { name: 'timestamp', type: 'uint256' },
      { name: 'status',    type: 'uint8'   }, // 0=Pending, 1=Approved, 2=Denied
    ],
  },
  { name: 'approveWithdrawRequest', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
  { name: 'denyWithdrawRequest',    type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
  { name: 'setWithdrawStatus',      type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }, { type: 'uint8' }], outputs: [] },
] as const;

type PendingCampaign = {
  address: string;
  title: string;
  image: string;
  creator: string;
};

type PendingRequest = {
  index: number;
  amount: string;
  reason: string;
  timestamp: number;
  campaign: string;
  title: string;
  creator: string;
};

export default function AdminPage() {
  const { ready, authenticated } = usePrivy();
  const [tab, setTab] = useState<'campaigns' | 'withdraws'>('withdraws');

  const [loadingCampaigns, setLoadingCampaigns] = useState<boolean>(true);
  const [pendingCampaigns, setPendingCampaigns] = useState<PendingCampaign[]>([]);

  const [loadingReq, setLoadingReq] = useState<boolean>(true);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  const rpcProvider = useMemo(() => new ethers.JsonRpcProvider(RPC), []);

  // ==== helpers ====
  function errText(err: any): string {
    return (
      err?.info?.error?.message ||  // ethers v6 nested JSON-RPC
      err?.data?.message ||
      err?.cause?.message ||
      err?.shortMessage ||
      err?.reason ||
      err?.message ||
      String(err || 'Unknown error')
    );
  }
  
  
  

  async function getSigner(): Promise<ethers.Signer> {
    const eth = (window as any).ethereum;
    if (!eth) throw new Error('Wallet tidak ditemukan');
    const provider = new ethers.BrowserProvider(eth);
    return provider.getSigner();
  }

  async function safeTx(p: Promise<ContractTransactionResponse>) {
    const tx = await p;
    await tx.wait();
  }

  // ==== data loaders ====
  const fetchPendingCampaigns = async (): Promise<void> => {
    setLoadingCampaigns(true);
    try {
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, rpcProvider);
      const all: string[] = await factory.getAllCampaigns();

      const rows = await Promise.all(
        all.map(async (addr): Promise<PendingCampaign | null> => {
          try {
            const code = await rpcProvider.getCode(addr);
            if (code === '0x') return null;

            const [approved, denied] = await Promise.all([
              factory.isApproved(addr),
              factory.deniedCampaigns(addr),
            ]);
            if (approved || denied) return null;

            const c = new Contract(addr, CAMPAIGN_ABI, rpcProvider);
            const [title, image, creator] = await Promise.all([c.title(), c.image(), c.creator()]);
            return { address: addr, title, image, creator };
          } catch {
            return null;
          }
        })
      );

      setPendingCampaigns(rows.filter(Boolean) as PendingCampaign[]);
    } catch (e) {
      console.error('❌ Gagal load campaign:', e);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const fetchPendingWithdraws = async (): Promise<void> => {
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
              const status = Number(r.status);
              if (status === 0) {
                rows.push({
                  index: i,
                  amount: ethers.formatEther(r.amount),
                  reason: r.reason,
                  timestamp: Number(r.timestamp),
                  campaign: addr,
                  title,
                  creator,
                });
              }
            } catch {
              break; // udah mentok indexnya
            }
          }
        } catch {
          // skip broken campaign
        }
      }

      rows.sort((a, b) => b.timestamp - a.timestamp);
      setPendingRequests(rows);
    } catch (e) {
      console.error('❌ Gagal load withdraws:', e);
    } finally {
      setLoadingReq(false);
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    fetchPendingCampaigns();
    fetchPendingWithdraws();
  }, [authenticated]);

  // ==== helper: set status withdraw (approve/deny) ====

  async function setWithdrawStatusTx(campaignAddr: string, index: number, approve: boolean) {
    const eth = (window as any).ethereum;
    if (!eth) throw new Error('Wallet tidak ditemukan');
  
    const provider = new ethers.BrowserProvider(eth);
    const signer = await provider.getSigner();
  
    // ABI withdraw di DonationCampaign
    const ABI = [
      { name: 'approveWithdrawRequest', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
      { name: 'denyWithdrawRequest',    type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
      { name: 'setWithdrawStatus',      type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }, { type: 'uint8' }], outputs: [] },
    ] as const;
  
    const c = new Contract(campaignAddr, ABI, signer);
  
    // Preflight: static call buat nampilin reason kalau bakal revert
    try {
      if (approve) {
        await (c as any).approveWithdrawRequest.staticCall(index);
      } else {
        await (c as any).denyWithdrawRequest.staticCall(index);
      }
    } catch (e) {
      throw new Error(errText(e));
    }
  
    // Kirim tx benerannya
    if (approve) {
      const tx = await (c as any).approveWithdrawRequest(index);
      await tx.wait();
    } else {
      const tx = await (c as any).denyWithdrawRequest(index);
      await tx.wait();
    }
  }
  
  
  

  // ==== campaign actions ====
  const handleApproveCampaign = async (address: string): Promise<void> => {
    try {
      const signer = await getSigner();
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      await safeTx(factory.approveCampaign(address));
      alert('✅ Campaign disetujui');
      await fetchPendingCampaigns();
    } catch (e: any) {
      alert('❌ Gagal approve withdraw: ' + errText(e));
    }    
  };

  const handleDenyCampaign = async (address: string): Promise<void> => {
    try {
      const signer = await getSigner();
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      await safeTx(factory.denyCampaign(address));
      alert('⛔ Campaign ditolak');
      await fetchPendingCampaigns();
    } catch (e: any) {
      alert('❌ Gagal menolak campaign: ' + errText(e));
    }
  };

  // ==== withdraw actions (pakai helper di atas; tidak ada duplikasi) ====
  const handleApproveWithdraw = async (campaignAddr: string, index: number): Promise<void> => {
    try {
      await setWithdrawStatusTx(campaignAddr, index, true);
      alert('✅ Withdraw request disetujui');
      await fetchPendingWithdraws();
    } catch (e: any) {
      alert('❌ Gagal approve withdraw: ' + errText(e));
    }
  };

  const handleDenyWithdraw = async (campaignAddr: string, index: number): Promise<void> => {
    try {
      await setWithdrawStatusTx(campaignAddr, index, false);
      alert('⛔ Withdraw request ditolak');
      await fetchPendingWithdraws();
    } catch (e: any) {
      alert('❌ Gagal menolak withdraw: ' + errText(e));
    }
  };

  if (!ready) return <div className="p-6 text-gray-600">Loading...</div>;
  if (!authenticated) return <div className="p-6">Kamu belum login sebagai admin.</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-blue-700">🛠️ Admin Dashboard</h1>

          <div className="inline-flex bg-white rounded-full p-1 border">
            <button
              onClick={() => setTab('campaigns')}
              className={`px-4 py-1 rounded-full text-sm ${tab === 'campaigns' ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
            >
              Campaigns
            </button>
            <button
              onClick={() => setTab('withdraws')}
              className={`px-4 py-1 rounded-full text-sm ${tab === 'withdraws' ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
            >
              Withdraw Requests
            </button>
          </div>
        </div>

        {tab === 'campaigns' ? (
          <section>
            {loadingCampaigns ? (
              <p className="text-gray-500">🔄 Memuat campaign...</p>
            ) : pendingCampaigns.length === 0 ? (
              <p className="text-green-700">✅ Tidak ada campaign yang menunggu approval.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingCampaigns.map((c) => (
                  <div key={c.address} className="bg-white rounded-xl shadow p-4 border">
                    <img
                      src={c.image || 'https://placehold.co/600x300?text=Campaign'}
                      alt={c.title}
                      className="w-full h-32 object-cover rounded-md mb-3"
                    />
                    <h2 className="text-lg font-bold text-gray-800 mb-1 line-clamp-1">{c.title}</h2>
                    <p className="text-xs text-gray-400 mb-3 font-mono truncate">👤 {c.creator}</p>

                    <Link href={`/campaign/${c.address}`} className="text-blue-600 text-xs hover:underline mb-3 inline-block">
                      Lihat Detail →
                    </Link>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveCampaign(c.address)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => handleDenyCampaign(c.address)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded"
                      >
                        ❌ Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section>
            {loadingReq ? (
              <p className="text-gray-500">🔄 Memuat withdraw requests...</p>
            ) : pendingRequests.length === 0 ? (
              <p className="text-green-700">✅ Tidak ada request withdraw yang pending.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pendingRequests.map((r, idx) => (
                  <div key={`${r.campaign}-${r.index}-${idx}`} className="bg-white rounded-xl shadow p-4 border">
                    <div className="text-xs text-gray-500 mb-1 font-mono truncate">{r.campaign}</div>
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{r.title}</h3>
                    <p className="text-xs text-gray-500 mb-2 font-mono truncate">👤 {r.creator}</p>

                    <div className="text-sm mb-2">
                      <span className="font-semibold">💸 {r.amount} STT</span>{' '}
                      <span className="text-gray-600 italic">— {r.reason}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-3">🕒 {new Date(r.timestamp * 1000).toLocaleString()}</div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveWithdraw(r.campaign, r.index)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => handleDenyWithdraw(r.campaign, r.index)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded"
                      >
                        ❌ Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
