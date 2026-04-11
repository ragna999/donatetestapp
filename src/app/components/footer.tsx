'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[#060d1a] border-t border-white/10 mt-24">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm">
                🌱
              </div>
              <span className="font-bold text-white text-lg">Donatree</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              Platform donasi transparan berbasis blockchain. Setiap rupiah tercatat, setiap aksi dapat diverifikasi.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Navigasi</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/" className="hover:text-white transition-colors">Explore Kampanye</Link></li>
              <li><Link href="/campaign/history" className="hover:text-white transition-colors">Riwayat</Link></li>
              <li><Link href="/profile" className="hover:text-white transition-colors">Profil Saya</Link></li>
              <li><Link href="/create" className="hover:text-white transition-colors">Buat Kampanye</Link></li>
            </ul>
          </div>

          {/* Tech */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Teknologi</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Ethereum Sepolia
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Smart Contract (Solidity)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> IPFS via Pinata
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> Next.js + ethers.js
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} Donatree. Dibuat untuk keperluan penelitian skripsi.
          </p>
          <p className="text-xs text-gray-600">
            Berjalan di jaringan <span className="text-indigo-400">Ethereum Sepolia Testnet</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
