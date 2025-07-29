'use client';
import { useEffect, useState } from 'react';
import { ethers, Contract } from 'ethers';
import Link from 'next/link';

type CampaignData = {
  address: string;
  title: string;
  description: string;
  goal: string;
  raised: string;
};

const FACTORY_ADDRESS = '0x44C69315b6531cC4E53f63FAB7769E33adcde87b';
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
  { name: 'title', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { name: 'description', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { name: 'goal', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalDonated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
];

export default function HomePage() {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        // ✅ Provider publik Sepolia (via Ankr)
        const provider = new ethers.JsonRpcProvider('https://rpc.ankr.com/eth_sepolia/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26');

        const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
        const addresses: string[] = await factory.getCampaigns();

        console.log('📦 Alamat campaign:', addresses);

        const details = await Promise.all(
          addresses.map(async (addr) => {
            const campaign = new Contract(addr, CAMPAIGN_ABI, provider);
            const [title, description, goal, totalDonated] = await Promise.all([
              campaign.title(),
              campaign.description(),
              campaign.goal(),
              campaign.totalDonated(),
            ]);

            return {
              address: addr,
              title,
              description,
              goal: ethers.formatEther(goal),
              raised: ethers.formatEther(totalDonated),
            };
          })
        );

        setCampaigns(details);
      } catch (err) {
        console.error('❌ Gagal ambil data campaign:', err);
      }
    };

    fetchCampaigns();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-gray-100 to-gray-200 text-gray-900 py-10 px-6">
  <h1 className="text-4xl font-bold mb-10 tracking-wide text-center">🌐 Campaign Explorer</h1>

  {campaigns.length === 0 ? (
    <p className="text-center text-gray-500">Tidak ada kampanye yang tersedia saat ini.</p>
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {campaigns.map((c) => (
        <div
          key={c.address}
          className="bg-white border border-gray-200 rounded-2xl p-6 shadow-md hover:shadow-blue-400/30 transition-all duration-300"
        >
          <h2 className="text-2xl font-semibold mb-1 text-gray-900">{c.title}</h2>
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">{c.description}</p>

          <div className="mb-4">
            <div className="h-2 bg-gray-300 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all"
                style={{ width: `${(Number(c.raised) / Number(c.goal)) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-700 mt-2">
              💰 {c.raised} ETH dari {c.goal} ETH
            </p>
          </div>

          <p className="text-xs text-gray-500 mb-4 truncate">📦 {c.address}</p>

          <Link href={`/campaign/${c.address}`}>
            <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 rounded-lg text-sm hover:scale-105 transition-all flex items-center justify-center gap-2">
              Lihat Detail <span>→</span>
            </button>
          </Link>
        </div>
      ))}
    </div>
  )}
</main>


  );
}
