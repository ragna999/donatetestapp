// CampaignDetailPage.tsx — final rewrite (events hydration + LS fallback)
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

  // Donations (tuple[])
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

  // requests(uint256) accessor
  {
    name: 'requests',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'reason', type: 'string' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'status', type: 'uint8' }, // 0=Pending,1=Approved,2=Denied (juga dipakai saat execute)
    ]
  },

  // request/execute withdraw
  { name: 'requestWithdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }, { type: 'string' }], outputs: [] },
  { name: 'executeWithdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },

  // donate
  { name: 'donate', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },

  // events (untuk parseLog)
  { type: 'event', name: 'WithdrawExecuted', inputs: [{ name: 'id', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'WithdrawDenied',   inputs: [{ name: 'id', type: 'uint256', indexed: false }] },
] as const;

type DonationRow = { donor: string; amount: string };
type WithdrawRow = { amount: string; reason: string; timestamp: number; status: number };

export default function CampaignDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const [data, setData] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<string>('');
  const [isOwner, setIsOwner] = useState(false);

  const [donationAmount, setDonationAmount] = useState('');
  const [timeLeft, setTimeLeft] = useState('');

  const [withdrawals, setWithdrawals] = useState<WithdrawRow[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');

  // On-chain derived
  const [executedIds, setExecutedIds] = useState<Set<number>>(new Set());
  const [deniedIds, setDeniedIds] = useState<Set<number>>(new Set());

  const provider = useMemo(() => new ethers.JsonRpcProvider(RPC), []);

  // ===== Helpers =====
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

  // localStorage fallback
  function executedKey(addr: string) {
    return `wd:executed:${addr.toLowerCase()}`;
  }
  function loadExecutedLS(addr: string): Set<number> {
    try {
      const raw = localStorage.getItem(executedKey(addr));
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as number[];
      return new Set(arr);
    } catch {
      return new Set();
    }
  }
  function saveExecutedLS(addr: string, set: Set<number>) {
    try {
      localStorage.setItem(executedKey(addr), JSON.stringify([...set]));
    } catch {}
  }

  // ===== Fetch base data + logs =====
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

        // isFinished
        const deadline = Number(deadlineBN);
        const now = Math.floor(Date.now() / 1000);
        const isFinished = now > deadline || BigInt(totalDonatedBN) >= BigInt(goalBN);

        const donations: DonationRow[] = (donationsRaw as any[]).map((d) => ({
          donor: d.donor,
          amount: ethers.formatEther(d.amount),
        }));

        // read withdraw requests until revert
        const reqs: WithdrawRow[] = [];
        for (let i = 0; i < 1000; i++) {
          try {
            const r = await contract.requests(i);
            reqs.push({
              amount: ethers.formatEther(r.amount),
              reason: r.reason,
              timestamp: Number(r.timestamp),
              status: Number(r.status),
            });
          } catch {
            break;
          }
        }
        setWithdrawals(reqs);

// === Disambiguate status=2 tanpa event: staticCall executeWithdraw ===
// === Disambiguate status=2 tanpa event: staticCall executeWithdraw (pakai REQS lokal)
async function classifyFinalizedRequests(
  reqs: WithdrawRow[],
  baseExec: Set<number>,
  baseDeny: Set<number>
) {
  const c = new Contract(id, CAMPAIGN_ABI, provider);
  const execSet = new Set(baseExec);
  const denySet = new Set(baseDeny);

  for (let i = 0; i < reqs.length; i++) {
    const r = reqs[i];
    if (r.status !== 2) continue;
    if (execSet.has(i) || denySet.has(i)) continue;

    try {
      await (c as any).executeWithdraw.staticCall(i);
      // jika tidak revert → ambiguous (biarkan tidak dilabel)
    } catch (e: any) {
      const msg = (typeof errText === 'function' ? errText(e) : (e?.reason || e?.message || '')).toLowerCase();
      if (msg.includes('denied') || msg.includes('not approved') || msg.includes('rejected')) {
        denySet.add(i);
      } else if (msg.includes('already executed') || msg.includes('executed')) {
        execSet.add(i);
      } else {
        // fallback low-level call untuk reason lain
        try {
          const iface = new ethers.Interface(['function executeWithdraw(uint256)']);
          const data = iface.encodeFunctionData('executeWithdraw', [i]);
          await provider.call({ to: id, data }); // expect revert
        } catch (e2: any) {
          const m2 = (typeof errText === 'function' ? errText(e2) : (e2?.reason || e2?.message || '')).toLowerCase();
          if (m2.includes('denied') || m2.includes('not approved') || m2.includes('rejected')) {
            denySet.add(i);
          } else if (m2.includes('already executed') || m2.includes('executed')) {
            execSet.add(i);
          }
        }
      }
    }
  }
  return { execSet, denySet };
}

// ==== HYDRATE executed / denied (windowed getLogs + robust decode + klasifikasi) ====
try {
  const c = new Contract(id, CAMPAIGN_ABI, provider);

  const topicExec   = ethers.id('WithdrawExecuted(uint256)');
  const topicDenied = ethers.id('WithdrawDenied(uint256)');

  async function scanLogsByTopic(topic: string) {
    const latest = await provider.getBlockNumber();
    const STEP = 50000;
    const acc: any[] = [];

    // non-indexed form
    for (let from = 0; from <= latest; from += STEP + 1) {
      const to = Math.min(latest, from + STEP);
      const logs = await provider.getLogs({ address: id, topics: [topic], fromBlock: from, toBlock: to });
      if (logs.length) acc.push(...logs);
    }
    // indexed form
    if (acc.length === 0) {
      for (let from = 0; from <= latest; from += STEP + 1) {
        const to = Math.min(latest, from + STEP);
        const logs = await provider.getLogs({ address: id, topics: [topic, null], fromBlock: from, toBlock: to });
        if (logs.length) acc.push(...logs);
      }
    }
    return acc;
  }

  function readIdFromLog(lg: any): number | null {
    try {
      if (lg.data && lg.data !== '0x') {
        const [wid] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], lg.data);
        const n = Number(wid);
        return Number.isNaN(n) ? null : n;
      }
      if (Array.isArray(lg.topics) && lg.topics.length > 1) {
        const n = Number(BigInt(lg.topics[1]));
        return Number.isNaN(n) ? null : n;
      }
    } catch {}
    return null;
  }

  const [logsExec, logsDenied] = await Promise.all([
    scanLogsByTopic(topicExec),
    scanLogsByTopic(topicDenied),
  ]);

  const execSetLogs = new Set<number>();
  for (const lg of logsExec) {
    const n = readIdFromLog(lg);
    if (n !== null) execSetLogs.add(n);
  }
  const denySetLogs = new Set<number>();
  for (const lg of logsDenied) {
    const n = readIdFromLog(lg);
    if (n !== null) denySetLogs.add(n);
  }

  // Ambil hasil event + LS sebagai basis
  const baseExec = execSetLogs.size > 0 ? execSetLogs : loadExecutedLS(id);
  const baseDeny = denySetLogs;

  // === PANGGIL klasifikasi berbasis REQS lokal (bukan state)
  const refined = await classifyFinalizedRequests(reqs, baseExec, baseDeny);

  // Commit state akhir
  setExecutedIds(refined.execSet);
  setDeniedIds(refined.denySet);
} catch {
  setExecutedIds(loadExecutedLS(id));
  setDeniedIds(new Set());
}






        // set base data
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

        // wallet
        if ((window as any).ethereum) {
          const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
          try {
            const signer = await browserProvider.getSigner();
            const addr = await signer.getAddress();
            setCurrentAccount(addr);
            setIsOwner(addr.toLowerCase() === String(creator).toLowerCase());
          } catch {}
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

  // ===== Actions =====
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
      alert('Donasi gagal: ' + errText(err));
    }
  }

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

      const tx = await contract.requestWithdraw(
        ethers.parseEther(withdrawAmount),
        withdrawReason.trim()
      );
      await tx.wait();
      alert('Request withdraw terkirim!');
      window.location.reload();
    } catch (err: any) {
      console.error('❌ Error saat request withdraw:', err);
      alert('Gagal mengirim request withdraw: ' + errText(err));
    }
  }

  async function handleWithdraw() {
    try {
      const approvedIdxs = withdrawals.map((w, i) => (w.status === 1 ? i : -1)).filter((i) => i >= 0);
      if (approvedIdxs.length === 0) return alert('Belum ada request yang disetujui admin');

      if (!(window as any).ethereum) return alert('Wallet belum terhubung');
      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await browserProvider.getSigner();
      const contract = new Contract(id, CAMPAIGN_ABI, signer);

      // pilih index Approved yang lolos preflight
      let chosen: bigint | null = null;
      for (const i of approvedIdxs) {
        const idx = BigInt(i);
        try {
          await (contract as any).executeWithdraw.staticCall(idx);
          chosen = idx;
          break;
        } catch {
          try {
            const iface = new ethers.Interface(['function executeWithdraw(uint256)']);
            const data = iface.encodeFunctionData('executeWithdraw', [idx]);
            await (signer.provider as ethers.Provider).call({ to: id, data });
            chosen = idx;
            break;
          } catch {}
        }
      }

      if (chosen === null) return alert('Tidak ada request Approved yang bisa dieksekusi sekarang.');

      const tx = await (contract as any).executeWithdraw(chosen);
      await tx.wait();

      // Tandai executed (fallback LS) — event on-chain juga akan hydrate saat reload
      const executed = new Set(executedIds);
      executed.add(Number(chosen));
      setExecutedIds(executed);
      saveExecutedLS(id, executed);

      alert('Withdraw berhasil!');
      window.location.reload();
    } catch (err: any) {
      console.error('RAW REVERT (withdraw) >>>', err);
      alert('Withdraw gagal: ' + errText(err));
    }
  }

  if (!ready || !data) {
    return <p className="p-6 text-white">Loading campaign...</p>;
  }

  const hasApproved = withdrawals.some((w) => w.status === 1);

// ===== Label & History =====
const isWithdrawn = (i: number) => executedIds.has(i);
const isDeniedByAdmin = (i: number) => deniedIds.has(i);

function statusLabel(i: number, r: WithdrawRow) {
  if (r.status === 0) return { text: '🟡 Pending',  cls: 'text-yellow-400' };
  if (r.status === 1) return { text: '✅ Approved', cls: 'text-green-400' };

  // Final status:
  if (isWithdrawn(i))     return { text: '💸 Withdrawn', cls: 'text-blue-400' };
  if (isDeniedByAdmin(i)) return { text: '❌ Denied',    cls: 'text-red-400' };

  // default untuk status=2 saat event/RPC miss → treat as Denied
  if (r.status === 2)     return { text: '❌ Denied',    cls: 'text-red-400' };

  return { text: '❓ Unknown', cls: 'text-gray-300' };
}

// Riwayat withdraw: hanya yang benar-benar executed
const withdrawnHistory = withdrawals
  .map((r, i) => ({ ...r, index: i }))
  .filter((r) => isWithdrawn(r.index));

  
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

      {/* Donate form */}
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

      {/* Request withdraw — owner only */}
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

      {/* Execute withdraw — owner & has approved */}
      {isOwner && hasApproved && (
        <button
          onClick={handleWithdraw}
          className="mb-10 w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-md hover:opacity-90 transition"
        >
          💸 Tarik Dana (Approved)
        </button>
      )}

      {/* Donations */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Riwayat Donasi</h2>
        <ul className="space-y-2">
          {(data.donations as DonationRow[] | undefined)?.map((d: any, i: number) => (
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

      {/* Withdraw requests */}
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
                  {(() => {
                    const s = statusLabel(i, r);
                    return <span className={`${s.cls} font-mono`}>{s.text}</span>;
                  })()}
                </div>
              </li>
            ))
          ) : (
            <p className="text-sm text-gray-500">Belum ada permintaan withdrawal.</p>
          )}
        </ul>

        {/* Withdrawn history (event/LS-based) */}
        {withdrawnHistory.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-3">📚 Riwayat Withdraw</h3>
            <ul className="space-y-3">
              {withdrawnHistory.map((r) => (
                <li key={`wd-${r.index}`} className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm">
                  <div className="text-white font-semibold">
                    💸 Withdrawn — <span className="text-gray-400 italic">{r.reason}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    ID: #{r.index} • {new Date(r.timestamp * 1000).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
