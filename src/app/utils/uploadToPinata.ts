/**
 * Upload file ke IPFS via Pinata (melalui API route backend)
 * @param file File gambar yang dipilih user
 * @returns URL gateway Pinata (langsung bisa dipakai di <img src="..." />)
 */
export async function uploadToPinata(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/pinata/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Upload gagal');
  }

  const data = await res.json();
  return data.url;
}

/**
 * Upload JSON object ke IPFS via Pinata (melalui API route backend)
 * @returns URL gateway Pinata
 */
export async function uploadJSONToPinata(content: object, name: string): Promise<string> {
  const res = await fetch('/api/pinata/upload-json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, name }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Upload metadata gagal');
  }

  const data = await res.json();
  return data.url;
}
