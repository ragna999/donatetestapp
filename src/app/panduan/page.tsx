'use client';

import React, { useState } from 'react';
import Link from 'next/link';

function AccordionItem({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left text-white font-medium hover:bg-white/5 transition-colors"
      >
        <span>{title}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 text-gray-300 text-sm leading-relaxed border-t border-white/10 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

function Badge({ children, color = 'indigo' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  };
  return (
    <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full border ${colors[color]}`}>
      {children}
    </span>
  );
}

function StepCard({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
        {number}
      </div>
      <div>
        <p className="text-white font-medium text-sm">{title}</p>
        <p className="text-gray-400 text-sm mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export default function PanduanPage() {
  const [activeTab, setActiveTab] = useState<'donatur' | 'pembuat'>('donatur');

  return (
    <div className="min-h-screen bg-[#060d1a] pt-24 pb-20 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-3">Panduan Donatree</h1>
          <p className="text-gray-400 text-base max-w-xl mx-auto">
            Pelajari cara berdonasi atau membuat kampanye di platform ini.
          </p>
        </div>

        {/* Apa itu Donatree */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-white font-semibold text-lg mb-3">Apa itu Donatree?</h2>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            Donatree adalah platform donasi berbasis <strong className="text-white">blockchain</strong>.
            Setiap transaksi tercatat secara permanen dan tidak bisa diubah. Dana donasi dikelola oleh{' '}
            <strong className="text-white">smart contract</strong>, bukan oleh individu atau organisasi tertentu.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: '🔍', title: 'Transparan', desc: 'Semua transaksi bisa dicek siapapun di blockchain' },
              { icon: '🔒', title: 'Aman', desc: 'Dana langsung ke smart contract, bukan rekening pribadi' },
              { icon: '✅', title: 'Terverifikasi', desc: 'Setiap campaign diverifikasi admin sebelum tayang' },
            ].map(item => (
              <div key={item.title} className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl mb-2">{item.icon}</div>
                <p className="text-white text-sm font-medium">{item.title}</p>
                <p className="text-gray-400 text-xs mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Apa itu Wallet */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 mb-8">
          <h2 className="text-white font-semibold text-lg mb-2">Apa itu Wallet dan kenapa dibutuhkan?</h2>
          <p className="text-gray-300 text-sm leading-relaxed mb-3">
            Wallet adalah akun kamu di blockchain. Fungsinya seperti rekening bank, tapi kamu sendiri yang
            mengontrolnya tanpa perantara. Di Donatree, wallet dipakai untuk:
          </p>
          <ul className="space-y-1.5 text-sm text-gray-300">
            {[
              'Melakukan donasi (mengirim ETH)',
              'Membuat kampanye donasi',
              'Login ke platform',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-gray-400 text-xs mt-4">
            Platform ini berjalan di <strong className="text-amber-300">Sepolia Testnet</strong>, jaringan percobaan Ethereum.
            ETH yang digunakan tidak bernilai uang nyata, jadi aman untuk dicoba.
          </p>
        </div>

        {/* Tab: Donatur / Pembuat Campaign */}
        <div className="mb-6">
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() => setActiveTab('donatur')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'donatur'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Saya ingin Berdonasi
            </button>
            <button
              onClick={() => setActiveTab('pembuat')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'pembuat'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Saya ingin Membuat Campaign
            </button>
          </div>
        </div>

        {/* Konten Donatur */}
        {activeTab === 'donatur' && (
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <h2 className="text-white font-semibold text-lg">Cara Berdonasi</h2>
                <Badge color="indigo">Donatur</Badge>
              </div>
              <div className="space-y-5">
                <StepCard number={1} title="Install MetaMask" desc="Download ekstensi MetaMask di browser kamu (Chrome/Firefox). Buat akun baru atau import akun yang sudah ada." />
                <StepCard number={2} title="Ganti jaringan ke Sepolia Testnet" desc="Di MetaMask, pilih jaringan Sepolia Test Network. Kalau tidak muncul, aktifkan di Settings > Advanced > Show test networks." />
                <StepCard number={3} title="Dapatkan ETH Testnet" desc="Kunjungi Sepolia Faucet (sepoliafaucet.com) untuk mendapatkan ETH gratis. Masukkan alamat wallet kamu." />
                <StepCard number={4} title="Connect Wallet" desc="Klik tombol Connect Wallet di navbar, lalu ikuti instruksi untuk menghubungkan wallet kamu." />
                <StepCard number={5} title="Pilih Campaign dan Donasi" desc="Pilih campaign yang ingin kamu dukung, masukkan jumlah ETH, lalu konfirmasi transaksi di MetaMask." />
                <StepCard number={6} title="Selesai" desc="Donasi langsung masuk ke smart contract campaign. Riwayat donasi bisa dicek di halaman Riwayat." />
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-semibold text-lg mb-4">FAQ Donatur</h2>
              <div className="space-y-3">
                <AccordionItem title="Apakah dana saya aman?">
                  Dana masuk langsung ke smart contract, bukan rekening pribadi siapapun.
                  Smart contract hanya bisa diakses oleh pembuat campaign sesuai aturan yang sudah ditetapkan,
                  dan semua transaksi bisa dicek secara publik di Etherscan.
                </AccordionItem>
                <AccordionItem title="Bisakah saya membatalkan donasi?">
                  Tidak bisa. Transaksi blockchain bersifat final. Pastikan kamu yakin sebelum mengkonfirmasi di MetaMask.
                </AccordionItem>
                <AccordionItem title="Kenapa ada gas fee?">
                  Gas fee adalah biaya untuk memproses transaksi di jaringan Ethereum.
                  Di Sepolia Testnet, gas fee dibayar dengan ETH testnet yang gratis dari faucet.
                </AccordionItem>
                <AccordionItem title="Bagaimana cara tahu campaign ini legitimate?">
                  Setiap campaign sudah diverifikasi admin sebelum tayang. Admin mengecek dokumen identitas
                  dan kelengkapan data pembuat campaign.
                </AccordionItem>
                <AccordionItem title="Kemana dana jika campaign gagal mencapai target?">
                  Jika deadline lewat dan target belum tercapai, mode refund otomatis aktif.
                  Penyelenggara tidak bisa menarik dana lagi, dan kamu bisa klaim refund melalui halaman campaign.
                  Catatan: jika penyelenggara sudah menarik sebagian dana sebelum deadline (dengan persetujuan admin),
                  refund yang kamu terima bersifat proporsional sesuai sisa dana yang masih ada di kontrak.
                </AccordionItem>
              </div>
            </div>
          </div>
        )}

        {/* Konten Pembuat Campaign */}
        {activeTab === 'pembuat' && (
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <h2 className="text-white font-semibold text-lg">Cara Membuat Campaign</h2>
                <Badge color="purple">Pembuat Campaign</Badge>
              </div>
              <div className="space-y-5">
                <StepCard number={1} title="Connect Wallet dan lengkapi profil" desc="Buka halaman Profile, lalu hubungkan akun Twitter dan Email. Keduanya wajib sebelum bisa membuat campaign." />
                <StepCard number={2} title="Buka halaman Buat Campaign" desc="Setelah profil lengkap, kamu bisa mengakses halaman pembuatan campaign." />
                <StepCard number={3} title="Isi info kampanye" desc="Masukkan judul, deskripsi, target dana (ETH), lokasi, durasi, dan link sosial media." />
                <StepCard number={4} title="Upload gambar kampanye" desc="Pilih gambar yang mewakili kampanyemu. Gambar akan disimpan di IPFS." />
                <StepCard number={5} title="Pilih kategori dan upload dokumen" desc="Pilih kategori (Yayasan, Perorangan Medis, atau Bencana) dan upload dokumen legitimasi yang diminta." />
                <StepCard number={6} title="Isi informasi kontak" desc="Masukkan nama PIC, nomor WhatsApp, email, dan alamat untuk keperluan verifikasi." />
                <StepCard number={7} title="Submit dan tunggu persetujuan" desc="Campaign akan dikaji oleh admin. Jika disetujui, campaign akan muncul di halaman utama." />
              </div>
            </div>

            {/* Kategori & Dokumen */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-semibold text-lg mb-4">Kategori dan Dokumen yang Dibutuhkan</h2>
              <div className="space-y-4">
                {[
                  {
                    label: 'Yayasan / Lembaga Resmi',
                    color: 'emerald' as const,
                    docs: ['Akta Pendirian Yayasan (wajib)', 'SK Kemenkumham (wajib)', 'KTP Pengurus (wajib)', 'NPWP Yayasan (opsional)'],
                  },
                  {
                    label: 'Perorangan - Keluarga Sakit / Medis',
                    color: 'indigo' as const,
                    docs: ['KTP Pemohon (wajib)', 'Kartu Keluarga (wajib)', 'Surat Keterangan Dokter / Diagnosis (wajib)', 'Foto Kondisi Pasien (opsional)'],
                  },
                  {
                    label: 'Perorangan - Bencana / Darurat',
                    color: 'amber' as const,
                    docs: ['KTP Pemohon (wajib)', 'Surat Keterangan RT/RW atau Kelurahan (wajib)', 'Foto Kondisi / Lokasi Bencana (wajib)'],
                  },
                ].map(cat => (
                  <div key={cat.label} className="bg-white/5 rounded-xl p-4">
                    <div className="mb-2"><Badge color={cat.color}>{cat.label}</Badge></div>
                    <ul className="space-y-1">
                      {cat.docs.map(doc => (
                        <li key={doc} className="text-sm text-gray-300 flex items-start gap-2">
                          <span className="text-gray-500 mt-0.5">•</span>
                          <span>{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-semibold text-lg mb-4">FAQ Pembuat Campaign</h2>
              <div className="space-y-3">
                <AccordionItem title="Berapa lama proses verifikasi?">
                  Verifikasi dilakukan admin secara manual, biasanya 1-3 hari kerja setelah semua dokumen lengkap.
                </AccordionItem>
                <AccordionItem title="Apa yang terjadi jika campaign ditolak?">
                  Kamu bisa membuat campaign baru dengan dokumen yang diperbaiki.
                </AccordionItem>
                <AccordionItem title="Bagaimana cara menarik dana?">
                  Kamu bisa mengajukan permintaan withdraw kapan saja selama campaign masih berjalan, dengan
                  menyertakan alasan penarikan. Admin akan mereview dan menyetujui atau menolak permintaan tersebut.
                  Setelah disetujui, kamu bisa mengeksekusi penarikan dari halaman campaign.
                  Jika deadline sudah lewat dan target tidak tercapai, mode refund aktif dan withdraw tidak bisa dilakukan.
                </AccordionItem>
                <AccordionItem title="Apa itu IPFS?">
                  IPFS (InterPlanetary File System) adalah sistem penyimpanan terdesentralisasi.
                  File yang diupload ke IPFS tidak bisa dihapus atau diubah oleh siapapun.
                </AccordionItem>
                <AccordionItem title="Apakah ada biaya untuk membuat campaign?">
                  Ada gas fee kecil untuk menulis data ke blockchain.
                  Di Sepolia Testnet, ini dibayar dengan ETH testnet yang bisa didapat gratis dari faucet.
                </AccordionItem>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 text-center">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/"
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium shadow-lg shadow-indigo-500/20 transition-all text-center"
            >
              Lihat Campaign
            </Link>
            <Link href="/create"
              className="px-6 py-2.5 rounded-full border border-white/20 hover:border-white/40 text-white text-sm font-medium transition-all text-center"
            >
              Buat Campaign
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
