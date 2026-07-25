'use client';

import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { uploadToPinata, uploadJSONToPinata } from '../utils/uploadToPinata';
import { FACTORY_ADDRESS } from '../lib/config';
import TxSuccessModal from '../components/TxSuccessModal';

const CAMPAIGN_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "_adminContract", "type": "address" }],
    "stateMutability": "nonpayable", "type": "constructor"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "_title",    "type": "string"  },
      { "internalType": "string", "name": "_desc",     "type": "string"  },
      { "internalType": "string", "name": "_image",    "type": "string"  },
      { "internalType": "uint256","name": "_goal",     "type": "uint256" },
      { "internalType": "string", "name": "_location", "type": "string"  },
      { "internalType": "uint256","name": "_duration", "type": "uint256" },
      { "internalType": "string", "name": "_social",   "type": "string"  }
    ],
    "name": "createCampaign", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [], "name": "getApprovedCampaigns",
    "outputs": [{ "internalType": "address[]", "name": "result", "type": "address[]" }],
    "stateMutability": "view", "type": "function"
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  yayasan:            'Yayasan / Lembaga Resmi',
  perorangan_medis:   'Perorangan — Keluarga Sakit / Medis',
  perorangan_bencana: 'Perorangan — Bencana / Darurat',
};

const CATEGORY_ICONS: Record<string, string> = {
  yayasan:            '🏛️',
  perorangan_medis:   '🏥',
  perorangan_bencana: '🆘',
};

const CATEGORY_DESCS: Record<string, string> = {
  yayasan:            'Organisasi nonprofit, yayasan, atau lembaga sosial resmi.',
  perorangan_medis:   'Individu yang mengumpulkan dana untuk biaya pengobatan atau medis.',
  perorangan_bencana: 'Individu terdampak bencana alam atau kondisi darurat.',
};

type DocReq = { key: string; label: string; accept: string; required: boolean };

const DOC_REQUIREMENTS: Record<string, DocReq[]> = {
  yayasan: [
    { key: 'akta',         label: 'Akta Pendirian Yayasan',              accept: '.pdf',                 required: true  },
    { key: 'sk',           label: 'SK Kemenkumham',                      accept: '.pdf',                 required: true  },
    { key: 'npwp',         label: 'NPWP Yayasan',                        accept: '.pdf,.jpg,.jpeg,.png', required: false },
    { key: 'ktp_pengurus', label: 'KTP Pengurus yang Mendaftar',         accept: '.jpg,.jpeg,.png',      required: true  },
  ],
  perorangan_medis: [
    { key: 'ktp',          label: 'KTP Pemohon',                         accept: '.jpg,.jpeg,.png',      required: true  },
    { key: 'kk',           label: 'Kartu Keluarga',                      accept: '.jpg,.jpeg,.png',      required: true  },
    { key: 'surat_dokter', label: 'Surat Keterangan Dokter / Diagnosis', accept: '.pdf,.jpg,.jpeg,.png', required: true  },
    { key: 'foto_pasien',  label: 'Foto Kondisi Pasien',                 accept: '.jpg,.jpeg,.png',      required: false },
  ],
  perorangan_bencana: [
    { key: 'ktp',          label: 'KTP Pemohon',                           accept: '.jpg,.jpeg,.png',      required: true  },
    { key: 'surat_rtrw',   label: 'Surat Keterangan RT/RW atau Kelurahan', accept: '.pdf,.jpg,.jpeg,.png', required: true  },
    { key: 'foto_bencana', label: 'Foto Kondisi / Lokasi Bencana',         accept: '.jpg,.jpeg,.png',      required: true  },
  ],
};

export default function CreateCampaignPage() {
  const { user } = usePrivy();
  const { wallets } = useWallets();

  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [goal,     setGoal]     = useState('');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState('');
  const [social,   setSocial]   = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [uploading,       setUploading]       = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [hasTwitter,      setHasTwitter]      = useState(false);
  const [hasEmail,        setHasEmail]        = useState(false);

  const [category,     setCategory]     = useState('');
  const [docUrls,      setDocUrls]      = useState<Record<string, string>>({});
  const [docNames,     setDocNames]     = useState<Record<string, string>>({});
  const [docUploading, setDocUploading] = useState<Record<string, boolean>>({});
  const [txResult,     setTxResult]     = useState<{ hash: string; label: string } | null>(null);

  const [contact, setContact] = useState({
    nama: '', whatsapp: '', email: '', alamat: '', website: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const address = user?.wallet?.address;
        if (!address) { setCheckingProfile(false); return; }
        const res  = await fetch(`/api/user-social/${address}`);
        const data = await res.json();
        setHasTwitter(!!data.twitter);
        setHasEmail(!!data.email);
      } catch {
        // gagal cek = anggap belum lengkap
      } finally {
        setCheckingProfile(false);
      }
    })();
  }, [user?.wallet?.address]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToPinata(file);
      setImageUrl(url);
    } catch {
      alert('Upload gambar gagal');
    } finally {
      setUploading(false);
    }
  };

  const handleDocUpload = async (docKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Ukuran file maksimal 5MB'); return; }
    setDocUploading(prev => ({ ...prev, [docKey]: true }));
    try {
      const url = await uploadToPinata(file);
      setDocUrls(prev  => ({ ...prev,  [docKey]: url       }));
      setDocNames(prev => ({ ...prev,  [docKey]: file.name }));
    } catch {
      alert('Upload dokumen gagal');
    } finally {
      setDocUploading(prev => ({ ...prev, [docKey]: false }));
    }
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setDocUrls({});
    setDocNames({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const wallet = wallets.find(w => w.walletClientType === 'privy') || wallets[0];
      if (!wallet) { alert('Wallet tidak ditemukan'); return; }
      const address = wallet.address;

      const profileRes  = await fetch(`/api/user-social/${address}`);
      const profileData = await profileRes.json();
      if (!profileData.twitter || !profileData.email) {
        alert('Kamu harus menghubungkan Twitter dan Email di profil sebelum membuat kampanye.');
        return;
      }
      if (!social || !social.startsWith('http')) {
        alert('Masukkan link sosial media yang valid!');
        return;
      }
      if (!category) {
        alert('Pilih kategori penyelenggara terlebih dahulu.');
        return;
      }
      const requiredDocs = DOC_REQUIREMENTS[category].filter(d => d.required);
      for (const doc of requiredDocs) {
        if (!docUrls[doc.key]) {
          alert(`Upload "${doc.label}" terlebih dahulu.`);
          return;
        }
      }
      if (!contact.nama.trim() || !contact.whatsapp.trim() || !contact.email.trim() || !contact.alamat.trim()) {
        alert('Lengkapi semua informasi kontak (Nama, WhatsApp, Email, Alamat).');
        return;
      }

      const documents = DOC_REQUIREMENTS[category]
        .filter(d => docUrls[d.key])
        .map(d => ({ key: d.key, label: d.label, url: docUrls[d.key] }));

      const metadata = {
        version: '1',
        category,
        categoryLabel: CATEGORY_LABELS[category],
        contact: {
          nama:     contact.nama.trim(),
          whatsapp: contact.whatsapp.trim(),
          email:    contact.email.trim(),
          alamat:   contact.alamat.trim(),
          website:  contact.website.trim(),
        },
        social,
        documents,
      };

      const metadataUrl       = await uploadJSONToPinata(metadata, `campaign-meta-${Date.now()}`);
      await wallet.switchChain(11155111);
      const eip1193           = await wallet.getEthereumProvider();
      const provider          = new ethers.BrowserProvider(eip1193);
      const signer            = await provider.getSigner();
      const factory           = new ethers.Contract(FACTORY_ADDRESS, CAMPAIGN_ABI, signer);
      const goalInWei         = ethers.parseEther(goal);
      const durationInSeconds = parseInt(duration) * 86400;

      const tx      = await factory.createCampaign(title, desc, imageUrl || '', goalInWei, location, durationInSeconds, metadataUrl);
      const receipt = await tx.wait();
      setTxResult({ hash: receipt?.hash ?? tx.hash, label: 'Kampanye berhasil dibuat! Menunggu persetujuan admin.' });

      setTitle(''); setDesc(''); setGoal(''); setLocation(''); setDuration('');
      setSocial(''); setImageUrl(null); setCategory(''); setDocUrls({}); setDocNames({});
      setContact({ nama: '', whatsapp: '', email: '', alamat: '', website: '' });
    } catch (err: any) {
      console.error(err);
      alert('Gagal membuat campaign: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const profileIncomplete = !checkingProfile && (!hasTwitter || !hasEmail);
  const currentDocs       = category ? DOC_REQUIREMENTS[category] : [];

  return (
    <>
      {txResult && (
        <TxSuccessModal
          hash={txResult.hash}
          label={txResult.label}
          onClose={() => setTxResult(null)}
        />
      )}

      <div className="min-h-screen bg-[#0a0f1e] text-white">

        {/* ── Hero Header ── */}
        <div className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-transparent pointer-events-none" />
          <div className="max-w-3xl mx-auto px-6 py-14 relative">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs px-3 py-1.5 rounded-full mb-4">
              ✦ Pengajuan Kampanye Baru
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Buat Kampanye Donasi
            </h1>
            <p className="text-gray-400 text-sm md:text-base max-w-lg">
              Lengkapi seluruh informasi di bawah ini. Kampanye akan ditinjau admin sebelum ditampilkan ke publik.
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-10">

          {/* ── Status profil ── */}
          {checkingProfile && (
            <div className="mb-6 flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm text-gray-400">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
              Memeriksa kelengkapan profil...
            </div>
          )}

          {profileIncomplete && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 text-sm space-y-2">
              <p className="font-semibold text-red-300">Profil belum lengkap</p>
              <p className="text-red-400/80">Hubungkan akun berikut sebelum membuat kampanye:</p>
              <ul className="list-disc list-inside text-red-400 space-y-0.5 ml-1">
                {!hasTwitter && <li>Twitter belum dihubungkan</li>}
                {!hasEmail   && <li>Email belum dihubungkan</li>}
              </ul>
              <a href="/profile" className="inline-block mt-1 text-indigo-400 hover:text-indigo-300 font-medium transition">
                Lengkapi profil →
              </a>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── 01 Info Kampanye ── */}
            <FormSection step="01" title="Info Kampanye" desc="Informasi utama yang akan ditampilkan kepada calon donatur.">
              <DarkInput
                label="Judul Kampanye" required
                value={title} onChange={setTitle} disabled={loading}
                placeholder="Contoh: Bantu Biaya Operasi Pak Ahmad"
              />
              <DarkTextArea
                label="Deskripsi" required
                value={desc} onChange={setDesc} disabled={loading}
                placeholder="Ceritakan kondisi yang dihadapi, untuk apa dana ini digunakan, dan bagaimana donasi akan membantu..."
                rows={5}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DarkInput
                  label="Target Dana (ETH)" required type="number"
                  value={goal} onChange={setGoal} disabled={loading}
                  placeholder="0.5"
                />
                <DarkInput
                  label="Durasi Kampanye (hari)" required type="number"
                  value={duration} onChange={setDuration} disabled={loading}
                  placeholder="30"
                />
              </div>
              <DarkInput
                label="Lokasi Penerima / Bencana" required
                value={location} onChange={setLocation} disabled={loading}
                placeholder="Contoh: Jakarta Selatan, DKI Jakarta"
              />
              <DarkInput
                label="Link Sosial Media" required
                value={social} onChange={setSocial} disabled={loading}
                placeholder="https://twitter.com/... atau https://linktr.ee/..."
              />
            </FormSection>

            {/* ── 02 Gambar Kampanye ── */}
            <FormSection step="02" title="Gambar Kampanye" desc="Foto utama yang mewakili kampanye Anda. Gunakan gambar yang relevan dan berkualitas baik.">
              <div>
                {imageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/10">
                    <img src={imageUrl} alt="Preview" className="w-full h-56 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                      <label className="cursor-pointer bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs px-3 py-1.5 rounded-lg transition backdrop-blur-sm">
                        Ganti Gambar
                        <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading || loading} className="hidden" />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center gap-3 w-full h-44 border-2 border-dashed rounded-xl cursor-pointer transition ${uploading ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/15 hover:border-indigo-500/40 hover:bg-white/[0.02]'}`}>
                    <div className="text-center">
                      {uploading ? (
                        <>
                          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          <p className="text-sm text-indigo-400">Mengupload ke IPFS...</p>
                        </>
                      ) : (
                        <>
                          <div className="text-3xl mb-2 opacity-40">🖼</div>
                          <p className="text-sm text-gray-400 font-medium">Klik untuk upload gambar</p>
                          <p className="text-xs text-gray-600 mt-1">PNG, JPG, WEBP — disimpan di IPFS</p>
                        </>
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading || loading} className="hidden" />
                  </label>
                )}
              </div>
            </FormSection>

            {/* ── 03 Kategori ── */}
            <FormSection step="03" title="Kategori Penyelenggara" desc="Pilih kategori yang sesuai. Setiap kategori memiliki persyaratan dokumen berbeda.">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.keys(CATEGORY_LABELS).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleCategoryChange(key)}
                    disabled={loading}
                    className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition ${
                      category === key
                        ? 'border-indigo-500 bg-indigo-500/15 ring-1 ring-indigo-500/30'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-2xl">{CATEGORY_ICONS[key]}</span>
                    <div>
                      <p className={`text-xs font-semibold leading-snug ${category === key ? 'text-indigo-300' : 'text-gray-300'}`}>
                        {CATEGORY_LABELS[key]}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 leading-snug">{CATEGORY_DESCS[key]}</p>
                    </div>
                    {category === key && (
                      <span className="text-xs text-indigo-400 font-medium mt-auto">✓ Dipilih</span>
                    )}
                  </button>
                ))}
              </div>
            </FormSection>

            {/* ── 04 Dokumen Legitimasi ── */}
            {category && (
              <FormSection step="04" title="Dokumen Legitimasi" desc="Upload dokumen pendukung sebagai bukti legitimasi. Format: PDF, JPG, PNG. Maks 5MB per file.">
                <div className="space-y-4">
                  {currentDocs.map(doc => (
                    <div key={doc.key} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-200">
                          {doc.label}
                          {doc.required
                            ? <span className="text-red-400 ml-1">*</span>
                            : <span className="text-gray-500 ml-1 text-xs font-normal">(opsional)</span>
                          }
                        </label>
                        {docUrls[doc.key] && (
                          <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                            ✓ Terupload
                          </span>
                        )}
                      </div>

                      {docUrls[doc.key] ? (
                        <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                          <a
                            href={docUrls[doc.key]} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-300 truncate max-w-[200px] transition"
                          >
                            {docNames[doc.key]} ↗
                          </a>
                          <label className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer transition">
                            Ganti
                            <input type="file" accept={doc.accept} onChange={e => handleDocUpload(doc.key, e)} disabled={docUploading[doc.key] || loading} className="hidden" />
                          </label>
                        </div>
                      ) : (
                        <label className={`flex items-center gap-3 w-full border border-dashed rounded-lg px-4 py-3 cursor-pointer transition text-sm ${
                          docUploading[doc.key]
                            ? 'border-indigo-500/40 bg-indigo-500/5'
                            : 'border-white/15 hover:border-indigo-500/30 hover:bg-white/[0.02]'
                        }`}>
                          {docUploading[doc.key] ? (
                            <>
                              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
                              <span className="text-indigo-400 text-xs">Mengupload...</span>
                            </>
                          ) : (
                            <>
                              <span className="text-gray-600 text-base">📎</span>
                              <span className="text-gray-500 text-xs">Pilih file untuk diupload</span>
                            </>
                          )}
                          <input type="file" accept={doc.accept} onChange={e => handleDocUpload(doc.key, e)} disabled={docUploading[doc.key] || loading} className="hidden" />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </FormSection>
            )}

            {/* ── 05 Informasi Kontak ── */}
            <FormSection step={category ? '05' : '04'} title="Informasi Kontak" desc="Kontak yang bisa dihubungi oleh admin atau donatur untuk verifikasi.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DarkInput
                  label="Nama PIC / Penanggung Jawab" required
                  value={contact.nama}
                  onChange={(v: string) => setContact(p => ({ ...p, nama: v }))}
                  disabled={loading}
                  placeholder="Nama lengkap"
                />
                <DarkInput
                  label="No. WhatsApp" required
                  value={contact.whatsapp}
                  onChange={(v: string) => setContact(p => ({ ...p, whatsapp: v }))}
                  disabled={loading}
                  placeholder="+6281234567890"
                />
                <DarkInput
                  label="Email Kontak" required type="email"
                  value={contact.email}
                  onChange={(v: string) => setContact(p => ({ ...p, email: v }))}
                  disabled={loading}
                  placeholder="email@contoh.com"
                />
                <DarkInput
                  label="Website"
                  value={contact.website}
                  onChange={(v: string) => setContact(p => ({ ...p, website: v }))}
                  disabled={loading}
                  placeholder="https://... (opsional)"
                />
              </div>
              <DarkTextArea
                label="Alamat Lengkap" required
                value={contact.alamat}
                onChange={(v: string) => setContact(p => ({ ...p, alamat: v }))}
                disabled={loading}
                placeholder="Jl. Contoh No. 1, Kelurahan, Kecamatan, Kota, Provinsi"
                rows={3}
              />
            </FormSection>

            {/* ── Disclaimer ── */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-4 text-xs text-amber-300/80 leading-relaxed">
              <span className="font-semibold text-amber-300">Catatan:</span> Kampanye yang diajukan akan ditinjau
              oleh admin sebelum ditampilkan kepada publik. Pastikan semua informasi dan dokumen yang diunggah
              akurat dan dapat dipertanggungjawabkan.
            </div>

            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={loading || profileIncomplete || checkingProfile}
              className="w-full py-4 rounded-xl font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Memproses...
                </span>
              ) : 'Ajukan Kampanye'}
            </button>

          </form>
        </div>
      </div>
    </>
  );
}

// ─── Sub Components ──────────────────────────────────────────────────────────

function FormSection({ step, title, desc, children }: {
  step: string; title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 space-y-5">
      <div className="flex items-start gap-4 pb-4 border-b border-white/10">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold shrink-0 mt-0.5">
          {step}
        </span>
        <div>
          <h2 className="font-semibold text-white text-base">{title}</h2>
          <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function DarkInput({ label, value, onChange, disabled, type = 'text', placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  disabled: boolean; type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition disabled:opacity-50"
      />
    </div>
  );
}

function DarkTextArea({ label, value, onChange, disabled, placeholder, rows = 4, required }: {
  label: string; value: string; onChange: (v: string) => void;
  disabled: boolean; placeholder?: string; rows?: number; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition resize-none disabled:opacity-50"
      />
    </div>
  );
}
