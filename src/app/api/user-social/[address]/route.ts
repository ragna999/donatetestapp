import { NextRequest, NextResponse } from 'next/server';

const PRIVY_APP_ID     = 'cmd8u9f7200fnju0mfqxq836a';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  if (!PRIVY_APP_SECRET) {
    console.error('PRIVY_APP_SECRET not set');
    return NextResponse.json({ twitter: null, email: null }, { status: 500 });
  }

  try {
    const credentials = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64');

    const res = await fetch(
      `https://auth.privy.io/api/v1/users?wallet_address=${address.toLowerCase()}`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'privy-app-id': PRIVY_APP_ID,
          'Content-Type': 'application/json',
        },
      }
    );

    const raw = await res.json();

    if (!res.ok) {
      return NextResponse.json({ twitter: null, email: null });
    }

    // Privy bisa return { data: [...] } atau langsung array
    const users: any[] = Array.isArray(raw) ? raw : (raw?.data ?? []);

    // Filter manual: cari user yang punya linked_account wallet = address yang diminta
    const normalizedTarget = address.toLowerCase();
    const user = users.find((u) => {
      const linked: any[] = u.linked_accounts ?? [];
      return linked.some(
        (a) =>
          (a.type === 'wallet' || a.type === 'ethereum' || a.chain_type === 'ethereum') &&
          a.address?.toLowerCase() === normalizedTarget
      );
    }) ?? null;

    if (!user) {
      return NextResponse.json({ twitter: null, email: null });
    }

    const linked: any[] = user.linked_accounts ?? [];
    const twitterAccount = linked.find((a) => a.type === 'twitter_oauth');
    const emailAccount   = linked.find((a) => a.type === 'email');

    return NextResponse.json({
      twitter: twitterAccount?.username ?? null,
      email:   emailAccount?.address   ?? null,
    });
  } catch (e) {
    console.error('Privy fetch error:', e);
    return NextResponse.json({ twitter: null, email: null });
  }
}
