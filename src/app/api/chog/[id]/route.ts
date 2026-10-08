import { NextRequest, NextResponse } from 'next/server';

const CID = 'bafybeihau2egcccbdxymeckmmbrqytbfor5gkt3en6d5fsbueymdbq7g6e';

// Server-side IPFS gateways (no CORS issue from server)
const GATEWAYS = [
  `https://gateway.pinata.cloud/ipfs/${CID}`,
  `https://dweb.link/ipfs/${CID}`,
  `https://ipfs.io/ipfs/${CID}`,
];

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tokenId = Math.max(1, Math.min(1969, parseInt(params.id) || 1));

  for (const gw of GATEWAYS) {
    try {
      const res = await fetch(`${gw}/${tokenId}.webp`, {
        next: { revalidate: 86400 }, // cache 24h
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;

      const buf = await res.arrayBuffer();
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=86400, immutable',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch {
      // try next gateway
    }
  }

  // All gateways failed — return 404
  return NextResponse.json({ error: 'Chog image not found' }, { status: 404 });
}
