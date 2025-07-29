'use client';

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
  } = usePrivy();

  const router = useRouter();

  if (!ready) return <p className="p-6 text-center text-white">Loading...</p>;

  if (!authenticated) {
    return (
      <div className="p-6 text-center text-white">
        <p className="mb-4">Kamu belum login!</p>
        <button
          onClick={login}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  const emailObj =
    typeof user?.email === 'object' && user.email !== null
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
            <button
              onClick={async () => {
                try {
                  await linkEmail();
                } catch (err) {
                  console.error('Gagal verifikasi email:', err);
                }
              }}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              Verifikasi Email
            </button>
          )}

          {!emailVerified && emailAddress && (
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
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

        {/* CTA */}
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
    </div>
  );
}
