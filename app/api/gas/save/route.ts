import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  // Verify request is from QStash
  const token = req.headers.get('upstash-signature');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch current gas price
    const response = await fetch(
      `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          params: [],
          id: 1,
        }),
      }
    );

    const data = await response.json();
    const gwei = parseInt(data.result, 16) / 1e9;

    // Save to Supabase
    const { error } = await supabase
      .from('gas_history')
      .insert({ gwei: gwei.toFixed(4) });

    if (error) throw error;

    return NextResponse.json({ success: true, gwei });
  } catch (error) {
    console.error('Save gas error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}