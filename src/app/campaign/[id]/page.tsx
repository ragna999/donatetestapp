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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🚀 Fetching campaign:', id);
        if (!id || !ethers.isAddress(id)) return;

        // 🔍 Gunakan read-only provider biar aman di DApp browser
        const provider = new ethers.JsonRpcProvider(
          'https://rpc.ankr.com/eth_sepolia/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26'
        );

        const contract = new Contract(id, CAMPAIGN_ABI, provider);
        const [title, description, goal, totalDonated, creator, donationsRaw] = await Promise.all([
          contract.title(),
          contract.description(),
          contract.goal(),
          contract.totalDonated(),
          contract.creator(),
          contract.getDonations(),
        ]);

        const donations = Array.isArray(donationsRaw)
          ? donationsRaw.map((d: any) => ({
              donor: d.donor,
              amount: ethers.formatEther(d.amount),
            }))
          : [];

        setData({
          title,
          description,
          goal: ethers.formatEther(goal),
          raised: ethers.formatEther(totalDonated),
          creator,
          donations,
        });

        setReady(true);

        // Coba deteksi wallet (opsional, untuk tampilkan tombol withdraw)
        if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
          try {
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            const signer = await browserProvider.getSigner();
            const signerAddress = await signer.getAddress();
            setCurrentAccount(signerAddress);
            if (signerAddress.toLowerCase() === creator.toLowerCase()) {
              setIsOwner(true);
            }
          } catch (e) {
            console.warn('⚠️ Wallet belum connect, lanjut tanpa signer');
          }
        }
      } catch (err) {
        console.error('❌ Error fetching campaign detail:', err);
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
      alert('Donasi gagal');
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
      alert('Withdraw gagal');
      console.error(err);
    }
  };

  if (!ready) return <p className="p-6">Loading campaign...</p>;

  return (
  <div className="min-h-screen bg-white text-gray-900 p-6 max-w-3xl mx-auto" suppressHydrationWarning>
    <img
      src="https://placehold.co/600x300?text=Campaign"
      alt="banner"
      className="w-full h-64 object-cover rounded-lg shadow mb-6"
    />

    <h1 className="text-2xl font-bold mb-2">{data.title}</h1>
    <p className="mb-4 text-gray-300">{data.description}</p>

    <div className="mb-6">
      <p className="text-sm font-medium text-gray-400 mb-1">
        {data.raised} ETH raised of {data.goal} ETH
      </p>
      <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-green-400 to-lime-500 h-full transition-all"
          style={{ width: `${(Number(data.raised) / Number(data.goal)) * 100}%` }}
        />
      </div>
    </div>

    <p className="text-xs text-gray-500 mb-8 break-all font-mono">
      Address: <span className="text-blue-400">{id}</span>
    </p>

    {currentAccount && (
      <form onSubmit={handleDonate} className="mb-10">
        <label className="block text-sm font-medium mb-2 text-white">
          Jumlah Donasi (ETH)
        </label>
        <input
          type="number"
          step="any"
          value={donationAmount}
          onChange={(e) => setDonationAmount(e.target.value)}
          className="w-full px-4 py-3 rounded-md bg-black border border-gray-600 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Contoh: 0.01"
        />
        <button
          type="submit"
          className="mt-4 w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold rounded-md shadow hover:from-indigo-500 hover:to-blue-500 transition-all duration-200"
        >
          🚀 Donasi Sekarang
        </button>
      </form>
    )}

    {isOwner && (
      <button
        onClick={handleWithdraw}
        className="mb-10 w-full bg-gradient-to-r from-red-500 to-rose-600 text-white py-3 rounded-md hover:opacity-90 transition"
      >
        💸 Tarik Dana
      </button>
    )}

    <div>
      <h2 className="text-lg font-semibold mb-4">Riwayat Donasi</h2>
      <ul className="space-y-2">
        {data.donations.map((d: any, i: number) => (
          <li
            key={i}
            className="flex justify-between bg-white/10 p-3 rounded-lg border border-white/10 text-sm backdrop-blur-md"
          >
            <span className="font-mono text-gray-200">
              {d.donor.slice(0, 6)}...{d.donor.slice(-4)}
            </span>
            <span className="text-white">{d.amount} ETH</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

}
