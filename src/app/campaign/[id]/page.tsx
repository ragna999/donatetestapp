'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ethers, Contract } from 'ethers';

const CAMPAIGN_ABI = [
  {
    name: 'title',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'description',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'goal',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalDonated',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'creator',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'donate',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'getBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'donations',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
];


export default function CampaignDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  if (!id || !ethers.isAddress(id)) {
  return <p className="p-6 text-red-600">❌ Alamat campaign tidak valid.</p>;
  }

  const [data, setData] = useState<any>(null);
  const [donationAmount, setDonationAmount] = useState('');
  const [currentAccount, setCurrentAccount] = useState('');
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!window.ethereum) return;

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      setCurrentAccount(userAddress);

      const campaign = new Contract(id, CAMPAIGN_ABI, provider);

      const [title, description, goal, totalDonated, owner, donations] = await Promise.all([
        campaign.title(),
        campaign.description(),
        campaign.goal(),
        campaign.totalDonated(),
        campaign.owner(),
        campaign.getDonations(),
      ]);

      setData({
        title,
        description,
        goal: ethers.formatEther(goal),
        raised: ethers.formatEther(totalDonated),
        owner,
        donations: donations.map((d: any) => ({
          donor: d.donor,
          amount: ethers.formatEther(d.amount),
        })),
      });

      setIsOwner(userAddress.toLowerCase() === owner.toLowerCase());
    };

    fetchData();
  }, [id]);

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.ethereum || !donationAmount) return;

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new Contract(id, CAMPAIGN_ABI, signer);

    try {
      const tx = await contract.donate({ value: ethers.parseEther(donationAmount) });
      await tx.wait();
      window.location.reload(); // simple refresh
    } catch (err) {
      alert('Donasi gagal.');
      console.error(err);
    }
  };

  const handleWithdraw = async () => {
    if (!window.ethereum) return;

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new Contract(id, CAMPAIGN_ABI, signer);

    try {
      const tx = await contract.withdraw();
      await tx.wait();
      window.location.reload();
    } catch (err) {
      alert('Withdraw gagal.');
      console.error(err);
    }
  };

  if (!data) return <p className="p-6">Loading...</p>;

  return (
    <div className="min-h-screen bg-gray-100 p-6 max-w-3xl mx-auto text-gray-900">
      <img src={`https://via.placeholder.com/600x300`} alt="banner" className="w-full h-64 object-cover rounded mb-6" />
      <h1 className="text-2xl font-bold mb-2">{data.title}</h1>
      <p className="mb-4">{data.description}</p>

      <div className="mb-4">
        <p className="text-sm font-medium">
          {data.raised} ETH raised of {data.goal} ETH
        </p>
        <div className="w-full bg-gray-200 h-2 rounded-full">
          <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(Number(data.raised) / Number(data.goal)) * 100}%` }}></div>
        </div>
      </div>

      <p className="text-xs text-gray-600 mb-4">Campaign Address: {id}</p>

      <form onSubmit={handleDonate} className="mb-6">
        <label className="block mb-1 text-sm text-gray-700">Jumlah Donasi (ETH)</label>
        <input
          type="number"
          value={donationAmount}
          onChange={(e) => setDonationAmount(e.target.value)}
          className="w-full px-4 py-2 border rounded mb-2"
          placeholder="Masukkan jumlah donasi"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Donasi Sekarang
        </button>
      </form>

      {isOwner && (
        <button onClick={handleWithdraw} className="mb-6 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
          Tarik Dana
        </button>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-2">Riwayat Donasi</h2>
        <ul className="space-y-2">
          {data.donations.map((d: any, idx: number) => (
            <li key={idx} className="flex justify-between bg-white p-3 rounded shadow text-gray-800">
              <span>{d.donor.slice(0, 6)}...{d.donor.slice(-4)}</span>
              <span>{d.amount} ETH</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

//test debug
try {
  // semua fetch Promise di sini
} catch (err) {
  console.error('❌ Gagal fetch campaign data:', err);
}
