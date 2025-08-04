'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ethers } from 'ethers';
import { usePrivy } from '@privy-io/react-auth';

export default function Navbar() {
  const { user, authenticated, ready, login, logout } = usePrivy();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const shortAddress = user?.wallet?.address
    ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
    : '';

  const ADMIN_ADDRESS = '0x0F3338210B2ae25089F9b9984Ba017eB596f1F9E';
  const ADMIN_ABI = [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "newAdmin",
          "type": "address"
        }
      ],
      "name": "AdminAdded",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "removedAdmin",
          "type": "address"
        }
      ],
      "name": "AdminRemoved",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "oldOwner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "OwnershipTransferred",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newAdmin",
          "type": "address"
        }
      ],
      "name": "addAdmin",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "isAdmin",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "admin",
          "type": "address"
        }
      ],
      "name": "removeAdmin",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "transferOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ]
  

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user?.wallet?.address) return;

      try {
        const provider = new ethers.JsonRpcProvider('https://rpc.ankr.com/somnia_testnet/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26');
        const contract = new ethers.Contract(ADMIN_ADDRESS, ADMIN_ABI, provider);
        const result = await contract.isAdmin(user.wallet.address);
        setIsAdmin(result);
      } catch (err) {
        console.warn('Gagal cek admin:', err);
        setIsAdmin(false);
      }
    };

    if (authenticated) checkAdmin();
  }, [authenticated, user?.wallet?.address]);

  if (!ready) return null;

  return (
    <nav className="bg-gradient-to-br from-white via-gray-100 to-gray-200 border-b border-gray-300 shadow-sm px-4 py-3">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        <Link href="/" className="text-2xl font-extrabold text-blue-700 tracking-tight">
          🌱Donatree
        </Link>

        {/* Burger menu (mobile) */}
        <button onClick={() => setIsOpen(!isOpen)} className="sm:hidden focus:outline-none">
          <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Desktop menu */}
        <div className="hidden sm:flex items-center gap-3">
          {authenticated ? (
            <>
              <span className="bg-gray-200 text-xs text-gray-800 font-mono px-3 py-1 rounded-full border border-gray-400 shadow-inner">
                {shortAddress}
              </span>
              {isAdmin ? (
                <Link
                  href="/admin"
                  className="bg-green-600 text-white px-4 py-1.5 rounded-full text-sm shadow"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/profile"
                  className="bg-blue-500 text-white px-4 py-1.5 rounded-full text-sm shadow"
                >
                  Profile
                </Link>
              )}
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
              className="bg-blue-600 text-white px-5 py-2 rounded-full text-sm hover:brightness-105"
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
              {isAdmin ? (
                <Link
                  href="/admin"
                  className="block bg-green-600 text-white px-4 py-2 rounded-full text-sm"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/profile"
                  className="block bg-blue-500 text-white px-4 py-2 rounded-full text-sm"
                >
                  Profile
                </Link>
              )}
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
              className="w-full bg-blue-600 text-white px-5 py-2 rounded-full text-sm hover:brightness-105"
            >
              Connect Wallet
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
