'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const {
    user,
    ready,
    authenticated,
    login,
    linkTwitter,
    linkEmail,
  } = usePrivy() as ReturnType<typeof usePrivy> & {
    
  };

  const router = useRouter();

  if (!ready) return <p className="p-6 text-center">Loading...</p>;

  if (!authenticated) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4">Kamu belum login!</p>
        <button
          onClick={login}
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  // === Email ===
  const emailObj =
    typeof user?.email === 'object' && user.email !== null
      ? (user.email as { address: string; isVerified?: boolean })
      : null;

  const emailAddress = emailObj?.address || '';
  const emailVerified = emailObj?.isVerified ?? false;

  // === Twitter ===
  const twitterUsername = user?.twitter?.username || '';
  const twitterVerified = !!twitterUsername;

  const canCreateCampaign = emailVerified && twitterVerified;

  return (
    <div
      className="max-w-3xl mx-auto p-8 bg-white rounded-lg shadow-lg mt-12 space-y-6"
    >
      <h1 className="text-3xl font-bold text-gray-900">Profil Pengguna</h1>

      {/* Wallet */}
      <section>
        <label className="text-gray-600 text-sm">Wallet Address:</label>
        <p className="text-lg font-mono text-gray-800">{user?.wallet?.address}</p>
      </section>

      {/* Email */}
        <label className="text-gray-600 text-sm">Email:</label>
        <p className="text-gray-800">{emailAddress || 'Belum menambahkan email'}</p>
        <p className="text-sm">
          Status:{' '}
          <span className={`font-semibold ${emailVerified ? 'text-green-600' : 'text-red-600'}`}>
            {emailVerified ? `✅ ${emailAddress}` : '❌ Belum Terverifikasi'}
          </span>
        </p>

        {/* Tombol Verifikasi */}
        {!emailVerified && !emailAddress && (
          <button
            onClick={async () => {
              try {
                await linkEmail();        // buka popup
              } catch (err) {
                console.error('Gagal verifikasi email:', err);
              }
            }}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Verifikasi Email
          </button>
        )}

       {!emailVerified && !emailAddress && (
  <button
    onClick={async () => {
      try {
        await linkEmail();
        window.location.reload();
      } catch (err) {
        console.error('Gagal verifikasi email:', err);
      }
    }}
    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
  >
    Verifikasi Email
  </button>
)}

{!emailVerified && emailAddress && (
  <button
    onClick={() => window.location.reload()}
    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
  >
    Cek Status Verifikasi
  </button>
)}


      {/* Twitter */}
        <label className="text-gray-600 text-sm">Twitter:</label>
        <p className="text-sm">
          Status:{' '}
          <span className={`font-semibold ${twitterVerified ? 'text-green-600' : 'text-red-600'}`}>
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
    className="mt-2 bg-sky-500 text-white px-4 py-2 rounded hover:bg-sky-600"
  >
    Connect Twitter
  </button>
)}


      {/* CTA */}
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
