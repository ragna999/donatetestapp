'use client';

import { useEffect, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { ethers, Contract } from 'ethers';
import Link from 'next/link';
import { RPC, FACTORY_ADDRESS } from '../lib/config';
import TxSuccessModal from '../components/TxSuccessModal';

const FACTORY_ABI = [
  { name: 'getAllCampaigns',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  { name: 'campaignToCreator', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }] },
];

const CAMPAIGN_ABI = [
  { name: 'title',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'description',  type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'image',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'goal',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDonated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'deadline',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
];

export default function ProfilePage() {
  const { user, ready, authenticated, login, linkTwitter, linkEmail } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();

  const [campaigns,        setCampaigns]        = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [imgErrors,        setImgErrors]        = useState<Record<string, boolean>>({});

  // ─── Wallet state ────────────────────────────────────────────────────────
  const [balance,      setBalance]      = useState<string | null>(null);
  const [copied,       setCopied]       = useState(false);
  const [sendTo,       setSendTo]       = useState('');
  const [sendAmount,   setSendAmount]   = useState('');
  const [sending,      setSending]      = useState(false);
  const [sendError,    setSendError]    = useState('');
  const [txResult,     setTxResult]     = useState<{ hash: string; label: string } | null>(null);

  useEffect(() => {
    if (!authenticated || !user?.wallet?.address) return;
    (async () => {
      try {
        const provider = new ethers.JsonRpcProvider(RPC);
        const factory  = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
        const all: string[] = await factory.getAllCampaigns();

        const rows = await Promise.all(
          all.map(async (addr) => {
            try {
              const creator = await factory.campaignToCreator(addr);
              if (creator.toLowerCase() !== user.wallet!.address.toLowerCase()) return null;
              const c = new Contract(addr, CAMPAIGN_ABI, provider);
              const [title, description, image, goal, raised, deadline] = await Promise.all([
                c.title(), c.description(), c.image(), c.goal(), c.totalDonated(), c.deadline(),
              ]);
              const isFinished = Math.floor(Date.now() / 1000) > Number(deadline) || BigInt(raised) >= BigInt(goal);
              return { address: addr, title, description, image, goal: ethers.formatEther(goal), raised: ethers.formatEther(raised), isFinished };
            } catch { return null; }
          })
        );
        setCampaigns(rows.filter(Boolean));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingCampaigns(false);
      }
    })();
  }, [authenticated, user]);

  // Fetch ETH balance
  useEffect(() => {
    if (!user?.wallet?.address) return;
    const provider = new ethers.JsonRpcProvider(RPC);
    provider.getBalance(user.wallet.address)
      .then(b => setBalance(ethers.formatEther(b)))
      .catch(() => setBalance('0'));
  }, [user?.wallet?.address]);

  async function handleSend() {
    setSendError('');
    if (!ethers.isAddress(sendTo)) { setSendError('Alamat tujuan tidak valid'); return; }
    const amt = parseFloat(sendAmount);
    if (isNaN(amt) || amt <= 0) { setSendError('Jumlah tidak valid'); return; }
    const wallet = wallets[0];
    if (!wallet) { setSendError('Wallet tidak ditemukan'); return; }
    setSending(true);
    try {
      const eip1193 = await wallet.getEthereumProvider();
      const signer  = await new ethers.BrowserProvider(eip1193).getSigner(wallet.address);
      const tx      = await signer.sendTransaction({ to: sendTo, value: ethers.parseEther(sendAmount) });
      const receipt = await tx.wait();
      setTxResult({ hash: receipt?.hash ?? tx.hash, label: `Berhasil kirim ${sendAmount} ETH!` });
      setSendTo(''); setSendAmount('');
      // refresh balance
      const provider = new ethers.JsonRpcProvider(RPC);
      provider.getBalance(wallet.address).then(b => setBalance(ethers.formatEther(b)));
    } catch (e: any) {
      setSendError(e?.shortMessage || e?.message || 'Transaksi gagal');
    } finally { setSending(false); }
  }

  function copyAddress() {
    if (!user?.wallet?.address) return;
    navigator.clipboard.writeText(user.wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!ready) return (
    <div className="min-h-screen bg-[#060d1a] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!authenticated) return (
    <div className="min-h-screen bg-[#060d1a] flex items-center justify-center text-center px-4">
      <div>
        <p className="text-4xl mb-4">🔒</p>
        <h2 className="text-xl font-bold text-white mb-2">Belum Login</h2>
        <p className="text-gray-400 text-sm mb-6">Hubungkan wallet untuk melihat profil kamu</p>
        <button onClick={login}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium"
        >
          Connect Wallet
        </button>
      </div>
    </div>
  );

  const emailObj      = typeof user?.email === 'object' && user.email !== null ? (user.email as { address: string }) : null;
  const emailAddress  = emailObj?.address || '';
  const emailVerified = !!emailAddress;
  const twitterHandle = user?.twitter?.username || '';
  const twitterVerified = !!twitterHandle;
  const canCreate     = emailVerified && twitterVerified;

  return (
    <>
    {txResult && <TxSuccessModal hash={txResult.hash} label={txResult.label} onClose={() => setTxResult(null)} />}
    <div className="min-h-screen bg-[#060d1a] text-white">

      {/* Header */}
      <div className="relative bg-gradient-to-b from-indigo-900/20 to-transparent border-b border-white/10 px-6 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-5 relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/30 shrink-0">
            👤
          </div>
          <div>
            <h1 className="text-2xl font-bold">Profil Saya</h1>
            <p className="text-gray-400 text-sm font-mono mt-1 break-all">{user?.wallet?.address}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">

        {/* ── Wallet Card ── */}
        <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-500/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Wallet Saya</h2>
            <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">Sepolia Testnet</span>
          </div>

          {/* Address + balance */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Alamat</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono text-white break-all">{user?.wallet?.address}</p>
                <button onClick={copyAddress}
                  className="shrink-0 text-xs px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition text-gray-400 hover:text-white">
                  {copied ? '✓ Disalin' : 'Salin'}
                </button>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500 mb-1">Saldo</p>
              <p className="text-xl font-bold text-white">
                {balance === null ? '...' : `${Number(balance).toFixed(4)} ETH`}
              </p>
            </div>
          </div>

          {/* Deposit info */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 mb-4">
            <p className="text-xs text-blue-300 font-medium mb-1">Cara deposit Sepolia ETH</p>
            <p className="text-xs text-gray-400 mb-2">Salin alamat wallet di atas, lalu kunjungi faucet dan masukkan alamat tersebut.</p>
            <div className="flex flex-wrap gap-2">
              <a href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 rounded-lg transition">
                Google Faucet ↗
              </a>
              <a href="https://faucets.chain.link/sepolia" target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 rounded-lg transition">
                Chainlink Faucet ↗
              </a>
            </div>
          </div>

          {/* Kirim ETH */}
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2">Kirim ETH</p>
            <div className="space-y-2">
              <input
                type="text" placeholder="Alamat tujuan (0x...)"
                value={sendTo} onChange={e => setSendTo(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition font-mono"
              />
              <div className="flex gap-2">
                <input
                  type="number" placeholder="Jumlah ETH" min="0" step="0.0001"
                  value={sendAmount} onChange={e => setSendAmount(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition"
                />
                <button onClick={handleSend} disabled={sending || !sendTo || !sendAmount}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition">
                  {sending ? 'Mengirim...' : 'Kirim'}
                </button>
              </div>
              {sendError && <p className="text-xs text-red-400">{sendError}</p>}
            </div>
          </div>
        </div>

        {/* Verifikasi Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Email */}
          <div className="bg-[#0d1526] border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-300">Email</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${emailVerified ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                {emailVerified ? '✓ Terverifikasi' : '✗ Belum'}
              </span>
            </div>
            <p className="text-white text-sm font-medium truncate">{emailAddress || '—'}</p>
            {!emailVerified && (
              <button onClick={linkEmail}
                className="mt-3 w-full py-2 text-xs bg-white/5 hover:bg-indigo-600 border border-white/10 hover:border-indigo-500 text-gray-300 hover:text-white rounded-lg transition"
              >
                Tambah Email
              </button>
            )}
          </div>

          {/* Twitter */}
          <div className="bg-[#0d1526] border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-300">Twitter / X</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${twitterVerified ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                {twitterVerified ? '✓ Terhubung' : '✗ Belum'}
              </span>
            </div>
            <p className="text-white text-sm font-medium">{twitterHandle ? `@${twitterHandle}` : '—'}</p>
            {!twitterVerified && (
              <button onClick={async () => { try { await linkTwitter(); } catch {} }}
                className="mt-3 w-full py-2 text-xs bg-white/5 hover:bg-sky-600 border border-white/10 hover:border-sky-500 text-gray-300 hover:text-white rounded-lg transition"
              >
                Connect Twitter
              </button>
            )}
          </div>
        </div>

        {/* CTA Buat Kampanye */}
        {canCreate ? (
          <button onClick={() => router.push('/create')}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.01]"
          >
            + Buat Kampanye Donasi
          </button>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-sm text-amber-300">
            ⚠️ Verifikasi email dan Twitter terlebih dahulu untuk bisa membuat kampanye.
          </div>
        )}

        {/* Kampanye Saya */}
        <div>
          <h2 className="text-lg font-bold mb-5">Kampanye Saya</h2>

          {loadingCampaigns ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-[#0d1526] border border-white/10 rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-36 bg-white/5" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-white/5 rounded-full w-3/4" />
                    <div className="h-3 bg-white/5 rounded-full w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16 bg-[#0d1526] border border-white/10 rounded-2xl">
              <p className="text-3xl mb-3">📭</p>
              <p className="text-gray-400 text-sm">Belum ada kampanye yang dibuat</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {campaigns.map((c) => {
                const pct = Math.min(100, Number(c.goal) > 0 ? (Number(c.raised) / Number(c.goal)) * 100 : 0);
                return (
                  <div key={c.address} className="bg-[#0d1526] border border-white/10 hover:border-indigo-500/40 rounded-2xl overflow-hidden transition-all group">
                    <div className="relative h-36 bg-gradient-to-br from-indigo-900/30 to-purple-900/30">
                      {c.image && !imgErrors[c.address] ? (
                        <img src={c.image} alt={c.title} className="w-full h-full object-cover"
                          onError={() => setImgErrors(p => ({ ...p, [c.address]: true }))} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">🌱</div>
                      )}
                      {c.isFinished && (
                        <div className="absolute top-2 right-2">
                          <span className="text-xs bg-red-500/80 text-white px-2 py-0.5 rounded-full">Selesai</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <h3 className="font-semibold text-white text-sm line-clamp-1 mb-1">{c.title}</h3>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{c.raised} ETH</span>
                        <span>{pct.toFixed(0)}% dari {c.goal} ETH</span>
                      </div>
                      <Link href={`/campaign/${c.address}`}>
                        <button className="mt-3 w-full py-2 text-xs bg-white/5 hover:bg-indigo-600 border border-white/10 hover:border-indigo-500 text-gray-300 hover:text-white rounded-lg transition">
                          Lihat Detail →
                        </button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
