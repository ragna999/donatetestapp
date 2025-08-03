'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ethers, Contract } from 'ethers';
import { usePrivy } from '@privy-io/react-auth';

const CAMPAIGN_ABI = [
  { name: 'title', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'description', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'image', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'goal', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDonated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'creator', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'location', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'deadline', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'social', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'donate', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    name: 'getDonations',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{
      type: 'tuple[]',
      components: [
        { name: 'donor', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
    }],
  }
];

const CampaignDetailPage = () => {
  const { user, authenticated } = usePrivy();
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaign = async () => {
      if (!authenticated || !user) return;
      if (!id || typeof id !== 'string' || !ethers.isAddress(id)) {
        setError('❌ Address tidak valid');
        return;
      }

      try {
        const provider = new ethers.JsonRpcProvider(
          'https://rpc.ankr.com/somnia_testnet/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26'
        );
        const contract = new Contract(id, CAMPAIGN_ABI, provider);

        const [
          title, description, image, goal, totalDonated, creator,
          location, deadline, social, donationsRaw
        ] = await Promise.all([
          contract.title(),
          contract.description(),
          contract.image(),
          contract.goal(),
          contract.totalDonated(),
          contract.creator(),
          contract.location(),
          contract.deadline(),
          contract.social(),
          contract.getDonations()
        ]);

        const donations = donationsRaw.map((d: any) => ({
          donor: d.donor,
          amount: ethers.formatEther(d.amount),
        }));

        setData({
          title,
          description,
          image,
          goal: ethers.formatEther(goal),
          raised: ethers.formatEther(totalDonated),
          creator,
          location,
          deadline: Number(deadline),
          social,
          donations
        });
      } catch (err: any) {
        console.error('❌ Gagal ambil data campaign:', err);
        setError('Gagal ambil data dari blockchain. Mungkin contract address salah atau ABI tidak cocok.');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [id, authenticated, user]);

  if (loading) return <div className="p-6 text-white">⏳ Loading campaign...</div>;
  if (error) return <div className="p-6 text-red-400">{error}</div>;
  if (!data) return <div className="p-6 text-gray-400">❌ Tidak ada data campaign</div>;

  return (
    <div className="p-6 text-white max-w-3xl mx-auto">
      <img src={data.image} alt="banner" className="rounded-lg mb-4 w-full h-64 object-cover" />
      <h1 className="text-2xl font-bold mb-2">{data.title}</h1>
      <p className="text-gray-300 mb-4">{data.description}</p>
      <p className="text-sm text-yellow-300 mb-2">🎯 Target: {data.goal} STT</p>
      <p className="text-sm text-green-300 mb-2">💰 Terkumpul: {data.raised} STT</p>
      <p className="text-sm text-gray-400 mb-2">📍 Lokasi: {data.location}</p>
      <p className="text-sm text-gray-400 mb-2">🕒 Deadline: {new Date(data.deadline * 1000).toLocaleString()}</p>
      <p className="text-sm text-blue-400 mb-2">
        🔗 Sosial Media:{' '}
        <a href={data.social} target="_blank" rel="noopener noreferrer" className="underline">{data.social}</a>
      </p>
      <p className="text-sm text-purple-400 mt-6">👤 Creator: {data.creator}</p>
    </div>
  );
};

export default CampaignDetailPage;
