'use client';
import { useEffect, useState } from 'react';
import { ethers, Contract } from 'ethers';

type CampaignData = {
  address: string;
  title: string;
  description: string;
  goal: string;
  raised: string;
};

const FACTORY_ADDRESS = '0xe35C7c9fcBd477fb34B612f71361dB0f8cE84C9C';
const FACTORY_ABI = [
  {
    "inputs": [],
    "name": "getCampaigns",
    "outputs": [{ "internalType": "address[]", "name": "", "type": "address[]" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const CAMPAIGN_ABI = [
  { "inputs": [], "name": "title", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "description", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "goal", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "raisedAmount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

export default function HomePage() {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (typeof window.ethereum === 'undefined') return;

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      const addresses: string[] = await factory.getCampaigns();

      const details = await Promise.all(
        addresses.map(async (addr) => {
          const campaign = new Contract(addr, CAMPAIGN_ABI, provider);
          const [title, description, goal, raisedAmount] = await Promise.all([
            campaign.title(),
            campaign.description(),
            campaign.goal(),
            campaign.raisedAmount()
          ]);

          return {
            address: addr,
            title,
            description,
            goal: ethers.formatEther(goal),
            raised: ethers.formatEther(raisedAmount)
          };
        })
      );

      setCampaigns(details);
    };

    fetchCampaigns();
  }, []);

  return (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">Campaigns</h1>

    {campaigns.length === 0 ? (
      <p className="text-gray-500">Belum ada kampanye yang aktif.</p>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map((c) => (
          <div key={c.address} className="border p-4 rounded bg-white shadow">
            <h2 className="text-lg font-semibold mb-1">{c.title}</h2>
            <p className="text-sm text-gray-600 mb-2">{c.description}</p>
            <p className="text-sm">{c.raised} ETH raised of {c.goal} ETH</p>
            <div className="w-full bg-gray-200 h-2 rounded-full my-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${(Number(c.raised) / Number(c.goal)) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 break-all">{c.address}</p>
          </div>
        ))}
      </div>
    )}
  </div>
);

}
