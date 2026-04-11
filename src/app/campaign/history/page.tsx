'use client';

import { useEffect, useState } from 'react';
import { ethers, Contract } from 'ethers';
import Link from 'next/link';
import { RPC, FACTORY_ADDRESS } from '../../lib/config';

type CampaignData = {
  address: string;
  title: string;
  description: string;
  image: string;
  goal: string;
  raised: string;
  deadline: number;
  isFinished: boolean;
  cancelled: boolean;
};

const FACTORY_ABI = [
  { name: 'getApprovedCampaigns', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]', name: '' }] },
];

const CAMPAIGN_ABI = [
  { name: 'title',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'description',  type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'image',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'goal',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDonated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'deadline',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'cancelled',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
];

export default function CampaignHistoryPage() {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const provider = new ethers.JsonRpcProvider(RPC);
        const factory  = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
        const addresses: string[] = await factory.getApprovedCampaigns();

        const codes          = await Promise.all(addresses.map(addr => provider.getCode(addr)));
        const validAddresses = addresses.filter((_addr, i) => codes[i] !== '0x');

        const results = await Promise.all(
          validAddresses.map(async (addr) => {
            const c = new Contract(addr, CAMPAIGN_ABI, provider);
            const [title, description, image, goal, raised, deadline, cancelled] = await Promise.all([
              c.title(), c.description(), c.image(), c.goal(), c.totalDonated(), c.deadline(), c.cancelled(),
            ]);
            const now        = Math.floor(Date.now() / 1000);
            const isFinished = cancelled || now > Number(deadline) || BigInt(raised) >= BigInt(goal);
            return {
              address: addr, title, description, image,
              goal: ethers.formatEther(goal),
              raised: ethers.formatEther(raised),
              deadline: Number(deadline),
              isFinished,
              cancelled,
            };
          })
        );

        setCampaigns(results.filter(c => c.isFinished));
      } catch (err) {
        console.error('❌ fetchData error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0f1e] text-white py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm transition">← Kembali</Link>
          <h1 className="text-2xl font-bold">Riwayat Kampanye</h1>
          {!loading && (
            <span className="text-xs text-gray-500 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
              {campaigns.length} kampanye
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-44 bg-white/5" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-white/5 rounded-full w-3/4" />
                  <div className="h-3 bg-white/5 rounded-full w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <p className="text-4xl mb-4">📭</p>
            <p className="text-lg font-medium text-gray-400">Belum ada kampanye yang selesai atau dibatalkan</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((c) => {
              const pct     = Math.min(100, Number(c.goal) > 0 ? (Number(c.raised) / Number(c.goal)) * 100 : 0);
              const goalMet = Number(c.raised) >= Number(c.goal);
              const status  = c.cancelled
                ? { text: 'Dibatalkan', cls: 'bg-red-500/80 text-white' }
                : goalMet
                ? { text: 'Target Tercapai', cls: 'bg-green-500/80 text-white' }
                : { text: 'Berakhir', cls: 'bg-yellow-500/80 text-black' };

              return (
                <div key={c.address}
                  className="flex flex-col bg-[#111827] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all"
                >
                  <div className="relative h-44 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
                    {c.image && !imgErrors[c.address] ? (
                      <img
                        src={c.image} alt={c.title}
                        className="w-full h-full object-cover grayscale opacity-70"
                        onError={() => setImgErrors(p => ({ ...p, [c.address]: true }))}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl opacity-10">🌱</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111827] to-transparent opacity-60" />
                    <div className="absolute top-3 left-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.cls}`}>
                        {status.text}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col flex-1 p-5">
                    <h2 className="font-bold text-white text-base mb-2 line-clamp-1">{c.title}</h2>
                    <p className="text-sm text-gray-400 line-clamp-2 mb-4">{c.description}</p>

                    <div className="mt-auto">
                      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                        <span>{Number(c.raised).toFixed(4)} ETH terkumpul</span>
                        <span>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-white/25" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">dari {c.goal} ETH</p>
                    </div>

                    <p className="text-xs text-gray-600 mt-3">
                      {new Date(c.deadline * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>

                    <Link href={`/campaign/${c.address}`} className="mt-4">
                      <button className="w-full py-2.5 bg-white/5 border border-white/10 text-gray-400 text-sm rounded-xl hover:text-white hover:border-white/20 transition">
                        Lihat Detail →
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
