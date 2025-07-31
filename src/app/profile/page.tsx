'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { ethers, Contract } from 'ethers';
import Link from 'next/link';

const FACTORY_ADDRESS = '0xbdc6284b97146954ed8938a627de9dec42f65e60';
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
  { name: 'image', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'goal', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDonated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'creator', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
];

export default function ProfilePage() {
  const { user, ready, authenticated, login, linkTwitter, linkEmail } = usePrivy();
  const router = useRouter();

  const [userCampaigns, setUserCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [expanded, setExpanded] = useState<{ [addr: string]: boolean }>({});

  const toggleDesc = (addr: string) => {
    setExpanded((prev) => ({
      ...prev,
      [addr]: !prev[addr],
    }));
  };

  useEffect(() => {
    const fetchUserCampaigns = async () => {
      if (!user?.wallet?.address) return;

      const provider = new ethers.JsonRpcProvider('https://rpc.ankr.com/somnia_testnet/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26');
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const allAddresses: string[] = await factory.getCampaigns();

      const filtered = await Promise.all(
        allAddresses.map(async (addr) => {
          try {
            const c = new Contract(addr, CAMPAIGN_ABI, provider);
            const [creator, title, description, image, goal, raised] = await Promise.all([
              c.creator(),
              c.title(),
              c.description(),
              c.image(),
              c.goal(),
              c.totalDonated(),
            ]);
            if (!user?.wallet?.address) return null;
            if (creator.toLowerCase() !== user.wallet.address.toLowerCase()) return null;

            return {
              address: addr,
              title,
              description,
              image,
              goal: ethers.formatEther(goal),
              raised: ethers.formatEther(raised),
            };
          } catch {
            return null;
          }
        })
      );

      setUserCampaigns(filtered.filter(Boolean));
      setLoadingCampaigns(false);
    };

    if (authenticated) fetchUserCampaigns();
  }, [authenticated, user]);

  if (!ready) return <p className="p-6 text-center text-white">Loading...</p>;

  if (!authenticated) {
    return (
      <div className="p-6 text-center text-white">
        <p className="mb-4">Kamu belum login!</p>
        <button onClick={login} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded">
          Connect Wallet
        </button>
      </div>
    );
  }

  const emailObj = typeof user?.email === 'object' && user.email !== null
    ? (user.email as { address: string; isVerified?: boolean })
    : null;

  const emailAddress = emailObj?.address || '';
  const emailVerified = !!emailAddress;
  const twitterUsername = user?.twitter?.username || '';
  const twitterVerified = !!twitterUsername;
  const canCreateCampaign = emailVerified && twitterVerified;

  return (
    <div className="min-h-screen bg-gray-900 text-white py-12 px-4">
      <div className="max-w-3xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg space-y-6">
        <h1 className="text-3xl font-bold">👤 Profil Pengguna</h1>

        {/* Wallet */}
        <section>
          <label className="text-sm text-gray-400">Wallet Address:</label>
          <p className="font-mono text-purple-300 break-all">{user?.wallet?.address}</p>
        </section>

        {/* Email */}
        <section>
          <label className="text-sm text-gray-400">Email:</label>
          <p className="text-white">{emailAddress || 'Belum menambahkan email'}</p>
          <p className="text-sm">
            Status:{' '}
            <span className={`font-semibold ${emailVerified ? 'text-green-400' : 'text-red-400'}`}>
              {emailVerified ? `✅ ${emailAddress}` : '❌ Belum Terverifikasi'}
            </span>
          </p>

          {!emailVerified && !emailAddress && (
            <button onClick={linkEmail} className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">
              Verifikasi Email
            </button>
          )}

          {!emailVerified && emailAddress && (
            <button onClick={() => window.location.reload()} className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">
              Cek Status Verifikasi
            </button>
          )}
        </section>

        {/* Twitter */}
        <section>
          <label className="text-sm text-gray-400">Twitter:</label>
          <p className="text-sm">
            Status:{' '}
            <span className={`font-semibold ${twitterVerified ? 'text-green-400' : 'text-red-400'}`}>
              {twitterVerified ? `✅ @${twitterUsername}` : '❌ Belum Terhubung'}
            </span>
          </p>

          {!twitterVerified && (
            <button
              onClick={async () => {
                try {
                  await linkTwitter();
                  await new Promise((r) => setTimeout(r, 1500));
                  window.location.reload();
                } catch (err) {
                  console.error('Gagal konek Twitter:', err);
                }
              }}
              className="mt-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded"
            >
              Connect Twitter
            </button>
          )}
        </section>

        {canCreateCampaign && (
          <div className="pt-4">
            <button
              onClick={() => router.push('/create')}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              ➕ Buat Kampanye Donasi
            </button>
          </div>
        )}
      </div>

      {/* Riwayat Kampanye */}
      <div className="max-w-5xl mx-auto mt-12">
        <h2 className="text-2xl font-bold mb-4">🗂 Riwayat Kampanye Anda</h2>

        {loadingCampaigns ? (
          <p className="text-gray-400">🔄 Memuat kampanye...</p>
        ) : userCampaigns.length === 0 ? (
          <p className="text-gray-500">Belum ada kampanye yang dibuat.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {userCampaigns.map((c) => (
              <div
                key={c.address}
                className="flex flex-col justify-between h-full bg-gray-800 border border-gray-700 p-4 rounded-lg"
              >
                <img
                  src={c.image || 'https://placehold.co/400x200?text=No+Image'}
                  alt={c.title}
                  className="w-full h-32 object-cover rounded mb-3"
                />

                <div className="flex-1 flex flex-col">
                  <h3 className="font-bold text-lg">{c.title}</h3>

                  {expanded[c.address] ? (
                    <p className="text-sm text-gray-400 mb-2">{c.description}</p>
                  ) : (
                    <p className="text-sm text-gray-400 mb-2 line-clamp-2">{c.description}</p>
                  )}

                  {c.description.length > 100 && (
                    <button
                      onClick={() => toggleDesc(c.address)}
                      className="text-xs text-blue-400 hover:underline mb-2 text-left"
                    >
                      {expanded[c.address] ? 'See less' : 'See more'}
                    </button>
                  )}

                  <p className="text-xs text-emerald-300 mt-auto">
                    💰 {c.raised} STT dari {c.goal} STT
                  </p>
                </div>

                <Link href={`/campaign/${c.address}`} className="mt-3">
                  <button className="w-full text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded">
                    Detail →
                  </button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
