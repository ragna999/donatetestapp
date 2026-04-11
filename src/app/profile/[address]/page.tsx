'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Contract, ethers } from 'ethers';
import Link from 'next/link';
import { RPC, FACTORY_ADDRESS } from '../../lib/config';

const FACTORY_ABI = [
  { name: 'getAllCampaigns',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  { name: 'campaignToCreator', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }] },
];

const CAMPAIGN_ABI = [
  { name: 'title',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'description',  type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'image',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'goal',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDonated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'creator',      type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'deadline',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
];

export default function OrganizerProfilePage() {
  const params  = useParams();
  const address = typeof params?.address === 'string' ? params.address : '';

  const [campaigns,  setCampaigns]  = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [social,     setSocial]     = useState<{ twitter: string | null; email: string | null }>({ twitter: null, email: null });
  const [imgErrors,  setImgErrors]  = useState<Record<string, boolean>>({});

  // Fetch social info dari Privy via API route
  useEffect(() => {
    if (!address || !ethers.isAddress(address)) return;
    fetch(`/api/user-social/${address}`)
      .then(r => r.json())
      .then(data => setSocial(data))
      .catch(() => {});
  }, [address]);

  // Fetch campaigns
  useEffect(() => {
    if (!address || !ethers.isAddress(address)) return;
    (async () => {
      try {
        const provider = new ethers.JsonRpcProvider(RPC);
        const factory  = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
        const all: string[] = await factory.getAllCampaigns();

        const rows = await Promise.all(
          all.map(async (addr) => {
            try {
              const c = new Contract(addr, CAMPAIGN_ABI, provider);
              const [creator, title, description, image, goal, raised, deadline] = await Promise.all([
                c.creator(), c.title(), c.description(), c.image(), c.goal(), c.totalDonated(), c.deadline(),
              ]);
              if (creator.toLowerCase() !== address.toLowerCase()) return null;
              const isFinished = Math.floor(Date.now() / 1000) > Number(deadline) || BigInt(raised) >= BigInt(goal);
              return { address: addr, title, description, image, goal: ethers.formatEther(goal), raised: ethers.formatEther(raised), isFinished };
            } catch { return null; }
          })
        );

        setCampaigns(rows.filter(Boolean));
      } catch (err) {
        console.error('Gagal fetch campaign:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [address]);

  if (!address || !ethers.isAddress(address)) {
    return (
      <div className="min-h-screen bg-[#060d1a] flex items-center justify-center text-white">
        <p className="text-gray-400">Alamat tidak valid.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060d1a] text-white">

      {/* Header */}
      <div className="bg-gradient-to-b from-[#0d1526] to-transparent border-b border-white/10 px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/30 shrink-0">
              👤
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold mb-1">Profil Penyelenggara</h1>
              <a
                href={`https://sepolia.etherscan.io/address/${address}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs font-mono text-indigo-400 hover:text-indigo-300 break-all"
              >
                {address}
              </a>

              {/* Social badges */}
              <div className="flex flex-wrap gap-2 mt-3">
                {social.twitter ? (
                  <span className="flex items-center gap-1.5 text-xs bg-sky-500/10 border border-sky-500/20 text-sky-400 px-3 py-1 rounded-full">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.26 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
                    </svg>
                    @{social.twitter}
                    <span className="text-sky-600">✓</span>
                  </span>
                ) : (
                  <span className="text-xs bg-white/5 border border-white/10 text-gray-500 px-3 py-1 rounded-full">
                    Twitter tidak terhubung
                  </span>
                )}

                {social.email ? (
                  <span className="flex items-center gap-1.5 text-xs bg-green-500/10 border border-green-500/20 text-green-400 px-3 py-1 rounded-full">
                    ✉️ {social.email}
                    <span className="text-green-600">✓</span>
                  </span>
                ) : (
                  <span className="text-xs bg-white/5 border border-white/10 text-gray-500 px-3 py-1 rounded-full">
                    Email tidak terhubung
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Kampanye yang Dibuat</h2>
          {!loading && <span className="text-xs text-gray-500">{campaigns.length} kampanye</span>}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[#0d1526] border border-white/10 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-36 bg-white/5" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-white/5 rounded-full w-3/4" />
                  <div className="h-3 bg-white/5 rounded-full w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20 bg-[#0d1526] border border-white/10 rounded-2xl">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-gray-400 text-sm">Belum ada kampanye yang dibuat</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {campaigns.map((c) => {
              const pct = Math.min(100, Number(c.goal) > 0 ? (Number(c.raised) / Number(c.goal)) * 100 : 0);
              return (
                <div key={c.address}
                  className="bg-[#0d1526] border border-white/10 hover:border-indigo-500/40 rounded-2xl overflow-hidden transition-all group"
                >
                  <div className="relative h-36 bg-gradient-to-br from-indigo-900/30 to-purple-900/30">
                    {c.image && !imgErrors[c.address] ? (
                      <img src={c.image} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={() => setImgErrors(p => ({ ...p, [c.address]: true }))} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">🌱</div>
                    )}
                    {c.isFinished && (
                      <div className="absolute top-2 right-2">
                        <span className="text-xs bg-red-500/80 text-white px-2 py-0.5 rounded-full">Selesai</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-white text-sm line-clamp-1 mb-1">{c.title}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">{c.description}</p>

                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1.5">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mb-3">
                      <span>{c.raised} ETH</span>
                      <span>{pct.toFixed(0)}% dari {c.goal} ETH</span>
                    </div>

                    <Link href={`/campaign/${c.address}`}>
                      <button className="w-full py-2 text-xs bg-white/5 hover:bg-indigo-600 border border-white/10 hover:border-indigo-500 text-gray-300 hover:text-white rounded-xl transition-all">
                        Lihat Detail →
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
