import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyzeSentiment } from '@/lib/sentiment';
import { createTweetsTable, cacheTweets, getCachedTweets, getCacheAge } from '@/lib/db';

// Retry configuration
const MAX_RETRY_COUNT = 2;
const BASE_DELAY = 2000; // 2 seconds

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Parse rate limit reset time
function parseRateLimitReset(resetHeader: string | null): Date | null {
  if (!resetHeader) return null;
  const timestamp = parseInt(resetHeader);
  if (isNaN(timestamp)) return null;
  
  const resetDate = new Date(timestamp * 1000);
  // If the reset date is more than 24 hours in the future, something's wrong
  if (resetDate.getTime() - Date.now() > 24 * 60 * 60 * 1000) {
    return null;
  }
  return resetDate;
}

// Rate limit kontrolü için
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 dakika
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 saat

// Twitter API'den gelen reset timestamp'i saniyeye çevirme
function calculateRetryAfterSeconds(resetTimestamp: string | number): number {
  if (typeof resetTimestamp === 'string') {
    const resetDate = new Date(resetTimestamp).getTime();
    const now = Date.now();
    return Math.max(0, Math.ceil((resetDate - now) / 1000));
  }
  return Math.max(0, Math.ceil(Number(resetTimestamp) - Date.now() / 1000));
}

export async function GET(req: NextRequest) {
  try {
    // Auth kontrolü
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // URL'den cursor parametresini al
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');

    // Veritabanı tablolarını oluştur
    await createTweetsTable();

    // X API endpoint'i
    const endpoint = `https://api.twitter.com/2/users/${session.user.id}/liked_tweets`;
    const params = new URLSearchParams({
      'tweet.fields': 'created_at,public_metrics,text',
      'user.fields': 'profile_image_url',
      'expansions': 'author_id',
      'max_results': '10',
    });

    if (cursor) {
      params.append('pagination_token', cursor);
    }

    // X API'ye istek at
    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`X API error: ${response.status}`);
    }

    const data = await response.json();

    // Tweet'leri ve kullanıcıları hazırla
    const tweets = await Promise.all(data.data.map(async (tweet: any) => {
      // Her tweet için duygu analizi yap
      const sentiment = await analyzeSentiment(tweet.text);
      return {
        ...tweet,
        sentiment
      };
    }));

    const users = data.includes.users;

    // Tweet'leri ve kullanıcıları cache'le
    await cacheTweets(tweets, users);

    return NextResponse.json({
      tweets,
      users,
      next_token: data.meta.next_token
    });

  } catch (error: any) {
    console.error('Tweet fetch error:', error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.status || 500 }
    );
  }
} 