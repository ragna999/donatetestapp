'use client';

import React, { useState } from 'react';
import { ethers } from 'ethers';
import { uploadToPinata } from '../utils/uploadToPinata';

const FACTORY_ADDRESS = '0x3e1F1004f267c47D17486AAaceA432311A662c83';

const CAMPAIGN_ABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_campaign",
				"type": "address"
			}
		],
		"name": "approveCampaign",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_adminContract",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "campaignAddress",
				"type": "address"
			}
		],
		"name": "CampaignApproved",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "campaignAddress",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "creator",
				"type": "address"
			}
		],
		"name": "CampaignCreated",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_title",
				"type": "string"
			},
			{ "internalType": "string", 
			"name": "_social", 
			"type": "string" },
			{
				"internalType": "string",
				"name": "_desc",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_image",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "_goal",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "_location",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "_duration",
				"type": "uint256"
			}
		],
		"name": "createCampaign",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "adminContract",
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
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "campaigns",
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
				"name": "",
				"type": "address"
			}
		],
		"name": "campaignToCreator",
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
		"inputs": [],
		"name": "getAllCampaigns",
		"outputs": [
			{
				"internalType": "address[]",
				"name": "",
				"type": "address[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getApprovedCampaigns",
		"outputs": [
			{
				"internalType": "address[]",
				"name": "result",
				"type": "address[]"
			}
		],
		"stateMutability": "view",
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
		"name": "isApproved",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]


export default function CreateCampaignPage() {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [goal, setGoal] = useState('');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [social, setSocial] = useState('');
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

  // ...
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
  
    try {
      const eth = (window as any).ethereum;
      if (!eth) return alert('❌ Wallet tidak ditemukan');
  
      const accounts = await eth.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) {
        await eth.request({ method: 'eth_requestAccounts' });
      }
	  
	  if (!social || !social.startsWith('http')) {
		alert('❌ Masukkan link sosial media yang valid!');
		setLoading(false);
		return;
	  }
	  
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const factory = new ethers.Contract(FACTORY_ADDRESS, CAMPAIGN_ABI, signer);

      const goalInWei = ethers.parseEther(goal);
      const durationInSeconds = parseInt(duration) * 86400;
  
      const tx = await factory.createCampaign(
		title,
		social,         // ✅ di posisi ke-2
		desc,
		imageUrl || '',
		goalInWei,
		location,
		durationInSeconds
	  );
	  
	  
  
      await tx.wait();
      alert('✅ Kampanye berhasil dibuat!');
      // reset form...
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
        {/* Title */}
<Input label="Judul Kampanye" value={title} onChange={setTitle} loading={loading} />

{/* Description */}
<TextArea label="Deskripsi" value={desc} onChange={setDesc} loading={loading} />

{/* Target */}
<Input label="Target Dana (STT)" value={goal} onChange={setGoal} loading={loading} type="number" />

{/* Lokasi */}
<Input label="Lokasi Penerima/Bencana" value={location} onChange={setLocation} loading={loading} />

{/* Durasi */}
<Input label="Durasi Kampanye (hari)" value={duration} onChange={setDuration} loading={loading} type="number" />

{/* Sosial Media */}
<Input label="Link Sosial Media (Twitter/Linktree)" value={social} onChange={setSocial} loading={loading} />

{/* Gambar */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Upload Gambar</label>
  <input
    type="file"
    accept="image/*"
    onChange={handleImageUpload}
    disabled={uploading || loading}
    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
      file:rounded file:border-0 file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
  />
  {uploading && <p className="text-sm text-blue-400 mt-2">Uploading to IPFS...</p>}
  {imageUrl && <img src={imageUrl} alt="Preview" className="mt-4 rounded-md w-full h-56 object-cover border" />}
</div>

        {/* Submit */}
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

function Input({ label, value, onChange, loading, type = 'text' }: any) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        disabled={loading}
      />
    </div>
  );
}

function TextArea({ label, value, onChange, loading }: any) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <textarea
        className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        disabled={loading}
      />
    </div>
  );
}
