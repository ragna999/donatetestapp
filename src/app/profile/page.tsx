'use client';

import React from 'react';
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

  // Extract email safely
  const emailObj = typeof user?.email === 'object' && user.email !== null
    ? (user.email as { address: string; isVerified: boolean })
    : null;

  const emailAddress = emailObj?.address || '';
  const emailVerified = emailObj?.isVerified || false;

  const twitterUsername = user?.twitter?.username || '';
  const twitterVerified = !!twitterUsername;

  const emailStatus = emailVerified ? '✅ Terverifikasi' : '❌ Belum Terverifikasi';
  const twitterStatus = twitterVerified ? `✅ @${twitterUsername}` : '❌ Belum Terhubung';

  const canCreateCampaign = emailVerified && twitterVerified;

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-lg shadow-lg mt-12 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Profil Pengguna</h1>

      {/* Wallet */}
      <div>
        <p className="text-gray-600 text-sm">Wallet Address:</p>
        <p className="text-lg font-mono text-gray-800">{user?.wallet?.address}</p>
      </div>

      {/* Email Verification */}
{!emailVerified && (
  <button
    onClick={async () => {
      await linkEmail();
      setTimeout(() => router.refresh(), 1500); // ⏱ kasih waktu sync
    }}
    className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
  >
    Verifikasi Email
  </button>
)}


      {/* Twitter Connect */}
{!twitterVerified && (
  <button
    onClick={async () => {
      await linkTwitter();
      setTimeout(() => router.refresh(), 1500); // ⏱ delay biar update
    }}
    className="mt-2 bg-sky-500 text-white px-4 py-2 rounded hover:bg-sky-600"
  >
    Connect Twitter
  </button>
)}

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
