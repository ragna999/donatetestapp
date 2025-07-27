'use client';

import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const {
    user,
    ready,
    authenticated,
    login,
    linkEmail,
    linkTwitter,
  } = usePrivy();

  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0); // buat force re-render

  if (!ready) return <p>Loading...</p>;

  if (!authenticated) {
    return (
      <div className="p-6">
        <p className="mb-4">Kamu belum login!</p>
        <button onClick={login} className="bg-black text-white px-4 py-2 rounded">
          Connect Wallet
        </button>
      </div>
    );
  }

  // Extract email info
  const emailObj = typeof user?.email === 'object' && user.email !== null
    ? (user.email as { address: string; isVerified: boolean })
    : null;

  const emailAddress = emailObj?.address || '';
  const emailVerified = emailObj?.isVerified || false;

  // Extract twitter info
  const twitterUsername = user?.twitter?.username || '';
  const twitterVerified = !!twitterUsername;

  const emailStatus = emailVerified ? '✅ Terverifikasi' : '❌ Belum Terverifikasi';
  const twitterStatus = twitterVerified ? `✅ @${twitterUsername}` : '❌ Belum Terhubung';

  const canCreateCampaign = emailVerified && twitterVerified;

  return (
    <div key={refreshKey} className="max-w-3xl mx-auto p-8 bg-white rounded-lg shadow-lg mt-12 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Profil Pengguna</h1>

      {/* Wallet */}
      <div>
        <p className="text-gray-600 text-sm">Wallet Address:</p>
        <p className="text-lg font-mono text-gray-800">{user?.wallet?.address}</p>
      </div>

      {/* Email */}
      <div>
        <p className="text-gray-600 text-sm">Email:</p>
        <p className="text-gray-800">{emailAddress || 'Belum menambahkan email'}</p>
        <p className="text-sm">
          Status:{' '}
          <span className={`font-semibold ${emailVerified ? 'text-green-600' : 'text-red-600'}`}>
            {emailStatus}
          </span>
        </p>
        {!emailVerified && (
          <button
            onClick={async () => {
              await linkEmail();
              setTimeout(() => setRefreshKey((prev) => prev + 1), 1500);
            }}
            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Verifikasi Email
          </button>
        )}
      </div>

      {/* Twitter */}
      <div>
        <p className="text-gray-600 text-sm">Twitter:</p>
        <p className="text-sm">
          Status:{' '}
          <span className={`font-semibold ${twitterVerified ? 'text-green-600' : 'text-red-600'}`}>
            {twitterStatus}
          </span>
        </p>
        {!twitterVerified && (
          <button
            onClick={async () => {
              await linkTwitter();
              setTimeout(() => setRefreshKey((prev) => prev + 1), 1500);
            }}
            className="mt-2 bg-sky-500 text-white px-4 py-2 rounded hover:bg-sky-600"
          >
            Connect Twitter
          </button>
        )}
      </div>

      {/* Tombol Buat Kampanye */}
      {canCreateCampaign && (
        <div className="pt-4">
          <button
            onClick={() => router.push('/create')}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            ➕ Buat Kampanye Donasi
          </button>
        </div>
      )}
    </div>
  );
}
