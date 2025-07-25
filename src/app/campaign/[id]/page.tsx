'use client';

import React from 'react';
import { useParams } from 'next/navigation';

export default function CampaignDetailPage() {
  const params = useParams();
  const { id } = params;

  // Dummy data campaign
  const campaign = {
    id,
    title: 'Bantu Korban Banjir di Jakarta',
    description:
      'Dana ini akan digunakan untuk membeli makanan, pakaian, dan kebutuhan darurat untuk korban banjir di daerah Jakarta Timur.',
    target: 10,
    raised: 3.2,
    banner: 'https://via.placeholder.com/600x300',
    donations: [
      { name: '0xA123...89f3', amount: 1.5 },
      { name: '0xB456...cc12', amount: 0.8 },
      { name: '0xC789...de34', amount: 0.9 },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 max-w-3xl mx-auto font-sans text-gray-900">
      <img
        src={campaign.banner}
        alt="banner"
        className="w-full h-64 object-cover rounded mb-6"
      />
      <h1 className="text-2xl font-bold mb-2 text-gray-900">{campaign.title}</h1>
      <p className="text-gray-800 mb-4">{campaign.description}</p>

      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700">
          {campaign.raised} ETH raised of {campaign.target} ETH
        </p>
        <div className="w-full bg-gray-200 h-2 rounded-full">
          <div
            className="bg-green-500 h-2 rounded-full"
            style={{ width: `${(campaign.raised / campaign.target) * 100}%` }}
          ></div>
        </div>
      </div>

      <form className="mb-6">
        <label className="block mb-1 text-sm text-gray-700">Jumlah Donasi (ETH)</label>
        <input
          type="number"
          className="w-full px-4 py-2 border rounded mb-2"
          placeholder="Masukkan jumlah donasi"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Donasi Sekarang
        </button>
      </form>

      <div>
        <h2 className="text-lg font-semibold mb-2 text-gray-900">Riwayat Donasi</h2>
        <ul className="space-y-2">
          {campaign.donations.map((d, idx) => (
            <li
              key={idx}
              className="flex justify-between bg-white p-3 rounded shadow text-gray-800"
            >
              <span>{d.name}</span>
              <span>{d.amount} ETH</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
