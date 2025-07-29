'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Contract, ethers } from 'ethers';
import Link from 'next/link';

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
  { name: 'title', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'description', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'goal', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDonated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'creator', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
];

export default function OrganizerProfilePage() {
  const { address } = useParams();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address || !ethers.isAddress(address)) return;

    const provider = new ethers.JsonRpcProvider('https://rpc.ankr.com/eth_sepolia/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26');

    const fetchCampaigns = async () => {
      try {
        const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
        const allAddresses: string[] = await factory.getCampaigns();

        const filtered = await Promise.all(
          allAddresses.map(async (addr) => {
            const c = new Contract(addr, CAMPAIGN_ABI, provider);
            const [creator, title, description, goal, raised] = await Promise.all([
              c.creator(),
              c.title(),
              c.description(),
              c.goal(),
              c.totalDonated(),
            ]);

            if (creator.toLowerCase() !== address.toLowerCase()) return null;

            return {
              address: addr,
              title,
              description,
              goal: ethers.formatEther(goal),
              raised: ethers.formatEther(raised),
            };
          })
        );

        setCampaigns(filtered.filter(Boolean));
      } catch (err) {
        console.error('Gagal fetch campaign:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [address]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <span>👤</span> Profil Penyelenggara
      </h1>
      <p className="mb-6 text-sm text-gray-700">
        Wallet: <a href={`https://sepolia.etherscan.io/address/${address}`} className="text-blue-600">{address}</a>
      </p>

      <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
        <span>📂</span> Kampanye yang Dibuat
      </h2>

      {loading ? (
        <p>Loading...</p>
      ) : campaigns.length === 0 ? (
        <p className="text-gray-500">Belum ada kampanye.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
          {campaigns.map((c) => (
            <div key={c.address} className="bg-white shadow p-4 rounded-md border">
              <h3 className="text-lg font-semibold">{c.title}</h3>
              <p className="text-sm text-gray-500 mb-2 line-clamp-2">{c.description}</p>
              <div className="h-2 bg-gray-200 rounded-full mb-1">
                <div
                  className="bg-green-500 h-full"
                  style={{ width: `${(Number(c.raised) / Number(c.goal)) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mb-2">
                {c.raised} ETH dari {c.goal} ETH
              </p>
              <Link
                href={`/campaign/${c.address}`}
                className="block text-center bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm"
              >
                Lihat Detail
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
