'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';

export default function Navbar() {
  const { user, authenticated, ready, login, logout } = usePrivy();
  const [isOpen, setIsOpen] = useState(false);

  if (!ready) return null;

  const shortAddress = user?.wallet?.address
    ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
    : '';

  return (
    <nav className="bg-gradient-to-br from-white via-gray-100 to-gray-200 border-b border-gray-300 shadow-sm px-4 py-3">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="text-2xl font-extrabold text-blue-700 tracking-tight">
        🌱Donatree
        </Link>

        {/* Hamburger button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="sm:hidden focus:outline-none"
        >
          <svg
            className="w-6 h-6 text-gray-800"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Menu (desktop) */}
        <div className="hidden sm:flex items-center gap-3">
          {authenticated ? (
            <>
              <span className="bg-gray-200 text-xs text-gray-800 font-mono px-3 py-1 rounded-full border border-gray-400 shadow-inner">
                {shortAddress}
              </span>
              <Link
                href="/profile"
                className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-1.5 rounded-full text-sm transition-all shadow"
              >
                Profile
              </Link>
              <button
                onClick={logout}
                className="text-sm bg-white hover:bg-gray-100 border border-gray-400 text-gray-700 px-4 py-1.5 rounded-full"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={login}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-full text-sm hover:brightness-105"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="sm:hidden mt-4 space-y-2">
          {authenticated ? (
            <>
              <p className="text-sm text-gray-700 font-mono px-2">{shortAddress}</p>
              <Link
                href="/profile"
                className="block bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-full text-sm"
              >
                Profile
              </Link>
              <button
                onClick={logout}
                className="block w-full text-left bg-white hover:bg-gray-100 border border-gray-400 text-gray-700 px-4 py-2 rounded-full text-sm"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={login}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-full text-sm hover:brightness-105"
            >
              Connect Wallet
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
