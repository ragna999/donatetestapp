'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ethers, Contract } from 'ethers';

const CAMPAIGN_ABI = [
  { name: 'title', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'description', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'goal', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDonated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'creator', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    name: 'getDonations',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'donor', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
    ],
  },
  { name: 'donate', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
];

export default function CampaignDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [donationAmount, setDonationAmount] = useState('');
  const [currentAccount, setCurrentAccount] = useState('');
  const [isOwner, setIsOwner] = useState(false);
 

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🚀 Mulai fetch detail campaign');

        if (!id || !ethers.isAddress(id)) {
          console.error('❌ Alamat campaign tidak valid:', id);
          return;
        }

        const hasWallet = typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
        let provider: ethers.Provider;
        let signerAddress = '';

        if (hasWallet) {
          console.log('🦊 Menggunakan wallet sebagai provider');
          const browserProvider = new ethers.BrowserProvider(window.ethereum!);
          provider = browserProvider;
          const signer = await browserProvider.getSigner();
          signerAddress = await signer.getAddress();
          setCurrentAccount(signerAddress);
        } else {
          console.log('🌐 Menggunakan RPC publik');
          provider = new ethers.JsonRpcProvider('https://rpc.ankr.com/eth_sepolia/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26');
        }

        const campaign = new Contract(id, CAMPAIGN_ABI, provider);

        const [title, description, goal, totalDonated, creator, donationsRaw] = await Promise.all([
          campaign.title(),
          campaign.description(),
          campaign.goal(),
          campaign.totalDonated(),
          campaign.creator(),
          campaign.getDonations(),
        ]);

        const donations = Array.isArray(donationsRaw)
          ? donationsRaw.map((d: any) => ({
              donor: d.donor,
              amount: ethers.formatEther(d.amount),
            }))
          : [];

        const campaignData = {
          title,
          description,
          goal: ethers.formatEther(goal),
          raised: ethers.formatEther(totalDonated),
          creator,
          banner: '',
          donations,
        };

        setData(campaignData);
        

        if (signerAddress) {
          setIsOwner(signerAddress.toLowerCase() === creator.toLowerCase());
        }
      } catch (err) {
        console.error('❌ Gagal ambil detail campaign:', err);
      }
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
      window.location.reload();
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
    <div suppressHydrationWarning className="min-h-screen bg-gray-100 p-6 max-w-3xl mx-auto text-gray-900">
      <img
        src={data.banner || 'https://placehold.co/600x300?text=No+Image'}
        alt="banner"
        className="w-full h-64 object-cover rounded mb-6"
      />

      <h1 className="text-2xl font-bold mb-2">{data.title}</h1>
      <p className="mb-4">{data.description}</p>

      <div className="mb-4">
        <p className="text-sm font-medium">
          {data.raised} ETH raised of {data.goal} ETH
        </p>
        <div className="w-full bg-gray-200 h-2 rounded-full">
          <div
            className="bg-green-500 h-full"
            style={{ width: `${(Number(data.raised) / Number(data.goal)) * 100}%` }}
          ></div>
        </div>
      </div>

      <p className="text-xs text-gray-600 mb-4">Campaign Address: {id}</p>

      {currentAccount && (
  <form onSubmit={handleDonate}>
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
      )}

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
