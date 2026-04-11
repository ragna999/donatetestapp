'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ethers } from 'ethers';
import { usePrivy } from '@privy-io/react-auth';
import { RPC, ADMIN_MANAGER_ADDRESS } from '../lib/config';

const ADMIN_ABI = [
  { name: 'isAdmin', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }] }
];

export default function Navbar() {
  const { user, authenticated, ready, login, logout } = usePrivy();
  const [isOpen,   setIsOpen]   = useState(false);
  const [isAdmin,  setIsAdmin]  = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const shortAddress = user?.wallet?.address
    ? `${user.wallet.address.slice(0, 6)}…${user.wallet.address.slice(-4)}`
    : '';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!authenticated || !user?.wallet?.address) return;
    (async () => {
      try {
        const provider  = new ethers.JsonRpcProvider(RPC);
        const contract  = new ethers.Contract(ADMIN_MANAGER_ADDRESS, ADMIN_ABI, provider);
        const result    = await contract.isAdmin(user.wallet!.address);
        setIsAdmin(result);
      } catch { setIsAdmin(false); }
    })();
  }, [authenticated, user?.wallet?.address]);

  if (!ready) return null;

  const navLinks = authenticated ? [
    { href: '/', label: 'Explore' },
    { href: '/campaign/history', label: 'Riwayat' },
  ] : [];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-[#060d1a]/95 backdrop-blur-xl border-b border-white/10 shadow-xl shadow-black/20' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-shadow">
              🌱
            </div>
            <span className="font-bold text-white text-lg tracking-tight">Donatree</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden sm:flex items-center gap-6">
            {navLinks.map(l => (
              <Link key={l.href} href={l.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                {l.label}
              </Link>
            ))}

            {authenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                  {shortAddress}
                </span>

                {isAdmin ? (
                  <Link href="/admin"
                    className="text-sm px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <Link href="/profile"
                    className="text-sm px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium shadow-lg shadow-indigo-500/20 transition-all"
                  >
                    Profile
                  </Link>
                )}

                <button onClick={logout}
                  className="text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-full transition-all"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button onClick={login}
                className="text-sm px-5 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium shadow-lg shadow-indigo-500/25 transition-all"
              >
                Connect Wallet
              </button>
            )}
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setIsOpen(!isOpen)} className="sm:hidden p-2 text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="sm:hidden bg-[#0d1526]/98 backdrop-blur-xl border-t border-white/10 px-4 py-4 space-y-3">
          {navLinks.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setIsOpen(false)}
              className="block text-sm text-gray-300 hover:text-white py-2"
            >
              {l.label}
            </Link>
          ))}
          {authenticated ? (
            <>
              <p className="text-xs font-mono text-gray-500 py-2">{shortAddress}</p>
              {isAdmin
                ? <Link href="/admin" onClick={() => setIsOpen(false)} className="block text-sm text-emerald-400 py-2">Dashboard Admin</Link>
                : <Link href="/profile" onClick={() => setIsOpen(false)} className="block text-sm text-indigo-400 py-2">Profile</Link>
              }
              <button onClick={() => { logout(); setIsOpen(false); }} className="block text-sm text-gray-400 py-2">Logout</button>
            </>
          ) : (
            <button onClick={() => { login(); setIsOpen(false); }}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm rounded-xl font-medium"
            >
              Connect Wallet
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
