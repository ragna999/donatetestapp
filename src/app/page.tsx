// Tambahan: Import React jika diperlukan
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
};

const FACTORY_ADDRESS = '0x7800BC9175383c47876Ce4cf4C6Fb947281d6187';

const FACTORY_ABI = [
  {
    inputs: [],
    name: 'getCampaigns',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const CAMPAIGN_ABI = [
  { name: 'title', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'description', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'image', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'goal', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDonated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
];

export default function HomePage() {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleDescription = (address: string) => {
    setExpanded((prev) => ({ ...prev, [address]: !prev[address] }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(
          'https://rpc.ankr.com/eth_sepolia/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26'
        );
        const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
        const addresses: string[] = await factory.getCampaigns();

        const results = await Promise.all(
          addresses.map(async (addr) => {
            const c = new Contract(addr, CAMPAIGN_ABI, provider);
            const [title, description, image, goal, raised] = await Promise.all([
              c.title(),
              c.description(),
              c.image(),
              c.goal(),
              c.totalDonated(),
            ]);

            return {
              address: addr,
              title,
              description,
              image,
              goal: ethers.formatEther(goal),
              raised: ethers.formatEther(raised),
            };
          })
        );

        setCampaigns(results);
      } catch (error) {
        console.error('❌ Gagal ambil data campaign:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <main className="min-h-screen bg-[#0f172a] text-white py-12 px-6">
      <h1 className="text-4xl font-bold mb-12 text-center tracking-wide font-mono">
        🧬 Web3 Campaign Explorer
      </h1>

      {campaigns.length === 0 ? (
        <p className="text-center text-gray-400">Tidak ada kampanye yang tersedia saat ini.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 auto-rows-fr">
          {campaigns.map((c) => {
            const showFull = expanded[c.address];

            return (
              <div
                key={c.address}
                className="flex flex-col justify-between h-full bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-blue-500/20 rounded-2xl p-6 shadow-xl hover:shadow-blue-500/30 transition-all duration-300 backdrop-blur-lg"
              >
                <img
                  src={c.image || 'https://placehold.co/400x200?text=No+Image'}
                  alt={c.title}
                  className="w-full h-40 object-cover rounded-lg mb-4 border"
                />

                <h2 className="text-xl font-bold mb-2 text-white tracking-tight">
                  {c.title}
                </h2>

                <p className="text-sm text-gray-300 mb-2">
                  {showFull ? c.description : (
                    <>
                      {c.description.length > 120 ? (
                        <>
                          {c.description.slice(0, 100)}...
                          <button
                            onClick={() => toggleDescription(c.address)}
                            className="text-blue-400 text-xs ml-1 underline"
                          >
                            See more
                          </button>
                        </>
                      ) : c.description}
                    </>
                  )}
                </p>

                {showFull && c.description.length > 120 && (
                  <button
                    onClick={() => toggleDescription(c.address)}
                    className="text-xs text-blue-400 hover:underline mb-3 text-left"
                  >
                    See less
                  </button>
                )}

                <div className="mb-3 mt-1">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full"
                      style={{
                        width: `${(Number(c.raised) / Number(c.goal)) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-emerald-200 mt-2">
                    🔥 {c.raised} ETH dari {c.goal} ETH
                  </p>
                </div>

                <p className="text-xs text-gray-500 mb-4 truncate font-mono">
                  🧾 {c.address}
                </p>

                <Link href={`/campaign/${c.address}`}>
                  <button className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-2 rounded-xl text-sm hover:scale-[1.03] transition-all font-semibold">
                    🚀 Lihat Detail
                  </button>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
