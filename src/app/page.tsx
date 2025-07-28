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
    <main className="min-h-screen bg-black text-white py-10 px-6">
      <h1 className="text-3xl font-bold mb-8">Campaigns</h1>

      {campaigns.length === 0 ? (
        <p className="text-gray-400">Belum ada kampanye yang aktif.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => (
            <div
              key={c.address}
              className="bg-white text-black p-5 rounded-2xl shadow-lg hover:scale-[1.02] transition"
            >
              <h2 className="text-xl font-bold mb-1">{c.title}</h2>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{c.description}</p>

              <div className="mb-2">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="bg-green-500 h-full"
                    style={{ width: `${(Number(c.raised) / Number(c.goal)) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-700 mt-1">
                  {c.raised} ETH raised of {c.goal} ETH
                </p>
              </div>

              <p className="text-xs text-gray-400 truncate">{c.address}</p>

              <Link href={`/campaign/${c.address}`} className="block mt-4">
                <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm">
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
