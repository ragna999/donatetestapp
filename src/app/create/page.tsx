'use client';

import React, { useState } from 'react';
import { ethers } from 'ethers';
import { uploadToPinata } from '../utils/uploadToPinata';


const FACTORY_ADDRESS = '0x7800BC9175383c47876Ce4cf4C6Fb947281d6187';
const CAMPAIGN_ABI = [
  {
    inputs: [
      { internalType: 'string', name: '_title', type: 'string' },
      { internalType: 'string', name: '_description', type: 'string' },
      { internalType: 'string', name: '_image', type: 'string' }, // ✅ Tambahan
      { internalType: 'uint256', name: '_goal', type: 'uint256' },
    ],
    name: 'createCampaign',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getCampaigns',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'address', name: 'campaignAddress', type: 'address' },
      { indexed: false, internalType: 'address', name: 'creator', type: 'address' },
    ],
    name: 'CampaignCreated',
    type: 'event',
  },
];


export default function CreateCampaignPage() {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [goal, setGoal] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadToPinata(file);
      setImageUrl(url);
    } catch (err) {
      console.error('Upload gagal:', err);
      alert('❌ Upload gambar gagal');
    } finally {
      setUploading(false);
    }
  };

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
      const factory = new ethers.Contract(FACTORY_ADDRESS, CAMPAIGN_ABI, signer);

      const goalInWei = ethers.parseEther(goal);

      const tx = await factory.createCampaign(title, desc, goalInWei);
      await tx.wait();

      alert('✅ Kampanye berhasil dibuat!');
      setTitle('');
      setDesc('');
      setGoal('');
      setImageUrl(null);
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

        {/* Judul */}
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

        {/* Deskripsi */}
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

        {/* Target Dana */}
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

        {/* Upload Gambar */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Upload Gambar Campaign</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploading || loading}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0 file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {uploading && <p className="text-sm text-blue-400 mt-2">Uploading to IPFS...</p>}
          {imageUrl && (
            <img src={imageUrl} alt="Preview" className="mt-4 rounded-md w-full h-56 object-cover border" />
          )}
        </div>

        {/* Submit Button */}
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
