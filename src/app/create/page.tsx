
'use client';

import React, { useState } from 'react';
import { ethers } from 'ethers';
import { usePrivy } from '@privy-io/react-auth';

const FACTORY_ADDRESS = '0xc0f6b1ebc432574fd52164fee02cdb8d78a7d25f';
const FACTORY_ABI = [
  {
    inputs: [
      { internalType: 'string', name: '_title', type: 'string' },
      { internalType: 'string', name: '_description', type: 'string' },
      { internalType: 'uint256', name: '_goal', type: 'uint256' },
    ],
    name: 'createCampaign',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

export default function CreateCampaignPage() {
  const { user, ready, authenticated, login } = usePrivy();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);

  if (!ready) return <p className="text-center mt-10">⏳ Loading...</p>;

  if (!authenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center">
        <p className="mb-4 text-lg">Kamu belum login</p>
        <button onClick={login} className="bg-black text-white px-5 py-2 rounded">
          🔐 Connect Wallet
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (typeof window === 'undefined' || !window.ethereum)
        throw new Error('Wallet tidak ditemukan');

      const provider = new ethers.BrowserProvider(window.ethereum!);


      const signer = await provider.getSigner();

      const contract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      const goalInWei = ethers.parseEther(goal);

      const tx = await contract.createCampaign(title, desc, goalInWei);
      await tx.wait();

      alert('✅ Kampanye berhasil dibuat!');
      setTitle('');
      setDesc('');
      setGoal('');
    } catch (err: any) {
      console.error('Error:', err);
      alert(`❌ Gagal membuat campaign: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
        🚀 Buat Kampanye Donasi
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1 text-gray-700">Judul Kampanye</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-700">Deskripsi</label>
          <textarea
            rows={4}
            className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-700">Target Dana (ETH)</label>
          <input
            type="number"
            step="any"
            className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-semibold transition"
        >
          {loading ? '⏳ Mengirim...' : '✨ Buat Kampanye'}
        </button>
      </form>
    </div>
  );
}
