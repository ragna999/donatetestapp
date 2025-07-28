'use client';
import { useEffect, useState } from 'react';
import { ethers, Contract } from 'ethers';
import Link from 'next/link';

type CampaignData = {
  address: string;
  title: string;
  description: string;
  goal: string;
  raised: string;
};

const FACTORY_ADDRESS = '0x44C69315b6531cC4E53f63FAB7769E33adcde87b';
const FACTORY_ABI = [
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
			{
				"internalType": "string",
				"name": "_description",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "_goal",
				"type": "uint256"
			}
		],
		"name": "createCampaign",
		"outputs": [],
		"stateMutability": "nonpayable",
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
		"inputs": [],
		"name": "getCampaigns",
		"outputs": [
			{
				"internalType": "address[]",
				"name": "",
				"type": "address[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]

const CAMPAIGN_ABI = [
  { inputs: [], name: 'title', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'description', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'goal', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalDonated', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
];

export default function HomePage() {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);

  useEffect(() => {
  const fetchCampaigns = async () => {
    if (typeof window.ethereum === 'undefined') {
      console.warn('❌ Ethereum provider tidak tersedia');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const user = await signer.getAddress();
      console.log('✅ Wallet:', user);

      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      const addresses: string[] = await factory.getCampaigns();

      console.log('📦 Kampanye ditemukan:', addresses);

      const details = await Promise.all(
        addresses.map(async (addr) => {
          const campaign = new Contract(addr, CAMPAIGN_ABI, provider);
          const [title, description, goal, totalDonated] = await Promise.all([
            campaign.title(),
            campaign.description(),
            campaign.goal(),
            campaign.totalDonated(),
          ]);

          return {
            address: addr,
            title,
            description,
            goal: ethers.formatEther(goal),
            raised: ethers.formatEther(totalDonated),
          };
        })
      );

      console.log('🧾 Detail kampanye:', details);
      setCampaigns(details);
    } catch (err) {
      console.error('🔥 Gagal fetch campaign:', err);
    }
  };

  fetchCampaigns();
}, []);


  return (
    <main className="min-h-screen bg-black text-white py-10 px-6">
      <h1 className="text-3xl font-bold mb-8">Campaigns</h1>

      {campaigns.length === 0 ? (
        <p className="text-gray-400">Belum ada kampanye yang aktif.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => (
            <div
              key={c.address}
              className="bg-white text-black p-5 rounded-2xl shadow-lg hover:scale-[1.02] transition"
            >
              <h2 className="text-xl font-bold mb-1">{c.title}</h2>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{c.description}</p>

              <div className="mb-2">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="bg-green-500 h-full"
                    style={{ width: `${(Number(c.raised) / Number(c.goal)) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-700 mt-1">
                  {c.raised} ETH raised of {c.goal} ETH
                </p>
              </div>

              <p className="text-xs text-gray-400 truncate">{c.address}</p>

              <Link href={`/campaign/${c.address}`} className="block mt-4">
                <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm">
                  Lihat Detail
                </button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
