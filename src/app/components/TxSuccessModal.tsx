'use client';

import { useEffect, useRef } from 'react';

const EXPLORER = 'https://sepolia.etherscan.io';

type Props = {
  hash: string;
  label: string;
  onClose: () => void;
};

export default function TxSuccessModal({ hash, label, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus tombol "Tutup" saat modal terbuka + handle Escape
  useEffect(() => {
    closeRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Transaksi berhasil"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-[#0d1526] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-2xl">
            ✅
          </div>
          <div>
            <p className="text-white font-semibold text-lg">{label}</p>
            <p className="text-gray-400 text-sm mt-1">Transaksi berhasil dikonfirmasi</p>
          </div>
          <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-left">
            <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
            <p className="text-xs font-mono text-gray-300 break-all">{hash}</p>
          </div>
          <a
            href={`${EXPLORER}/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition text-center"
          >
            Lihat di Etherscan ↗
          </a>
          <button
            ref={closeRef}
            onClick={onClose}
            className="w-full py-2.5 border border-white/10 hover:border-white/30 text-gray-400 hover:text-white text-sm rounded-xl transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
