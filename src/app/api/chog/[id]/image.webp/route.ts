import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const CID = 'bafybeihau2egcccbdxymeckmmbrqytbfor5gkt3en6d5fsbueymdbq7g6e';
const GATEWAYS = [
  'https://cloudflare-ipfs.com/ipfs/' + CID,
  'https://gateway.pinata.cloud/ipfs/' + CID,
  'https://ipfs.io/ipfs/' + CID,
];

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tokenId = Math.max(1, Math.min(1969, parseInt(params.id) || 1));

  for (const gw of GATEWAYS) {
    try {
      const targetUrl = gw + '/' + tokenId + '.webp';
      const res = await fetch(targetUrl, {
        next: { revalidate: 604800 }, // cache 7 days
        signal: AbortSignal.timeout(4000), // 4s timeout per gateway
      });

      if (!res.ok) continue;

      const resHeaders = new Headers(res.headers);
      resHeaders.set('Access-Control-Allow-Origin', '*');
      resHeaders.set('Cache-Control', 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400, immutable');

      return new NextResponse(res.body, {
        status: res.status,
        headers: resHeaders,
      });
    } catch {
      // try next gateway
    }
  }

  // Fallback: redirect browser directly to Cloudflare IPFS
  return NextResponse.redirect(
    'https://cloudflare-ipfs.com/ipfs/' + CID + '/' + tokenId + '.webp',
    302
  );
}
