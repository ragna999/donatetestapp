'use client';

import { useEffect, useState } from 'react';
import { ethers, Contract } from 'ethers';
import Link from 'next/link';

type CampaignData = {
  address: string;
  title: string;
  description: string;
  image: string;
  goal: string;
  raised: string;
  deadline: number;
  isFinished: boolean;
};

const FACTORY_ADDRESS = '0xFDa9BEB30b7497d416Cbcb866cF00AF525a710eE';

const FACTORY_ABI = [
  {
    name: 'getApprovedCampaigns',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]', name: '' }],
  },
];

const CAMPAIGN_ABI = [
  { name: 'title', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'description', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'image', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'goal', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDonated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'deadline', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
];

export default function CampaignHistoryPage() {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(
          'https://rpc.ankr.com/somnia_testnet/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26'
        );
        const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
        const addresses: string[] = await factory.getApprovedCampaigns();

        const results = await Promise.all(
            addresses.map(async (addr) => {
              try {
                const code = await provider.getCode(addr);
                if (code === '0x') throw new Error('Not a contract');
          
                const c = new Contract(addr, CAMPAIGN_ABI, provider);
                const [title, description, image, goal, raised, deadline] = await Promise.all([
                  c.title(),
                  c.description(),
                  c.image(),
                  c.goal(),
                  c.totalDonated(),
                  c.deadline(),
                ]);
          
                const now = Math.floor(Date.now() / 1000);
                const isFinished = now > Number(deadline) || BigInt(raised) >= BigInt(goal);
          
                return {
                  address: addr,
                  title,
                  description,
                  image,
                  goal: ethers.formatEther(goal),
                  raised: ethers.formatEther(raised),
                  deadline: Number(deadline),
                  isFinished,
                };
              } catch (err: any) {
                console.warn('⚠️ Lewatin address invalid:', addr, err.message);
                return null;
              }
            })
          );
          
          const cleaned = results.filter((c): c is CampaignData => c !== null);
          const finished = cleaned.filter(c => c.isFinished);
          setCampaigns(finished);
          
          

          
      } catch (error) {
        console.error('❌ Gagal ambil campaign:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <main className="min-h-screen bg-[#0f172a] text-white py-12 px-6">
      <h1 className="text-3xl font-bold mb-10 text-center font-mono">Riwayat Campaign ⛔</h1>

      {loading ? (
        <p className="text-center text-gray-400">Loading campaign yang sudah selesai...</p>
      ) : campaigns.length === 0 ? (
        <p className="text-center text-gray-500">Belum ada campaign yang selesai.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 auto-rows-fr">
          {campaigns.map((c) => (
            <div
              key={c.address}
              className="flex flex-col justify-between h-full bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-blue-500/20 rounded-2xl p-6 shadow-xl hover:shadow-blue-500/30 transition-all duration-300 backdrop-blur-lg"
            >
              <img
                src={c.image || 'https://placehold.co/400x200?text=No+Image'}
                alt={c.title}
                className="w-full h-40 object-cover rounded-lg mb-4 border"
              />
              <h2 className="text-xl font-bold mb-2 text-white tracking-tight">{c.title}</h2>
              <p className="text-sm text-gray-300 line-clamp-3 mb-3">{c.description}</p>

              <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                <div
                  className="bg-red-400 h-full"
                  style={{ width: `${(Number(c.raised) / Number(c.goal)) * 100}%` }}
                />
              </div>
              <p className="text-xs text-red-200 mb-4">📦 {c.raised} STT dari {c.goal} STT</p>

              <p className="text-xs text-gray-500 mb-4 truncate font-mono">🧾 {c.address}</p>

              <Link href={`/campaign/${c.address}`}>
                <button className="w-full bg-gradient-to-r from-rose-500 to-red-500 text-white py-2 rounded-xl text-sm hover:scale-[1.03] transition-all font-semibold">
                  Lihat Detail
                </button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
