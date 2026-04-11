import { NextRequest, NextResponse } from 'next/server';

const PINATA_API_KEY = process.env.PINATA_API_KEY!;
const PINATA_SECRET  = process.env.PINATA_SECRET!;

export async function POST(req: NextRequest) {
  if (!PINATA_API_KEY || !PINATA_SECRET) {
    return NextResponse.json({ error: 'Pinata credentials not configured' }, { status: 500 });
  }

  try {
    const { content, name, keyvalues } = await req.json();
    if (!content) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 });
    }

    const body: Record<string, unknown> = {
      pinataContent: content,
      pinataMetadata: { name: name ?? 'upload', ...(keyvalues ? { keyvalues } : {}) },
    };

    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Pinata error: ${text}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}` });
  } catch (e) {
    console.error('Pinata upload-json error:', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
