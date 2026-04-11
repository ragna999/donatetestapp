import { NextRequest, NextResponse } from 'next/server';

const PINATA_API_KEY = process.env.PINATA_API_KEY!;
const PINATA_SECRET  = process.env.PINATA_SECRET!;

// GET /api/pinata/comments?campaignAddress=0x...
export async function GET(req: NextRequest) {
  if (!PINATA_API_KEY || !PINATA_SECRET) {
    return NextResponse.json({ error: 'Pinata credentials not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const campaignAddress = searchParams.get('campaignAddress');
  if (!campaignAddress) {
    return NextResponse.json({ error: 'campaignAddress required' }, { status: 400 });
  }

  try {
    const url =
      `https://api.pinata.cloud/data/pinList?status=pinned` +
      `&metadata[keyvalues][type][value]=campaign-comment&metadata[keyvalues][type][op]=eq` +
      `&metadata[keyvalues][campaignAddress][value]=${campaignAddress.toLowerCase()}&metadata[keyvalues][campaignAddress][op]=eq` +
      `&pageLimit=50`;

    const res = await fetch(url, {
      headers: {
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Pinata error: ${text}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ rows: data.rows ?? [] });
  } catch (e) {
    console.error('Pinata comments fetch error:', e);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}

// POST /api/pinata/comments
export async function POST(req: NextRequest) {
  if (!PINATA_API_KEY || !PINATA_SECRET) {
    return NextResponse.json({ error: 'Pinata credentials not configured' }, { status: 500 });
  }

  try {
    const { comment, campaignAddress } = await req.json();
    if (!comment || !campaignAddress) {
      return NextResponse.json({ error: 'comment and campaignAddress required' }, { status: 400 });
    }

    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET,
      },
      body: JSON.stringify({
        pinataContent: comment,
        pinataMetadata: {
          name: `campaign-comment-${campaignAddress.toLowerCase()}`,
          keyvalues: {
            type: 'campaign-comment',
            campaignAddress: campaignAddress.toLowerCase(),
          },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Pinata error: ${body}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ cid: data.IpfsHash });
  } catch (e) {
    console.error('Pinata comments post error:', e);
    return NextResponse.json({ error: 'Post failed' }, { status: 500 });
  }
}
