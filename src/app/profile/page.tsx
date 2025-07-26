'use client';

import React from 'react';
import { usePrivy } from '@privy-io/react-auth';

type EmailInfo = {
  address: string;
  isVerified: boolean;
};

export default function ProfilePage() {
  const {
    user,
    ready,
    authenticated,
    login,
    linkEmail,
    linkTwitter,
  } = usePrivy();

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

  const email = user?.email as EmailInfo | undefined;
  const twitter = user?.twitter;

  const emailStatus = email?.isVerified ? '✅ Verified' : '❌ Belum Terverifikasi';
  const twitterStatus = twitter?.username ? `✅ @${twitter.username}` : '❌ Belum Terhubung';

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow mt-10">
      <h1 className="text-2xl font-bold mb-4">Profile</h1>

      <div className="mb-4">
        <p className="text-sm text-gray-600">Wallet Address:</p>
        <p className="text-lg font-mono">{user?.wallet?.address}</p>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-600">Email:</p>
        <p>{email?.address || 'Belum menambahkan email'}</p>
        <p>Status: {emailStatus}</p>
        <button
          onClick={() => linkEmail()}
          className="mt-2 bg-blue-600 text-white px-4 py-2 rounded"
        >
          Verifikasi Email
        </button>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-600">Twitter:</p>
        <p>Status: {twitterStatus}</p>
        <button
          onClick={() => linkTwitter()}
          className="mt-2 bg-sky-500 text-white px-4 py-2 rounded"
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
