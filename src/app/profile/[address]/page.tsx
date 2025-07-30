'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Contract, ethers } from 'ethers';
import Link from 'next/link';

const FACTORY_ADDRESS = '0x7800BC9175383c47876Ce4cf4C6Fb947281d6187';

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
  { name: 'image', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }, // ✅ tambahkan ini
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
            const [creator, title, description, image, goal, raised] = await Promise.all([
  c.creator(),
  c.title(),
  c.description(),
  c.image(), // ✅ ambil gambar
  c.goal(),
  c.totalDonated(),
]);


            if (creator.toLowerCase() !== address.toLowerCase()) return null;

            return {
  address: addr,
  title,
  description,
  image, // ✅ simpan
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
    <div className="min-h-screen bg-gray-900 text-white p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
        <span>👤</span> Profil Penyelenggara
      </h1>
      <p className="mb-8 text-sm text-gray-400">
        Wallet:{' '}
        <a
          href={`https://sepolia.etherscan.io/address/${address}`}
          className="text-blue-400 hover:underline break-all font-mono"
        >
          {address}
        </a>
      </p>

      <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2">
        <span>📂</span> Kampanye yang Dibuat
      </h2>

      {loading ? (
        <p className="text-gray-400">🔄 Sedang memuat kampanye...</p>
      ) : campaigns.length === 0 ? (
        <p className="text-gray-500">Belum ada kampanye.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {campaigns.map((c) => (
  <div
    key={c.address}
    className="bg-gray-800 border border-gray-700 p-5 rounded-xl shadow hover:shadow-lg transition"
  >
    {/* ✅ Gambar campaign */}
    {c.image && (
      <img
        src={c.image}
        alt={c.title}
        className="w-full h-32 object-cover rounded-md mb-3 border"
      />
    )}

    <h3 className="text-lg font-semibold text-white mb-1">{c.title}</h3>

              <p className="text-sm text-gray-300 mb-3 line-clamp-2">{c.description}</p>

              <div className="mb-2">
                <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-400 to-lime-400 h-full"
                    style={{ width: `${(Number(c.raised) / Number(c.goal)) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  💰 {c.raised} ETH dari {c.goal} ETH
                </p>
              </div>

              <Link href={`/campaign/${c.address}`}>
                <button className="w-full mt-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-md text-sm hover:from-blue-500 hover:to-indigo-500 transition">
                  Lihat Detail →
                </button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
