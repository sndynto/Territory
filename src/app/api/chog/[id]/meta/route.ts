import { NextRequest, NextResponse } from 'next/server';

const CID = 'bafybeid4ybujnscdipkno7ps5utqelp5ry5ryreqhay3zhgk3a6x4jruqu';

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
      const res = await fetch(`${gw}/${tokenId}.json`, {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      
      // Parse attributes into a simpler key/value object
      const attrs: Record<string, string> = {};
      if (Array.isArray(data.attributes)) {
        for (const attr of data.attributes) {
          if (attr.trait_type && attr.value) {
            attrs[attr.trait_type] = attr.value;
          }
        }
      }

      return NextResponse.json(attrs, {
        headers: {
          'Cache-Control': 'public, max-age=86400, immutable',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch {
      // try next
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
