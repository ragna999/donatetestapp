'use client';

import { useEffect, useState } from 'react';
import { ethers, Contract } from 'ethers';
import Link from 'next/link';
import { RPC, FACTORY_ADDRESS } from './lib/config';

type CampaignData = {
  address: string;
  title: string;
  description: string;
  image: string;
  goal: string;
  raised: string;
  deadline: number;
  isFinished: boolean;
  cancelled: boolean;
};

const FACTORY_ABI = [
  { name: 'getApprovedCampaigns', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]', name: '' }] },
];

const CAMPAIGN_ABI = [
  { name: 'title',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'description',  type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'image',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'goal',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDonated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'deadline',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'cancelled',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
];

export default function HomePage() {
  const [campaigns,        setCampaigns]        = useState<CampaignData[]>([]);
  const [historyCampaigns, setHistoryCampaigns] = useState<CampaignData[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [expanded,         setExpanded]         = useState<Record<string, boolean>>({});
  const [imgErrors,        setImgErrors]        = useState<Record<string, boolean>>({});
  const [showHistory,      setShowHistory]      = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const provider = new ethers.JsonRpcProvider(RPC);
        const factory  = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
        const addresses: string[] = await factory.getApprovedCampaigns();

        const results = await Promise.all(
          addresses.map(async (addr) => {
            const c = new Contract(addr, CAMPAIGN_ABI, provider);
            const [title, description, image, goal, raised, deadline, cancelled] = await Promise.all([
              c.title(), c.description(), c.image(), c.goal(), c.totalDonated(), c.deadline(), c.cancelled(),
            ]);
            const now        = Math.floor(Date.now() / 1000);
            const isFinished = cancelled || now > Number(deadline) || BigInt(raised) >= BigInt(goal);
            return {
              address: addr, title, description, image,
              goal: ethers.formatEther(goal),
              raised: ethers.formatEther(raised),
              deadline: Number(deadline),
              isFinished,
              cancelled,
            };
          })
        );

        setCampaigns(results.filter(c => !c.isFinished));
        setHistoryCampaigns(results.filter(c => c.isFinished));
      } catch (err) {
        console.error('❌ Gagal ambil data campaign:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#060d1a] text-white">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-6 pt-20 pb-24 text-center">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Berjalan di Ethereum Sepolia Testnet
          </span>

          <h1 className="text-4xl md:text-6xl font-bold mb-5 leading-tight">
            Donasi Transparan,{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Terverifikasi Blockchain
            </span>
          </h1>

          <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
            Setiap donasi tercatat permanen di blockchain. Tidak ada manipulasi, tidak ada keraguan.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/create"
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02]"
            >
              + Buat Kampanye
            </Link>
            <a href="#campaigns"
              className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all"
            >
              Lihat Kampanye ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="border-y border-white/10 bg-white/[0.02] px-6 py-6 mb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-3 divide-x divide-white/10 text-center gap-2 sm:gap-0">
          <div className="px-2 sm:px-4">
            <p className="text-lg sm:text-2xl font-bold text-white">{campaigns.length}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Kampanye Aktif</p>
          </div>
          <div className="px-2 sm:px-4">
            <p className="text-lg sm:text-2xl font-bold text-white">
              {campaigns.reduce((s, c) => s + Number(c.raised), 0).toFixed(3)}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-1">ETH Terkumpul</p>
          </div>
          <div className="px-2 sm:px-4">
            <p className="text-lg sm:text-2xl font-bold text-white">100%</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Transparan On-chain</p>
          </div>
        </div>
      </section>

      {/* ── Campaign Grid ── */}
      <section id="campaigns" className="max-w-7xl mx-auto px-6 pb-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Kampanye Aktif</h2>
          {!loading && campaigns.length > 0 && (
            <span className="text-xs text-gray-500">{campaigns.length} kampanye ditemukan</span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-44 bg-white/5" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-white/5 rounded-full w-3/4" />
                  <div className="h-3 bg-white/5 rounded-full w-full" />
                  <div className="h-3 bg-white/5 rounded-full w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <p className="text-4xl mb-4">🌿</p>
            <p className="text-lg font-medium text-gray-400">Belum ada kampanye aktif</p>
            <p className="text-sm mt-2">Jadilah yang pertama membuat kampanye</p>
            <Link href="/create" className="inline-block mt-6 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm transition">
              Buat Kampanye
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((c) => {
              const pct = Math.min(100, Number(c.goal) > 0 ? (Number(c.raised) / Number(c.goal)) * 100 : 0);
              const daysLeft = Math.max(0, Math.ceil((c.deadline * 1000 - Date.now()) / 86400000));
              return (
                <div key={c.address}
                  className="group flex flex-col bg-[#0d1526] border border-white/10 rounded-2xl overflow-hidden hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300"
                >
                  {/* Image */}
                  <div className="relative h-44 overflow-hidden bg-gradient-to-br from-indigo-900/50 to-purple-900/50">
                    {c.image && !imgErrors[c.address] ? (
                      <img
                        src={c.image} alt={c.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={() => setImgErrors(p => ({ ...p, [c.address]: true }))}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">🌱</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d1526] to-transparent opacity-60" />
                    <div className="absolute bottom-3 left-3">
                      <span className="text-xs bg-black/50 backdrop-blur text-gray-300 px-2 py-1 rounded-full border border-white/10">
                        ⏳ {daysLeft} hari lagi
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-col flex-1 p-5">
                    <h3 className="font-bold text-white text-base mb-2 line-clamp-1">{c.title}</h3>

                    <p className={`text-sm text-gray-400 mb-3 ${expanded[c.address] ? '' : 'line-clamp-2'}`}>
                      {c.description}
                    </p>
                    {c.description.length > 100 && (
                      <button onClick={() => setExpanded(p => ({ ...p, [c.address]: !p[c.address] }))}
                        className="text-xs text-indigo-400 hover:text-indigo-300 mb-3 text-left"
                      >
                        {expanded[c.address] ? 'Lebih sedikit ↑' : 'Selengkapnya ↓'}
                      </button>
                    )}

                    {/* Progress */}
                    <div className="mt-auto">
                      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                        <span className="text-white font-semibold">{Number(c.raised).toFixed(4)} ETH</span>
                        <span>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">dari {c.goal} ETH</p>
                    </div>

                    <Link href={`/campaign/${c.address}`} className="mt-4">
                      <button className="w-full py-2.5 bg-white/5 hover:bg-indigo-600 border border-white/10 hover:border-indigo-500 text-white text-sm font-medium rounded-xl transition-all duration-200">
                        Lihat Detail →
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── History ── */}
      {!loading && historyCampaigns.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-16">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition mb-4"
          >
            <span>{showHistory ? '▾' : '▸'}</span>
            <span>Riwayat Kampanye ({historyCampaigns.length})</span>
          </button>

          {showHistory && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {historyCampaigns.map((c) => {
                const pct      = Math.min(100, Number(c.goal) > 0 ? (Number(c.raised) / Number(c.goal)) * 100 : 0);
                const goalMet  = BigInt(Math.round(Number(c.raised) * 1e18)) >= BigInt(Math.round(Number(c.goal) * 1e18));
                const statusLabel = c.cancelled ? { text: 'Dibatalkan', cls: 'bg-red-500/80' }
                  : goalMet      ? { text: 'Selesai', cls: 'bg-green-500/80' }
                  :                { text: 'Berakhir', cls: 'bg-yellow-500/80 text-black' };
                return (
                  <div key={c.address}
                    className="flex flex-col bg-[#0d1526] border border-white/5 rounded-2xl overflow-hidden opacity-70 hover:opacity-90 transition-opacity"
                  >
                    <div className="relative h-44 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
                      {c.image && !imgErrors[c.address] ? (
                        <img
                          src={c.image} alt={c.title}
                          className="w-full h-full object-cover grayscale"
                          onError={() => setImgErrors(p => ({ ...p, [c.address]: true }))}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl opacity-10">🌱</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0d1526] to-transparent opacity-70" />
                      <div className="absolute top-3 left-3">
                        <span className={`text-xs text-white px-2 py-1 rounded-full font-medium ${statusLabel.cls}`}>
                          {statusLabel.text}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col flex-1 p-5">
                      <h3 className="font-bold text-gray-300 text-base mb-3 line-clamp-1">{c.title}</h3>

                      <div className="mt-auto">
                        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                          <span>{Number(c.raised).toFixed(4)} ETH terkumpul</span>
                          <span>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-white/20"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">dari {c.goal} ETH</p>
                      </div>

                      <Link href={`/campaign/${c.address}`} className="mt-4">
                        <button className="w-full py-2.5 bg-white/5 border border-white/10 text-gray-400 text-sm rounded-xl hover:text-white transition">
                          Lihat Detail →
                        </button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
