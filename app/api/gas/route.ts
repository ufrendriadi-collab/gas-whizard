// app/api/gas/route.ts
import { NextResponse } from 'next/server';

// ============ CACHING SETUP ============
// In-memory cache
let gasCache: {
  data: any;
  timestamp: number;
} | null = null;

// Cache duration: 10 detik
const CACHE_DURATION = 10 * 1000; // 10 seconds

// ============ RATE LIMITING SETUP ============
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 menit
const MAX_REQUESTS_PER_WINDOW = 10; // max 10 request per menit per IP

// Helper function untuk check rate limit
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || [];
  
  // Filter request yang masih dalam window
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limit exceeded
  }
  
  // Tambah request baru
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  
  return true;
}

// Helper untuk get client IP
function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return realIp || 'unknown';
}

// ============ MAIN FUNCTION ============
export async function GET(request: Request) {
  // 1. Get client IP
  const clientIp = getClientIp(request);
  
  // 2. Check rate limit
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json(
      { 
        error: 'Terlalu banyak request. Coba lagi nanti.',
        retryAfter: 60 
      }, 
      { 
        status: 429,
        headers: {
          'Retry-After': '60',
        }
      }
    );
  }

  // 3. Check cache first
  const now = Date.now();
  if (gasCache && (now - gasCache.timestamp) < CACHE_DURATION) {
    console.log('✅ Returning cached data');
    return NextResponse.json({
      ...gasCache.data,
      cached: true,
      cacheAge: Math.floor((now - gasCache.timestamp) / 1000)
    });
  }

  // 4. Cache miss or expired - fetch fresh data
  const ALCHEMY_URL = process.env.ALCHEMY_RPC_URL;

  if (!ALCHEMY_URL) {
    return NextResponse.json(
      { error: 'API Key tidak ditemukan di server' }, 
      { status: 500 }
    );
  }

  try {
    console.log('🔄 Fetching fresh data from Alchemy...');
    
    const response = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_gasPrice',
        params: [],
      }),
    });

    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Validate response
    if (!data.result) {
      throw new Error('Invalid response from Alchemy');
    }

    // 5. Update cache
    gasCache = {
      data,
      timestamp: now,
    };

    console.log('✅ Fresh data cached');

    return NextResponse.json({
      ...data,
      cached: false,
      cacheAge: 0
    });
    
  } catch (error) {
    console.error('❌ Alchemy API Error:', error);
    
    // Kalau ada cache lama, return itu daripada error
    if (gasCache) {
      console.log('⚠️ Returning stale cache due to error');
      return NextResponse.json({
        ...gasCache.data,
        cached: true,
        stale: true,
        cacheAge: Math.floor((now - gasCache.timestamp) / 1000)
      });
    }
    
    return NextResponse.json(
      { error: 'Gagal fetch data dari Alchemy' }, 
      { status: 500 }
    );
  }
}