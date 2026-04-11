'use client';

import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { uploadToPinata, uploadJSONToPinata } from '../utils/uploadToPinata';
import { FACTORY_ADDRESS } from '../lib/config';

const CAMPAIGN_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "_adminContract", "type": "address" }],
    "stateMutability": "nonpayable", "type": "constructor"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "_title", "type": "string" },
      { "internalType": "string", "name": "_desc", "type": "string" },
      { "internalType": "string", "name": "_image", "type": "string" },
      { "internalType": "uint256", "name": "_goal", "type": "uint256" },
      { "internalType": "string", "name": "_location", "type": "string" },
      { "internalType": "uint256", "name": "_duration", "type": "uint256" },
      { "internalType": "string", "name": "_social", "type": "string" }
    ],
    "name": "createCampaign", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [], "name": "getApprovedCampaigns",
    "outputs": [{ "internalType": "address[]", "name": "result", "type": "address[]" }],
    "stateMutability": "view", "type": "function"
  },
];

// ─── Kategori & Dokumen ────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  yayasan: 'Yayasan / Lembaga Resmi',
  perorangan_medis: 'Perorangan — Keluarga Sakit / Medis',
  perorangan_bencana: 'Perorangan — Bencana / Darurat',
};

type DocReq = { key: string; label: string; accept: string; required: boolean };

const DOC_REQUIREMENTS: Record<string, DocReq[]> = {
  yayasan: [
    { key: 'akta',        label: 'Akta Pendirian Yayasan',              accept: '.pdf',                       required: true  },
    { key: 'sk',          label: 'SK Kemenkumham',                      accept: '.pdf',                       required: true  },
    { key: 'npwp',        label: 'NPWP Yayasan (opsional)',              accept: '.pdf,.jpg,.jpeg,.png',        required: false },
    { key: 'ktp_pengurus',label: 'KTP Pengurus yang Mendaftar',         accept: '.jpg,.jpeg,.png',             required: true  },
  ],
  perorangan_medis: [
    { key: 'ktp',         label: 'KTP Pemohon',                         accept: '.jpg,.jpeg,.png',             required: true  },
    { key: 'kk',          label: 'Kartu Keluarga',                      accept: '.jpg,.jpeg,.png',             required: true  },
    { key: 'surat_dokter',label: 'Surat Keterangan Dokter / Diagnosis', accept: '.pdf,.jpg,.jpeg,.png',        required: true  },
    { key: 'foto_pasien', label: 'Foto Kondisi Pasien (opsional)',       accept: '.jpg,.jpeg,.png',             required: false },
  ],
  perorangan_bencana: [
    { key: 'ktp',         label: 'KTP Pemohon',                         accept: '.jpg,.jpeg,.png',             required: true  },
    { key: 'surat_rtrw',  label: 'Surat Keterangan RT/RW atau Kelurahan', accept: '.pdf,.jpg,.jpeg,.png',      required: true  },
    { key: 'foto_bencana',label: 'Foto Kondisi / Lokasi Bencana',       accept: '.jpg,.jpeg,.png',             required: true  },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────

export default function CreateCampaignPage() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  // Info dasar
  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [goal,     setGoal]     = useState('');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState('');
  const [social,   setSocial]   = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Status
  const [uploading,        setUploading]        = useState(false);
  const [loading,          setLoading]          = useState(false);
  const [checkingProfile,  setCheckingProfile]  = useState(true);
  const [hasTwitter,       setHasTwitter]       = useState(false);
  const [hasEmail,         setHasEmail]         = useState(false);

  // Kategori & dokumen
  const [category,     setCategory]     = useState('');
  const [docUrls,      setDocUrls]      = useState<Record<string, string>>({});
  const [docNames,     setDocNames]     = useState<Record<string, string>>({});
  const [docUploading, setDocUploading] = useState<Record<string, boolean>>({});

  // Kontak
  const [contact, setContact] = useState({
    nama: '', whatsapp: '', email: '', alamat: '', website: '',
  });

  // ─── Cek profil ─────────────────────────────────────────────────────────
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

  // ─── Upload gambar ───────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToPinata(file);
      setImageUrl(url);
    } catch {
      alert('❌ Upload gambar gagal');
    } finally {
      setUploading(false);
    }
  };

  // ─── Upload dokumen ──────────────────────────────────────────────────────
  const handleDocUpload = async (docKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('❌ Ukuran file maksimal 5MB');
      return;
    }
    setDocUploading(prev => ({ ...prev, [docKey]: true }));
    try {
      const url = await uploadToPinata(file);
      setDocUrls(prev => ({ ...prev, [docKey]: url }));
      setDocNames(prev => ({ ...prev, [docKey]: file.name }));
    } catch {
      alert('❌ Upload dokumen gagal');
    } finally {
      setDocUploading(prev => ({ ...prev, [docKey]: false }));
    }
  };

  // ─── Reset dokumen saat kategori berubah ────────────────────────────────
  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setDocUrls({});
    setDocNames({});
  };

  // ─── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const wallet = wallets[0];
      if (!wallet) { alert('❌ Wallet tidak ditemukan'); return; }
      const address = wallet.address;

      // Guard profil
      const profileRes = await fetch(`/api/user-social/${address}`);
      const profileData = await profileRes.json();
      if (!profileData.twitter || !profileData.email) {
        alert('❌ Kamu harus menghubungkan Twitter dan Email di profil sebelum membuat kampanye.');
        return;
      }

      // Validasi sosmed
      if (!social || !social.startsWith('http')) {
        alert('❌ Masukkan link sosial media yang valid!');
        return;
      }

      // Validasi kategori
      if (!category) {
        alert('❌ Pilih kategori penyelenggara terlebih dahulu.');
        return;
      }

      // Validasi dokumen wajib
      const requiredDocs = DOC_REQUIREMENTS[category].filter(d => d.required);
      for (const doc of requiredDocs) {
        if (!docUrls[doc.key]) {
          alert(`❌ Upload "${doc.label}" terlebih dahulu.`);
          return;
        }
      }

      // Validasi kontak
      if (!contact.nama.trim() || !contact.whatsapp.trim() || !contact.email.trim() || !contact.alamat.trim()) {
        alert('❌ Lengkapi semua informasi kontak (Nama, WhatsApp, Email, Alamat).');
        return;
      }

      // Build dokumen list
      const documents = DOC_REQUIREMENTS[category]
        .filter(d => docUrls[d.key])
        .map(d => ({ key: d.key, label: d.label, url: docUrls[d.key] }));

      // Build metadata JSON
      const metadata = {
        version: '1',
        category,
        categoryLabel: CATEGORY_LABELS[category],
        contact: {
          nama:      contact.nama.trim(),
          whatsapp:  contact.whatsapp.trim(),
          email:     contact.email.trim(),
          alamat:    contact.alamat.trim(),
          website:   contact.website.trim(),
        },
        social,
        documents,
      };

      // Upload metadata ke Pinata
      const metadataUrl = await uploadJSONToPinata(metadata, `campaign-meta-${Date.now()}`);

      // Kirim ke blockchain
      const eip1193          = await wallet.getEthereumProvider();
      const provider         = new ethers.BrowserProvider(eip1193);
      const signer           = await provider.getSigner();
      const factory          = new ethers.Contract(FACTORY_ADDRESS, CAMPAIGN_ABI, signer);
      const goalInWei        = ethers.parseEther(goal);
      const durationInSeconds = parseInt(duration) * 86400;

      const tx = await factory.createCampaign(
        title, desc, imageUrl || '', goalInWei, location, durationInSeconds,
        metadataUrl  // metadata IPFS URL sebagai _social
      );
      await tx.wait();
      alert('✅ Kampanye berhasil dibuat! Menunggu persetujuan admin.');

      // Reset form
      setTitle(''); setDesc(''); setGoal(''); setLocation(''); setDuration('');
      setSocial(''); setImageUrl(null); setCategory(''); setDocUrls({}); setDocNames({});
      setContact({ nama: '', whatsapp: '', email: '', alamat: '', website: '' });

    } catch (err: any) {
      console.error(err);
      alert('❌ Gagal membuat campaign: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const profileIncomplete = !checkingProfile && (!hasTwitter || !hasEmail);
  const currentDocs       = category ? DOC_REQUIREMENTS[category] : [];

  return (
    <div className="max-w-2xl mx-auto mt-10 mb-16 p-6 bg-white rounded-xl shadow text-gray-800">
      <h1 className="text-2xl font-bold mb-6 text-center">Buat Kampanye Donasi</h1>

      {/* Status profil */}
      {checkingProfile && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-500 text-center">
          Memeriksa kelengkapan profil...
        </div>
      )}
      {profileIncomplete && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 space-y-1">
          <p className="font-semibold">Profil belum lengkap</p>
          <p>Kamu harus menghubungkan akun berikut sebelum membuat kampanye:</p>
          <ul className="list-disc list-inside mt-1">
            {!hasTwitter && <li>Twitter belum dihubungkan</li>}
            {!hasEmail   && <li>Email belum dihubungkan</li>}
          </ul>
          <a href="/profile" className="inline-block mt-2 underline font-medium">Lengkapi profil →</a>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* ── Seksi 1: Info Dasar ── */}
        <Section title="Info Kampanye">
          <Input  label="Judul Kampanye"            value={title}    onChange={setTitle}    loading={loading} />
          <TextArea label="Deskripsi"               value={desc}     onChange={setDesc}     loading={loading} />
          <Input  label="Target Dana (ETH)"         value={goal}     onChange={setGoal}     loading={loading} type="number" />
          <Input  label="Lokasi Penerima / Bencana" value={location} onChange={setLocation} loading={loading} />
          <Input  label="Durasi Kampanye (hari)"    value={duration} onChange={setDuration} loading={loading} type="number" />
          <Input  label="Link Sosial Media (Twitter / Linktree)" value={social} onChange={setSocial} loading={loading} />
        </Section>

        {/* ── Seksi 2: Gambar ── */}
        <Section title="Gambar Kampanye">
          <div>
            <input
              type="file" accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading || loading}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {uploading && <p className="text-sm text-blue-400 mt-2">Uploading ke IPFS...</p>}
            {imageUrl  && <img src={imageUrl} alt="Preview" className="mt-4 rounded-md w-full h-56 object-cover border" />}
          </div>
        </Section>

        {/* ── Seksi 3: Kategori ── */}
        <Section title="Kategori Penyelenggara">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pilih kategori <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={e => handleCategoryChange(e.target.value)}
              disabled={loading}
              className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              required
            >
              <option value="">-- Pilih kategori --</option>
              <option value="yayasan">Yayasan / Lembaga Resmi</option>
              <option value="perorangan_medis">Perorangan — Keluarga Sakit / Medis</option>
              <option value="perorangan_bencana">Perorangan — Bencana / Darurat</option>
            </select>
          </div>
        </Section>

        {/* ── Seksi 4: Dokumen Legitimasi ── */}
        {category && (
          <Section title="Dokumen Legitimasi">
            <p className="text-xs text-gray-500 -mt-2 mb-1">Format: PDF, JPG, PNG. Maks 5MB per file.</p>
            <div className="space-y-4">
              {currentDocs.map(doc => (
                <div key={doc.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {doc.label}
                    {doc.required
                      ? <span className="text-red-500 ml-1">*</span>
                      : <span className="text-gray-400 ml-1 font-normal">(opsional)</span>
                    }
                  </label>
                  <input
                    type="file"
                    accept={doc.accept}
                    onChange={e => handleDocUpload(doc.key, e)}
                    disabled={docUploading[doc.key] || loading}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  {docUploading[doc.key] && (
                    <p className="text-xs text-blue-400 mt-1">Uploading ke IPFS...</p>
                  )}
                  {docUrls[doc.key] && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <span>✓</span>
                      <a href={docUrls[doc.key]} target="_blank" rel="noopener noreferrer"
                        className="underline truncate max-w-xs">
                        {docNames[doc.key]}
                      </a>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Seksi 5: Kontak ── */}
        <Section title="Informasi Kontak">
          <p className="text-xs text-gray-500 -mt-2 mb-1">
            Kontak yang bisa dihubungi oleh admin atau donor untuk verifikasi.
          </p>
          <div className="space-y-4">
            <Input
              label="Nama PIC / Penanggung Jawab"
              value={contact.nama}
              onChange={(v: string) => setContact(p => ({ ...p, nama: v }))}
              loading={loading}
            />
            <Input
              label="No. WhatsApp (contoh: +6281234567890)"
              value={contact.whatsapp}
              onChange={(v: string) => setContact(p => ({ ...p, whatsapp: v }))}
              loading={loading}
            />
            <Input
              label="Email Kontak"
              value={contact.email}
              onChange={(v: string) => setContact(p => ({ ...p, email: v }))}
              loading={loading}
              type="email"
            />
            <TextArea
              label="Alamat"
              value={contact.alamat}
              onChange={(v: string) => setContact(p => ({ ...p, alamat: v }))}
              loading={loading}
            />
            <Input
              label="Website (opsional)"
              value={contact.website}
              onChange={(v: string) => setContact(p => ({ ...p, website: v }))}
              loading={loading}
            />
          </div>
        </Section>

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={loading || profileIncomplete || checkingProfile}
          className={`w-full py-3 px-4 rounded-lg text-white font-semibold transition ${
            loading || profileIncomplete || checkingProfile
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? '⏳ Memproses...' : 'Buat Kampanye'}
        </button>
      </form>
    </div>
  );
}

// ─── Sub Components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, loading, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; loading: boolean; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        disabled={loading}
      />
    </div>
  );
}

function TextArea({ label, value, onChange, loading }: {
  label: string; value: string; onChange: (v: string) => void; loading: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={4}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        disabled={loading}
      />
    </div>
  );
}
