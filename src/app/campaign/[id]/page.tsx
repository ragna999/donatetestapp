'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ethers, Contract } from 'ethers';

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
          { name: 'amount', type: 'uint256' }
        ]
      }
    ]
  },
  { name: 'requests', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [
    { name: 'amount', type: 'uint256' },
    { name: 'reason', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'status', type: 'uint8' }
  ]},
  { name: 'donate', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] }
];

export default function CampaignDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const [data, setData] = useState<any>(null);
  const [donationAmount, setDonationAmount] = useState('');
  const [currentAccount, setCurrentAccount] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [ready, setReady] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!id || !ethers.isAddress(id)) throw new Error('Invalid address');

        const provider = new ethers.JsonRpcProvider('https://rpc.ankr.com/somnia_testnet/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26');
        const contract = new Contract(id, CAMPAIGN_ABI, provider);

        const [title, description, image, goal, raised, creator, location, deadline, social, donationsRaw] = await Promise.all([
          contract.title(),
          contract.description(),
          contract.image(),
          contract.goal(),
          contract.totalDonated(),
          contract.creator(),
          contract.location(),
          contract.deadline(),
          contract.social(),
          contract.getDonations(),
        ]);

        const now = Math.floor(Date.now() / 1000);
        const isFinished = now > Number(deadline) || BigInt(raised) >= BigInt(goal);

        const donations = donationsRaw.map((d: any) => ({
          donor: d.donor,
          amount: ethers.formatEther(d.amount),
        }));

        // fetch withdrawal requests
        const withdraws: any[] = [];
        let i = 0;
        while (true) {
          try {
            const r = await contract.requests(i);
            withdraws.push({
              amount: ethers.formatEther(r.amount),
              reason: r.reason,
              timestamp: Number(r.timestamp),
              status: Number(r.status),
            });
            i++;
          } catch (err) {
            break;
          }
        }

        setWithdrawals(withdraws);

        setData({
          title,
          description,
          image,
          goal: ethers.formatEther(goal),
          raised: ethers.formatEther(raised),
          creator,
          location,
          deadline: Number(deadline),
          social,
          donations,
          isFinished,
        });

        if (window.ethereum) {
          const browserProvider = new ethers.BrowserProvider(window.ethereum);
          const signer = await browserProvider.getSigner();
          const address = await signer.getAddress();
          setCurrentAccount(address);
          if (address.toLowerCase() === creator.toLowerCase()) {
            setIsOwner(true);
          }
        }

        setReady(true);
      } catch (err) {
        console.error('❌ fetchData error:', err);
      }
    };

    fetchData();
  }, [id]);

  const handleDonate = async (e: any) => {
    e.preventDefault();
    if (!window.ethereum || !donationAmount) return;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new Contract(id, CAMPAIGN_ABI, signer);
    try {
      const tx = await contract.donate({ value: ethers.parseEther(donationAmount) });
      await tx.wait();
      window.location.reload();
    } catch {
      alert('Donasi gagal');
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
    } catch {
      alert('Withdraw gagal');
    }
  };

  if (!ready || !data) return <p className="text-white p-6">Loading...</p>;

  const hasApprovedWithdraw = withdrawals.some((w) => w.status === 1);

  return (
    <div className="p-6 text-white max-w-2xl mx-auto">
      <img src={data.image} alt="cover" className="w-full h-64 object-cover rounded mb-4" />
      <h1 className="text-2xl font-bold mb-1">{data.title}</h1>
      <p className="text-gray-300 mb-4">{data.description}</p>

      <p className="text-sm mb-2">📍 {data.location}</p>
      <p className="text-sm mb-2">⏳ Deadline: {new Date(data.deadline * 1000).toLocaleString()}</p>
      <p className="text-sm mb-4">🔗 <a href={data.social} className="text-blue-400 underline">{data.social}</a></p>

      <div className="mb-4">
        <p className="text-xs text-emerald-300">💰 {data.raised} STT dari {data.goal} STT</p>
        <div className="h-2 bg-gray-600 rounded-full">
          <div
            className="h-full bg-green-400 rounded-full"
            style={{ width: `${(Number(data.raised) / Number(data.goal)) * 100}%` }}
          ></div>
        </div>
      </div>

      {!data.isFinished && currentAccount && (
        <form onSubmit={handleDonate} className="mb-6">
          <input
            type="number"
            step="any"
            value={donationAmount}
            onChange={(e) => setDonationAmount(e.target.value)}
            className="w-full p-3 rounded bg-gray-800 border border-gray-700 mb-2"
            placeholder="Jumlah Donasi (STT)"
          />
          <button className="w-full bg-blue-600 py-2 rounded text-white">🚀 Donasi Sekarang</button>
        </form>
      )}

      {isOwner && hasApprovedWithdraw && (
        <button onClick={handleWithdraw} className="w-full mb-6 bg-red-500 py-2 rounded text-white">
          💸 Tarik Dana (Approved)
        </button>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-bold mb-2">📤 Riwayat Permintaan Withdraw</h2>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada request.</p>
        ) : (
          <ul className="space-y-2">
            {withdrawals.map((r, i) => (
              <li key={i} className="bg-gray-800 p-3 rounded border border-gray-700">
                <p className="font-semibold text-white">{r.amount} STT - {r.reason}</p>
                <p className="text-xs text-gray-400">{new Date(r.timestamp * 1000).toLocaleString()}</p>
                <p className="text-xs">
                  {r.status === 0 ? '🟡 Pending' : r.status === 1 ? '✅ Approved' : '❌ Denied'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
