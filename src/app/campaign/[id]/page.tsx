// Updated CampaignDetailPage.tsx with correct ABI
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ethers, Contract } from 'ethers';

const CAMPAIGN_ABI = 
	[
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "_adminContract",
					"type": "address"
				}
			],
			"stateMutability": "nonpayable",
			"type": "constructor"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "campaignAddress",
					"type": "address"
				}
			],
			"name": "CampaignApproved",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "campaignAddress",
					"type": "address"
				},
				{
					"indexed": false,
					"internalType": "address",
					"name": "creator",
					"type": "address"
				}
			],
			"name": "CampaignCreated",
			"type": "event"
		},
		{
			"inputs": [],
			"name": "adminContract",
			"outputs": [
				{
					"internalType": "address",
					"name": "",
					"type": "address"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "_campaign",
					"type": "address"
				}
			],
			"name": "approveCampaign",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "",
					"type": "address"
				}
			],
			"name": "campaignToCreator",
			"outputs": [
				{
					"internalType": "address",
					"name": "",
					"type": "address"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"name": "campaigns",
			"outputs": [
				{
					"internalType": "address",
					"name": "",
					"type": "address"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "string",
					"name": "_title",
					"type": "string"
				},
				{
					"internalType": "string",
					"name": "_desc",
					"type": "string"
				},
				{
					"internalType": "string",
					"name": "_image",
					"type": "string"
				},
				{
					"internalType": "uint256",
					"name": "_goal",
					"type": "uint256"
				},
				{
					"internalType": "string",
					"name": "_location",
					"type": "string"
				},
				{
					"internalType": "uint256",
					"name": "_duration",
					"type": "uint256"
				},
				{
					"internalType": "string",
					"name": "_social",
					"type": "string"
				}
			],
			"name": "createCampaign",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "getAllCampaigns",
			"outputs": [
				{
					"internalType": "address[]",
					"name": "",
					"type": "address[]"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "getApprovedCampaigns",
			"outputs": [
				{
					"internalType": "address[]",
					"name": "result",
					"type": "address[]"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "",
					"type": "address"
				}
			],
			"name": "isApproved",
			"outputs": [
				{
					"internalType": "bool",
					"name": "",
					"type": "bool"
				}
			],
			"stateMutability": "view",
			"type": "function"
		}
	]

export default function CampaignDetailPage() {
  const params = useParams();
  const id = params?.id as string;

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
        const provider = new ethers.JsonRpcProvider(
          'https://rpc.ankr.com/somnia_testnet/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26'
        );

        const bytecode = await provider.getCode(id);
        if (bytecode === '0x') throw new Error('Invalid contract address');

        const contract = new Contract(id, CAMPAIGN_ABI, provider);

        const [
          title,
          description,
          image,
          goal,
          totalDonated,
          creator,
          location,
          deadline,
          donationsRaw,
          social
        ] = await Promise.all([
          contract.title(),
          contract.description(),
          contract.image(),
          contract.goal(),
          contract.totalDonated(),
          contract.creator(),
          contract.location(),
          contract.deadline(),
          contract.getDonations(),
          contract.social()
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
          image,
          goal: ethers.formatEther(goal),
          raised: ethers.formatEther(totalDonated),
          creator,
          location,
          deadline: Number(deadline),
          social,
          donations,
        });

        setReady(true);

        const commentsKey = `commentsHash_${id}`;
        const hash = localStorage.getItem(commentsKey);
        if (hash) {
          try {
            const result = await fetchCommentsFromIPFS(hash);
            setComments(result);
          } catch (err) {
            console.warn('❌ Gagal load komentar:', err);
          }
        }

        if (typeof window !== 'undefined' && window.ethereum) {
          const browserProvider = new ethers.BrowserProvider(window.ethereum);
          const signer = await browserProvider.getSigner();
          const signerAddress = await signer.getAddress();
          setCurrentAccount(signerAddress);
          if (signerAddress.toLowerCase() === creator.toLowerCase()) {
            setIsOwner(true);
          }
        }
      } catch (err) {
        console.error('❌ Error fetching campaign detail:', err);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!data?.deadline) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = data.deadline * 1000 - now;

      if (diff <= 0) {
        setTimeLeft('⏱️ Campaign telah selesai');
        clearInterval(interval);
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${days}h ${hours}j ${minutes}m ${seconds}s`);
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

  if (!ready || !data) return <p className="p-6 text-white">Loading campaign...</p>;

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

    {currentAccount && (
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
    )}

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
