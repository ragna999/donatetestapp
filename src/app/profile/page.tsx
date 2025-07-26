'use client';

import { usePrivy } from '@privy-io/react-auth';
import React from 'react';

export default function ProfilePage() {
  const { user, ready, authenticated, login } = usePrivy();

  if (!ready) return <p>Loading...</p>;
  if (!authenticated)
    return (
      <div className="p-6">
        <p className="mb-4">Kamu belum login!</p>
        <button
          onClick={login}
          className="bg-black text-white px-4 py-2 rounded"
        >
          Connect Wallet
        </button>
      </div>
    );

  const email = user?.email?.address;
 const emailVerified = (user?.email as any)?.isVerified;

  const twitter = user?.twitter?.username;

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow mt-10">
      <h1 className="text-2xl font-bold mb-4">Profile</h1>

      {/* Wallet */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">Wallet Address:</p>
        <p className="text-lg font-mono">{user?.wallet?.address}</p>
      </div>

      {/* Email */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">Email:</p>
        <p>{email || 'Belum menambahkan email'}</p>
        <p>Status: {emailVerified ? '✅ Verified' : '❌ Belum Terverifikasi'}</p>
      </div>

      {/* Twitter */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">Twitter:</p>
        <p>Status: {twitter ? `✅ @${twitter}` : '❌ Belum Terhubung'}</p>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => window.location.href = '/verify-email'}
        >
          Verifikasi Email
        </button>

        <button
          className="bg-sky-500 text-white px-4 py-2 rounded"
          onClick={() => window.location.href = '/link-twitter'}
        >
          Connect Twitter
        </button>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Kampanye Kamu</h2>
        <ul className="list-disc pl-5">
          <li>Bantu Korban Banjir</li>
          <li>Donasi Pendidikan Anak</li>
        </ul>
      </div>
    </div>
  );
}
