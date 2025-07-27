'use client';

import React, { useState } from 'react';
import { ethers } from 'ethers';

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
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    const eth = (window as any).ethereum;
    if (!eth) return alert('❌ Wallet tidak ditemukan');

    let selectedProvider = eth;
    if (eth.providers?.length) {
      const metamask = eth.providers.find((p: any) => p.isMetaMask);
      if (!metamask) return alert('❌ MetaMask tidak ditemukan');
      selectedProvider = metamask;
    }

    await selectedProvider.request({ method: 'eth_requestAccounts' });

    const provider = new ethers.BrowserProvider(selectedProvider);
    const signer = await provider.getSigner();
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);

    const goalInWei = ethers.parseEther(goal);

    const tx = await factory.createCampaign(title, desc, goalInWei);
    await tx.wait();

    alert('✅ Kampanye berhasil dibuat!');
    setTitle('');
    setDesc('');
    setGoal('');
  } catch (err: any) {
    console.error(err);
    alert('❌ Gagal membuat campaign: ' + (err.message || err));
  } finally {
    setLoading(false);
  }
};


 return (
  <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded shadow text-gray-800">
    <h1 className="text-2xl font-bold mb-6 text-center">🚀 Buat Kampanye Donasi</h1>
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Judul Kampanye</label>
        <input
          type="text"
          className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
        <textarea
          className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Target Dana (ETH)</label>
        <input
          type="number"
          step="any"
          className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className={`w-full py-2 px-4 rounded text-white font-semibold transition ${
          loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {loading ? '⏳ Mengirim...' : '✨ Buat Kampanye'}
      </button>
    </form>
  </div>
);
}