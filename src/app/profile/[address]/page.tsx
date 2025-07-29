'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ethers, Contract } from 'ethers';
import Link from 'next/link';

const FACTORY_ADDRESS = '0x44C69315b6531cC4E53f63FAB7769E33adcde87b';

const FACTORY_ABI = [
  {
    name: 'getCampaignsByCreator',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_creator', type: 'address' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
];

const CAMPAIGN_ABI = [
  { name: 'title', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'description', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'goal', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDonated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
];

export default function CreatorProfilePage() {
  const { address } = useParams() as { address: string };
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://rpc.ankr.com/eth_sepolia/YOUR_API_KEY');

        const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
        const campaignAddrs: string[] = await factory.getCampaignsByCreator(address);

        const details = await Promise.all(
          campaignAddrs.map(async (addr) => {
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
        console.error('❌ Gagal ambil kampanye penyelenggara:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [address]);

  return (
    <main className="min-h-screen bg-white text-gray-900 p-6">
      <h1 className="text-3xl font-bold mb-2">👤 Profil Penyelenggara</h1>
      <p className="mb-8 text-sm text-gray-500 break-all">Wallet: <span className="text-blue-600 font-mono">{address}</span></p>

      <h2 className="text-xl font-semibold mb-4">📂 Kampanye yang Dibuat</h2>

      {loading ? (
        <p>Loading...</p>
      ) : campaigns.length === 0 ? (
        <p className="text-gray-500">Belum ada kampanye.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => (
            <div key={c.address} className="bg-gray-100 border border-gray-300 p-5 rounded-xl shadow hover:shadow-md transition">
              <h3 className="text-lg font-bold mb-1">{c.title}</h3>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{c.description}</p>

              <div className="h-2 bg-gray-300 rounded-full overflow-hidden mb-2">
                <div
                  className="bg-green-500 h-full"
                  style={{ width: `${(Number(c.raised) / Number(c.goal)) * 100}%` }}
                />
              </div>

              <p className="text-xs text-gray-700 mb-2">
                💰 {c.raised} ETH dari {c.goal} ETH
              </p>
              <p className="text-xs text-gray-400 truncate">📦 {c.address}</p>

              <Link href={`/campaign/${c.address}`} className="block mt-3">
                <button className="w-full bg-blue-600 text-white text-sm py-2 rounded hover:bg-blue-700 transition">
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
