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
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-lg shadow-lg mt-12 space-y-6">

      <h1 className="text-3xl font-bold text-gray-900">Profil Pengguna</h1>

{/* Wallet */}
<div>
  <p className="text-gray-600 text-sm">Wallet Address:</p>
  <p className="text-lg font-mono text-gray-800">{user?.wallet?.address}</p>
</div>

{/* Email */}
<div>
  <p className="text-gray-600 text-sm">Email:</p>
  <p className="text-gray-800">{email?.address || 'Belum menambahkan email'}</p>
  <p className="text-sm">Status: <span className="font-semibold">{emailStatus}</span></p>
  <button
    onClick={() => linkEmail()}
    className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
  >
    Verifikasi Email
  </button>
</div>

{/* Twitter */}
<div>
  <p className="text-gray-600 text-sm">Twitter:</p>
  <p className="text-sm">Status: <span className="font-semibold">{twitterStatus}</span></p>
  <button
    onClick={() => linkTwitter()}
    className="mt-2 bg-sky-500 text-white px-4 py-2 rounded hover:bg-sky-600"
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
