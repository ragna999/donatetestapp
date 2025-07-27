'use client';

import React from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';

export default function Navbar() {
  const { user, authenticated, ready, login, logout } = usePrivy();

  if (!ready) return null; // Hindari render sebelum Privy siap

  return (
    <nav className="bg-gray-100 px-6 py-4 flex justify-between items-center border-b border-gray-300">
      <Link href="/" className="text-xl font-bold text-black">
        Donation Platform
      </Link>

      {authenticated ? (
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm text-gray-800">
            {user?.wallet?.address?.slice(0, 6)}...
            {user?.wallet?.address?.slice(-4)}
          </span>

          <Link
            href="/profile"
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
          >
            Profile
          </Link>

          <button
            onClick={logout}
            className="bg-gray-300 hover:bg-gray-400 text-black px-3 py-1 rounded"
          >
            Logout
          </button>
        </div>
      ) : (
        <button
          onClick={login}
          className="bg-black text-white px-4 py-2 rounded"
        >
          Connect Wallet
        </button>
      )}
    </nav>
  );
}
