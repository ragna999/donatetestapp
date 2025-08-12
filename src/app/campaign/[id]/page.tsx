// Final FIXED CampaignDetailPage.tsx — with withdraw index + better errors + request form
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ethers, Contract } from 'ethers';

const RPC =
  'https://rpc.ankr.com/somnia_testnet/a9c1def15252939dd98ef549abf0941a694ff1c1b5d13e5889004f556bd67a26';

const CAMPAIGN_ABI = [
  { name: 'title', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'description', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'image', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'goal', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDonated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'creator', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'location', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'deadline', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'social', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },

  // Donations
  {
    name: 'getDonations',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'donor', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ]
      }
    ]
  },

  // Withdraw requests array accessor: requests(uint)
  {
    name: 'requests',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'reason', type: 'string' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'status', type: 'uint8' },   // 0=Pending,1=Approved,2=Denied
      // kalau kontrak lo punya 'withdrawn' bool, tinggal tambahin satu output lagi di sini
    ]
  },

  // Create request — per kontrak lo pakai nama "requestWithdraw" (bukan createWithdrawRequest)
  {
    name: 'requestWithdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_amount', type: 'uint256' },
      { name: '_reason', type: 'string' }
    ],
    outputs: []
  },

  // Withdraw dana: kontrak lo butuh index
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: []
  },

  // Donate
  { name: 'donate', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] }
];

export default function CampaignDetailPage() {
  const params = useParams();
  const id =
    typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const [data, setData] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<string>('');
  const [isOwner, setIsOwner] = useState(false);

  const [donationAmount, setDonationAmount] = useState('');
  const [timeLeft, setTimeLeft] = useState('');

  const [withdrawals, setWithdrawals] = useState<
    { amount: string; reason: string; timestamp: number; status: number }[]
  >([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');

  const provider = useMemo(() => new ethers.JsonRpcProvider(RPC), []);


  //helper//

  function errText(err: any): string {
    const nested =
      err?.info?.error?.message ||
      err?.data?.message ||
      err?.cause?.message ||
      err?.shortMessage ||
      err?.reason ||
      err?.message;
  
    try {
      const body = err?.body || err?.info?.error?.body;
      if (typeof body === 'string' && body.startsWith('{')) {
        const j = JSON.parse(body);
        const m = j?.error?.message || j?.message;
        if (m) return m;
      }
    } catch {}
  
    try {
      const data: string | undefined = err?.info?.error?.data || err?.data || err?.error?.data;
      if (typeof data === 'string' && data.startsWith('0x08c379a0')) {
        const abi = ethers.AbiCoder.defaultAbiCoder();
        const [msg] = abi.decode(['string'], '0x' + data.slice(10));
        if (msg) return String(msg);
      }
    } catch {}
  
    return nested || String(err || 'Unknown error');
  }
  
  useEffect(() => {
    (async () => {
      try {
        if (!id || !ethers.isAddress(id)) throw new Error('Invalid address');
        const code = await provider.getCode(id);
        if (code === '0x') throw new Error('Address is not a contract');

        const contract = new Contract(id, CAMPAIGN_ABI, provider);

        const [
          title,
          description,
          image,
          goalBN,
          totalDonatedBN,
          creator,
          location,
          deadlineBN,
          social,
          donationsRaw
        ] = await Promise.all([
          contract.title(),
          contract.description(),
          contract.image(),
          contract.goal(),
          contract.totalDonated(),
          contract.creator(),
          contract.location(),
          contract.deadline(),
          contract.social(),
          contract.getDonations()
        ]);

        // compute isFinished (deadline lewat atau target tercapai)
        const deadline = Number(deadlineBN);
        const now = Math.floor(Date.now() / 1000);
        const isFinished = now > deadline || BigInt(totalDonatedBN) >= BigInt(goalBN);

        const donations = donationsRaw.map((d: any) => ({
          donor: d.donor,
          amount: ethers.formatEther(d.amount)
        }));

        // fetch withdraw requests via requests(i) until revert
        const reqs: { amount: string; reason: string; timestamp: number; status: number }[] = [];
        for (let i = 0; i < 1000; i++) {
          try {
            const r = await contract.requests(i);
            reqs.push({
              amount: ethers.formatEther(r.amount),
              reason: r.reason,
              timestamp: Number(r.timestamp),
              status: Number(r.status)
            });
          } catch {
            break;
          }
        }
        setWithdrawals(reqs);

        setData({
          title,
          description,
          image,
          goal: ethers.formatEther(goalBN),
          raised: ethers.formatEther(totalDonatedBN),
          creator,
          location,
          deadline,
          social,
          isFinished,
          donations
        });

        if ((window as any).ethereum) {
          const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
          try {
            const signer = await browserProvider.getSigner();
            const addr = await signer.getAddress();
            setCurrentAccount(addr);
            setIsOwner(addr.toLowerCase() === String(creator).toLowerCase());
          } catch {
            // user belum connect — it's fine
          }
        }

        setReady(true);
      } catch (e) {
        console.error('❌ fetchData error:', e);
        setReady(true);
      }
    })();
  }, [id, provider]);

  // countdown
  useEffect(() => {
    if (!data?.deadline) return;
    const intv = setInterval(() => {
      const diff = data.deadline * 1000 - Date.now();
      if (diff <= 0) {
        setTimeLeft('⏱️ Campaign telah selesai');
        clearInterval(intv);
      } else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${d}h ${h}j ${m}m ${s}s`);
      }
    }, 1000);
    return () => clearInterval(intv);
  }, [data?.deadline]);

  async function handleDonate(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!(window as any).ethereum) return alert('Wallet belum terhubung');
      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await browserProvider.getSigner();
      const contract = new Contract(id, CAMPAIGN_ABI, signer);
      const tx = await contract.donate({ value: ethers.parseEther(donationAmount) });
      await tx.wait();
      window.location.reload();
    } catch (err: any) {
      console.error('❌ Donasi gagal:', err);
      alert(`Donasi gagal: ${err?.shortMessage || err?.reason || err?.message || 'Unknown error'}`);
    }
  }

  // create withdraw request
  async function handleRequestWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!withdrawAmount || !withdrawReason.trim()) {
      return alert('Isi jumlah & alasan dulu ya');
    }
    try {
      if (!(window as any).ethereum) return alert('Wallet belum terhubung');
      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await browserProvider.getSigner();
      const contract = new Contract(id, CAMPAIGN_ABI, signer);

      // NOTE: kontrak lo: requestWithdraw(uint amount, string reason)
      const tx = await contract.requestWithdraw(
        ethers.parseEther(withdrawAmount),
        withdrawReason.trim()
      );
      await tx.wait();
      alert('Request withdraw terkirim!');
      window.location.reload();
    } catch (err: any) {
      console.error('❌ Error saat request withdraw:', err);
      alert(
        `Gagal mengirim request withdraw: ${
          err?.shortMessage || err?.reason || err?.message || 'Unknown error'
        }`
      );
    }
  }

  // withdraw approved request: cari index pertama yg status=1
  // withdraw approved request: pilih index approved yang benar-benar executable
async function handleWithdraw() {
  try {
    // kumpulkan semua index yang status=1
    const approvedIdxs = withdrawals
      .map((w, i) => (w.status === 1 ? i : -1))
      .filter((i) => i >= 0);

    if (approvedIdxs.length === 0) return alert('Belum ada request yang disetujui admin');

    if (!(window as any).ethereum) return alert('Wallet belum terhubung');
    const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await browserProvider.getSigner();
    const contract = new Contract(id, CAMPAIGN_ABI, signer);

    // 1) cari index yang lolos preflight (staticCall). kalau gagal, coba provider.call biar dapat pesan revert mentah
    let chosen: bigint | null = null;
    for (const i of approvedIdxs) {
      const idx = BigInt(i);
      try {
        await (contract as any).withdraw.staticCall(idx);
        chosen = idx; // ok: bisa dieksekusi
        break;
      } catch (e) {
        // coba manual call untuk dapetin reason; kalau memang gak bisa, lanjut index berikutnya
        try {
          const iface = new ethers.Interface(['function withdraw(uint256)']);
          const data = iface.encodeFunctionData('withdraw', [idx]);
          await (signer.provider as ethers.Provider).call({ to: id, data });
          chosen = idx; // kalau provider.call gak throw, juga boleh
          break;
        } catch (raw) {
          console.warn(`Index ${i} gagal preflight:`, errText(raw));
          // lanjut cek index berikutnya
        }
      }
    }

    if (chosen === null) {
      return alert('Tidak ada request Approved yang bisa dieksekusi sekarang. Coba cek saldo/aturan kontrak.');
    }

    // 2) kirim transaksi benerannya
    try {
      const tx = await (contract as any).withdraw(chosen);
      await tx.wait();
      alert('Withdraw berhasil!');
      window.location.reload();
    } catch (sendErr) {
      console.error('RAW REVERT (send withdraw) >>>', sendErr);
      alert('Withdraw gagal: ' + errText(sendErr));
    }
  } catch (err: any) {
    console.error('❌ Withdraw gagal:', err);
    alert('Withdraw gagal: ' + errText(err));
  }
}

  
  

  if (!ready || !data) {
    return <p className="p-6 text-white">Loading campaign...</p>;
  }

  const hasApproved = withdrawals.some((w) => w.status === 1);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 max-w-3xl mx-auto" suppressHydrationWarning>
      {data.image ? (
        <img src={data.image} alt={data.title || 'Campaign'} className="w-full h-64 object-cover rounded-lg shadow mb-6" />
      ) : (
        <img src="https://placehold.co/600x300?text=Campaign" alt="default" className="w-full h-64 object-cover rounded-lg shadow mb-6" />
      )}

      <h1 className="text-2xl font-bold mb-2">{data.title || 'Tanpa Judul'}</h1>
      <p className="mb-4 text-gray-300">{data.description || 'Tidak ada deskripsi.'}</p>

      {data.location && <p className="text-sm text-gray-400 mb-1">📍 Lokasi: {data.location}</p>}
      {data.deadline && <p className="text-sm text-yellow-300 mb-1">⏳ Waktu tersisa: {timeLeft}</p>}

      {data.social && (
        <p className="text-sm text-blue-400 mb-6">
          🔗 Sosmed:{' '}
          <a href={data.social} target="_blank" rel="noopener noreferrer" className="underline">
            {data.social}
          </a>
        </p>
      )}

      <div className="mb-6">
        <p className="text-sm font-medium text-gray-400 mb-1">
          {data.raised} STT dari {data.goal} STT
        </p>
        <div className="w-full bg-gray-700 h-3 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-green-400 to-lime-400 h-full transition-all"
            style={{ width: `${Math.min(100, (Number(data.raised) / Number(data.goal)) * 100)}%` }}
          />
        </div>
      </div>

      <p className="text-sm text-purple-300 mb-6">
        👤 Diselenggarakan oleh{' '}
        <a href={`/profile/${data.creator}`} className="hover:underline break-all font-mono text-blue-400">
          {data.creator}
        </a>
      </p>

      <p className="text-xs text-gray-500 mb-8 break-all font-mono">
        Address: <span className="text-blue-500">{id}</span>
      </p>

      {/* Form donasi — hanya kalau BELUM selesai */}
      {!data.isFinished && currentAccount && (
        <form onSubmit={handleDonate} className="mb-10">
          <label className="block text-sm font-medium mb-2 text-gray-300">Jumlah Donasi (STT)</label>
          <input
            type="number"
            step="any"
            value={donationAmount}
            onChange={(e) => setDonationAmount(e.target.value)}
            className="w-full px-4 py-3 rounded-md bg-gray-800 border border-gray-700 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Contoh: 0.01"
          />
          <button
            type="submit"
            className="mt-4 w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-md hover:from-blue-500 hover:to-indigo-500 transition-all duration-200"
          >
            🚀 Donasi Sekarang
          </button>
        </form>
      )}

      {/* Form request withdraw — hanya OWNER & (boleh lo batasi: saat belum selesai atau kapanpun) */}
      {isOwner && (
        <form onSubmit={handleRequestWithdraw} className="mb-10 p-4 rounded-lg bg-gray-800 border border-gray-700">
          <h3 className="font-semibold mb-3">📝 Ajukan Permintaan Withdraw</h3>
          <div className="grid gap-3">
            <input
              type="number"
              step="any"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700"
              placeholder="Jumlah (STT), mis: 0.1"
            />
            <input
              type="text"
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700"
              placeholder="Alasan penarikan"
            />
            <button
              type="submit"
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-4 py-2 rounded"
            >
              Kirim Request
            </button>
          </div>
        </form>
      )}

      {/* Tombol withdraw — hanya OWNER & kalau ada request Approved */}
      {isOwner && hasApproved && (
        <button
          onClick={handleWithdraw}
          className="mb-10 w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-md hover:opacity-90 transition"
        >
          💸 Tarik Dana (Approved)
        </button>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Riwayat Donasi</h2>
        <ul className="space-y-2">
          {data.donations?.map((d: any, i: number) => (
            <li
              key={i}
              className="flex justify-between bg-gray-800 p-3 rounded-lg border border-gray-700 text-sm"
            >
              <span className="font-mono text-gray-300">
                {d.donor.slice(0, 6)}...{d.donor.slice(-4)}
              </span>
              <span className="text-lime-400 font-semibold">{d.amount} STT</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-16">
        <h2 className="text-lg font-semibold mb-4">📤 Permintaan Penarikan Dana</h2>
        <ul className="space-y-3">
          {withdrawals.length > 0 ? (
            withdrawals.map((r, i) => (
              <li
                key={i}
                className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm flex flex-col gap-1"
              >
                <div className="text-white font-semibold">
                  💸 {r.amount} STT — <span className="text-gray-400 italic">{r.reason}</span>
                </div>
                <div className="text-xs text-gray-400">🕒 {new Date(r.timestamp * 1000).toLocaleString()}</div>
                <div>
                  {r.status === 0 && <span className="text-yellow-400 font-mono">🟡 Pending</span>}
                  {r.status === 1 && <span className="text-green-400 font-mono">✅ Approved</span>}
                  {r.status === 2 && <span className="text-red-400 font-mono">❌ Denied</span>}
                </div>
              </li>
            ))
          ) : (
            <p className="text-sm text-gray-500">Belum ada permintaan withdrawal.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
