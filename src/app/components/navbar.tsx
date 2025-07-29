'use client';

import React from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';

export default function Navbar() {
  const { user, authenticated, ready, login, logout } = usePrivy();

  if (!ready) return null;

  const shortAddress = user?.wallet?.address
    ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
    : '';

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
      <Link href="/" className="text-2xl font-bold text-blue-700 tracking-tight">
        💠 DonasiChain
      </Link>

      {authenticated ? (
        <div className="flex items-center gap-3">
          {/* Wallet badge */}
          <span className="bg-gray-100 text-xs text-gray-800 font-mono px-3 py-1 rounded-full border border-gray-300 shadow-inner">
            {shortAddress}
          </span>

          {/* Profile */}
          <Link
            href="/profile"
            className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-4 py-1.5 rounded-full text-sm transition-all shadow"
          >
            Profile
          </Link>

          {/* Logout */}
          <button
            onClick={logout}
            className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-1.5 rounded-full transition-all"
          >
            Logout
          </button>
        </div>
      ) : (
        <button
          onClick={login}
          className="bg-black text-white px-5 py-2 rounded-full text-sm hover:bg-gray-900 transition-all"
        >
          Connect Wallet
        </button>
      )}
    </nav>
  );
}
