'use client';

import React from 'react';
import Link from 'next/link';

const campaigns = [
  {
    id: 1,
    title: 'Bantu Korban Banjir',
    target: 10,
    raised: 3.2,
    banner: 'https://via.placeholder.com/400x200?text=Banjir',
  },
  {
    id: 2,
    title: 'Donasi Panti Asuhan',
    target: 5,
    raised: 2.1,
    banner: 'https://via.placeholder.com/400x200?text=Panti+Asuhan',
  },
];

export default function HomePageCampaign() {
  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      <div className="flex justify-between items-center px-6 py-4">
        <h1 className="text-2xl font-bold">Donation Platform</h1>
        <button className="bg-black text-white px-4 py-2 rounded">Connect Wallet</button>
      </div>

      <div className="px-6">
        <input
          type="text"
          placeholder="Search campaigns"
          className="w-full max-w-md px-4 py-2 rounded border mb-6"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white rounded shadow p-4 flex flex-col">
              <img
                src={c.banner}
                alt={c.title}
                className="w-full h-40 object-cover rounded mb-4"
              />
              <h2 className="text-lg font-semibold mb-1">{c.title}</h2>
              <p className="text-sm text-gray-700 mb-2">
                {c.raised} ETH raised of {c.target} ETH
              </p>
              <div className="w-full bg-gray-200 h-2 rounded-full mb-4">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${(c.raised / c.target) * 100}%` }}
                ></div>
              </div>
              <Link href={`/campaign/${c.id}`} className="mt-auto w-full">
                <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">
                  View Details
                </button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
