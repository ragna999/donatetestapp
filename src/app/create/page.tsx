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
      if (!eth) return alert('❌ Wallet tidak ditemukan di browser');

      // WAJIB: Pastikan wallet terkoneksi
      await eth.request({ method: 'eth_requestAccounts' });

      const provider = new ethers.BrowserProvider(eth);
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
      alert('Gagal membuat campaign: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Buat Kampanye Donasi</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Judul Kampanye</label>
          <input
            type="text"
            className="w-full border px-4 py-2 rounded"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Deskripsi</label>
          <textarea
            className="w-full border px-4 py-2 rounded"
            rows={4}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Target Dana (ETH)</label>
          <input
            type="number"
            className="w-full border px-4 py-2 rounded"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? 'Mengirim...' : 'Buat Kampanye'}
        </button>
      </form>
    </div>
  );
}
