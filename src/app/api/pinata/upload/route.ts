import { NextRequest, NextResponse } from 'next/server';

const PINATA_API_KEY = process.env.PINATA_API_KEY!;
const PINATA_SECRET  = process.env.PINATA_SECRET!;

export async function POST(req: NextRequest) {
  if (!PINATA_API_KEY || !PINATA_SECRET) {
    return NextResponse.json({ error: 'Pinata credentials not configured' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const pinataForm = new FormData();
    pinataForm.append('file', file);

    const metadata = JSON.stringify({ name: file.name });
    pinataForm.append('pinataMetadata', metadata);

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET,
      },
      body: pinataForm,
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Pinata error: ${body}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}` });
  } catch (e) {
    console.error('Pinata upload error:', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
