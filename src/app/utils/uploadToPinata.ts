import axios from 'axios';

/**
 * Upload file ke IPFS via Pinata
 * @param file File gambar yang dipilih user
 * @returns URL gateway Pinata (langsung bisa dipakai di <img src="..." />)
 */
export async function uploadToPinata(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const metadata = JSON.stringify({ name: file.name });
  formData.append('pinataMetadata', metadata);

  const res = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
    maxBodyLength: Infinity,
    headers: {
      'Content-Type': 'multipart/form-data',
      pinata_api_key: process.env.NEXT_PUBLIC_PINATA_API_KEY!,
      pinata_secret_api_key: process.env.NEXT_PUBLIC_PINATA_SECRET!,
    },
  });

  const hash = res.data.IpfsHash;
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
}
