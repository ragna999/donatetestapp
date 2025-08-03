'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';

const FACTORY_ADDRESS = '0x67406856cdE16b43DEf56EaB3CD6A6c678537878';

const FACTORY_ABI = [
  {
    name: 'getAllCampaigns',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]', name: '' }],
  },
  {
    name: 'isApproved',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'bool', name: '' }],
  },
  {
    name: 'approveCampaign',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_campaign', type: 'address' }],
    outputs: [],
  },
];

const CAMPAIGN_ABI = [
  { name: 'title', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'description', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'image', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'goal', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'creator', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
];

export default function AdminDashboard() {
  const { authenticated, ready } = usePrivy();
  const [pendingCampaigns, setPendingCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingCampaigns = async () => {
    try {
      const rpcProvider = new ethers.JsonRpcProvider(
        'https://rpc.ankr.com/somnia_testnet/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26'
      );

      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, rpcProvider);
      const allAddresses: string[] = await factory.getAllCampaigns();

      const result = await Promise.all(
        allAddresses.map(async (addr) => {
          const approved = await factory.isApproved(addr);
          if (approved) return null;

          const campaign = new ethers.Contract(addr, CAMPAIGN_ABI, rpcProvider);
          const [title, description, image, goal, creator] = await Promise.all([
            campaign.title(),
            campaign.description(),
            campaign.image(),
            campaign.goal(),
            campaign.creator(),
          ]);

          return {
            address: addr,
            title,
            description,
            image,
            goal: ethers.formatEther(goal),
            creator,
          };
        })
      );

      setPendingCampaigns(result.filter(Boolean));
    } catch (err) {
      console.error('❌ Gagal load campaign:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (address: string) => {
    try {
      const eth = (window as any).ethereum;
      if (!eth) return alert('❌ Wallet tidak ditemukan');

      const browserProvider = new ethers.BrowserProvider(eth);
      const signer = await browserProvider.getSigner();
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);

      const tx = await factory.approveCampaign(address);
      await tx.wait();
      alert('✅ Campaign berhasil di-approve!');
      fetchPendingCampaigns(); // refresh list
    } catch (err) {
      console.error('❌ Gagal approve:', err);
      alert('❌ Gagal approve campaign.');
    }
  };

  useEffect(() => {
    if (authenticated) fetchPendingCampaigns();
  }, [authenticated]);

  if (!ready) return <p className="text-center text-gray-600 p-6">Loading...</p>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-blue-700">📋 Admin Dashboard</h1>

        {loading ? (
          <p className="text-gray-500">🔄 Memuat campaign...</p>
        ) : pendingCampaigns.length === 0 ? (
          <p className="text-green-600">✅ Tidak ada campaign yang menunggu approval.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {pendingCampaigns.map((c) => (
              <div key={c.address} className="bg-white rounded-xl shadow p-4 border">
                <img src={c.image} alt={c.title} className="w-full h-32 object-cover rounded-md mb-3" />
                <h2 className="text-xl font-bold text-gray-800 mb-1">{c.title}</h2>
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">{c.description}</p>
                <p className="text-xs text-gray-500 mb-1">🎯 Target: {c.goal} STT</p>
                <p className="text-xs text-gray-400 mb-2 font-mono truncate">👤 {c.creator}</p>
                <Link href={`/campaign/${c.address}`}>
                  <p className="text-blue-600 text-xs hover:underline mb-2">Lihat Detail</p>
                </Link>
                <button
                  onClick={() => handleApprove(c.address)}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded mt-auto w-full"
                >
                  ✅ Approve Campaign
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
