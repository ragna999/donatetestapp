// Final FIXED CampaignDetailPage.tsx — ABI matched with DonationCampaign
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
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!id || !ethers.isAddress(id)) throw new Error('Invalid address');

        const provider = new ethers.JsonRpcProvider('https://rpc.ankr.com/somnia_testnet/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26');
        const code = await provider.getCode(id);
        if (code === '0x') throw new Error('Address is not a contract');

        const contract = new Contract(id, CAMPAIGN_ABI, provider);

        const title = await contract.title();
        const description = await contract.description();
        const image = await contract.image();
        const goal = await contract.goal();
        const totalDonated = await contract.totalDonated();
        const creator = await contract.creator();
        const location = await contract.location();
        const deadline = await contract.deadline();
        const social = await contract.social();
        const donationsRaw = await contract.getDonations();

        const donations = donationsRaw.map((d: any) => ({
          donor: d.donor,
          amount: ethers.formatEther(d.amount),
          
        }));
        const now = Math.floor(Date.now() / 1000);
        const isFinished = now > Number(deadline) || totalDonated >= goal;


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
          donations,
          isFinished, // ✅ ini penting
        });
        

        setReady(true);

        if (window.ethereum) {
          const browserProvider = new ethers.BrowserProvider(window.ethereum);
          const signer = await browserProvider.getSigner();
          const address = await signer.getAddress();
          setCurrentAccount(address);
          if (address.toLowerCase() === creator.toLowerCase()) {
            setIsOwner(true);
          }
        }

// FETCH withdrawal requests
const withdrawals: any[] = [];
let index = 0;
while (true) {
  try {
    const req = await contract.requests(index);
    withdrawals.push({
      amount: ethers.formatEther(req.amount),
      reason: req.reason,
      timestamp: Number(req.timestamp),
      status: Number(req.status), // 0 = Pending, 1 = Approved, 2 = Denied
    });
    index++;
  } catch (err) {
    break;
  }
}


        const hash = localStorage.getItem(`commentsHash_${id}`);
        if (hash) {
          const res = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`);
          const parsed = await res.json();
          setComments(parsed);
        }

      } catch (err) {
        console.error('❌ fetchData error:', err);
      }
    };

    fetchData();
  }, [id]);

  useEffect(() => {
    if (!data?.deadline) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = data.deadline * 1000 - now;
      if (diff <= 0) {
        setTimeLeft('⏱️ Campaign telah selesai');
        clearInterval(interval);
      } else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${d}h ${h}j ${m}m ${s}s`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [data?.deadline]);

  const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT!;

  async function uploadCommentsToIPFS(comments: any[]) {
    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: PINATA_JWT,
      },
      body: JSON.stringify({
        pinataMetadata: { name: 'donatree-comments' },
        pinataContent: comments,
      }),
    });
    if (!res.ok) throw new Error('Gagal upload komentar ke IPFS');
    const data = await res.json();
    return data.IpfsHash;
  }

  async function fetchCommentsFromIPFS(hash: string) {
    const res = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`);
    if (!res.ok) throw new Error('Gagal fetch komentar dari IPFS');
    return await res.json();
  }

  if (data?.isFinished) {
    alert("Campaign sudah selesai. Donasi ditutup.");
    return;
  }
  
  async function handleDonate(e: React.FormEvent) {
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
    }
  }

  async function handleWithdraw() {
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
    }
  }

  if (!ready || !data) {
    console.log('📛 Masih loading: ready =', ready, 'data =', data);
    return !ready || !data ? <p className="p-6 text-white">Loading campaign...</p>:(
      <div className="min-h-screen text-white p-6">✅ Ready: {data.title}</div>
  );
  }
  

return (
  <div className="min-h-screen bg-gray-900 text-white p-6 max-w-3xl mx-auto" suppressHydrationWarning>
    {data?.image ? (
      <img
        src={data.image}
        alt={data.title || 'Campaign'}
        className="w-full h-64 object-cover rounded-lg shadow mb-6"
      />
    ) : (
      <img
        src="https://placehold.co/600x300?text=Campaign"
        alt="default"
        className="w-full h-64 object-cover rounded-lg shadow mb-6"
      />
    )}

    <h1 className="text-2xl font-bold mb-2">{data?.title || 'Tanpa Judul'}</h1>
    <p className="mb-4 text-gray-300">{data?.description || 'Tidak ada deskripsi.'}</p>

    {data?.location && (
      <p className="text-sm text-gray-400 mb-1">📍 Lokasi: {data.location}</p>
    )}
    {data?.deadline && (
  <p className="text-sm text-yellow-300 mb-1">⏳ Waktu tersisa: {timeLeft}</p>
    )}

    {data?.social && (
      <p className="text-sm text-blue-400 mb-6">
        🔗 Sosmed:{' '}
        <a href={data.social} target="_blank" rel="noopener noreferrer" className="underline">
          {data.social}
        </a>
      </p>
    )}

    <div className="mb-6">
      <p className="text-sm font-medium text-gray-400 mb-1">
        {data.raised} STT dari {data.goal} STT
      </p>
      <div className="w-full bg-gray-700 h-3 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-green-400 to-lime-400 h-full transition-all"
          style={{
            width: `${(Number(data.raised) / Number(data.goal)) * 100}%`
          }}
        />
      </div>
    </div>

    <p className="text-sm text-purple-300 mb-6">
      👤 Diselenggarakan oleh:{' '}
      <a
        href={`/profile/${data.creator}`}
        className="hover:underline break-all font-mono text-blue-400"
      >
        {data.creator}
      </a>
    </p>

    <p className="text-xs text-gray-500 mb-8 break-all font-mono">
      Address: <span className="text-blue-500">{id}</span>
    </p>

    {currentAccount && !data?.isFinished ? (
  <form onSubmit={handleDonate} className="mb-10">
    <label className="block text-sm font-medium mb-2 text-gray-300">Jumlah Donasi (STT)</label>
    <input
      type="number"
      step="any"
      value={donationAmount}
      onChange={(e) => setDonationAmount(e.target.value)}
      className="w-full px-4 py-3 rounded-md bg-gray-800 border border-gray-700 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="Contoh: 0.01"
    />
    <button
      type="submit"
      className="mt-4 w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-md hover:from-blue-500 hover:to-indigo-500 transition-all duration-200"
    >
      🚀 Donasi Sekarang
    </button>
  </form>
) : currentAccount && data?.isFinished ? (
  <div className="mb-10 text-sm text-red-400 font-medium">
    ⛔ Campaign ini telah selesai. Donasi tidak tersedia.
  </div>
) : null}



    {isOwner && (
      <button
        onClick={handleWithdraw}
        className="mb-10 w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-md hover:opacity-90 transition"
      >
        💸 Tarik Dana
      </button>
    )}

    <div>
      <h2 className="text-lg font-semibold mb-4">Riwayat Donasi</h2>
      <ul className="space-y-2">
        {data?.donations?.map((d: any, i: number) => (
          <li
            key={i}
            className="flex justify-between bg-gray-800 p-3 rounded-lg border border-gray-700 text-sm"
          >
            <span className="font-mono text-gray-300">
              {d.donor.slice(0, 6)}...{d.donor.slice(-4)}
            </span>
            <span className="text-lime-400 font-semibold">{d.amount} STT</span>
          </li>
        ))}
      </ul>
    </div>
    <div className="mt-16">
  <h2 className="text-lg font-semibold mb-4">📤 Permintaan Penarikan Dana</h2>



  <ul className="space-y-3">
    {data?.withdrawals?.length > 0 ? (
      data.withdrawals.map((r: any, i: number) => (
        <li
          key={i}
          className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm flex flex-col gap-1"
        >
          <div className="text-white font-semibold">
            💸 {r.amount} STT — <span className="text-gray-400 italic">{r.reason}</span>
          </div>
          <div className="text-xs text-gray-400">
            🕒 {new Date(r.timestamp * 1000).toLocaleString()}
          </div>
          <div>
            {r.status === 0 && (
              <span className="text-yellow-400 font-mono">🟡 Pending</span>
            )}
            {r.status === 1 && (
              <span className="text-green-400 font-mono">✅ Approved</span>
            )}
            {r.status === 2 && (
              <span className="text-red-400 font-mono">❌ Denied</span>
            )}
          </div>
        </li>
      ))
    ) : (
      <p className="text-sm text-gray-500">Belum ada permintaan withdrawal.</p>
    )}
  </ul>
</div>
      
      <div className="mt-12">
  <h2 className="text-lg font-semibold mb-4">💬 Komentar</h2>

  {comments.length === 0 ? (
    <p className="text-gray-500 text-sm mb-4">Belum ada komentar.</p>
  ) : (
    <ul className="space-y-3 mb-6">
      {comments.map((c, i) => (
        <li key={i} className="bg-gray-800 p-3 rounded border border-gray-700 text-sm">
          <div className="text-xs text-gray-400 mb-1 font-mono">
            {c.author.slice(0, 6)}...{c.author.slice(-4)} • {new Date(c.timestamp).toLocaleString()}
          </div>
          <p className="text-white">{c.text}</p>
        </li>
      ))}
    </ul>
  )}

  {currentAccount && (
    <div className="mt-4">
      <textarea
        className="w-full p-3 bg-gray-800 text-white rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={3}
        placeholder="Tulis komentar..."
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
      />
      <button
        className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold"
        onClick={async () => {
          if (!newComment.trim()) return;

          const nextComments = [
            ...comments,
            {
              author: currentAccount,
              text: newComment.trim(),
              timestamp: Date.now(),
            },
          ];

          try {
            const hash = await uploadCommentsToIPFS(nextComments);
            localStorage.setItem(`commentsHash_${id}`, hash);
            setComments(nextComments);
            setNewComment('');
          } catch (err) {
            alert('Gagal upload komentar');
            console.error(err);
          }
        }}
      >
        Kirim Komentar
      </button>
    </div>
  )}
</div>



    </div>
  );
}
