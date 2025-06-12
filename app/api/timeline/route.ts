import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyzeSentiment } from '@/lib/sentiment';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // URL'den parametreleri al
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const threshold = parseFloat(searchParams.get('threshold') || '0.7'); // Varsayılan 0.7

    // X API endpoint'i
    const endpoint = `https://api.twitter.com/2/users/${session.user.id}/home_timeline`;
    const params = new URLSearchParams({
      'tweet.fields': 'created_at,public_metrics,author_id',
      'user.fields': 'profile_image_url',
      'expansions': 'author_id',
      'max_results': '20',
    });

    if (cursor) {
      params.append('pagination_token', cursor);
    }

    // X API'sine istek at
    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Twitter API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Tweet'leri analiz et
    const tweets = await Promise.all(data.data.map(async (tweet: any) => {
      const sentiment = await analyzeSentiment(tweet.text);
      return {
        ...tweet,
        sentiment,
        isPositive: sentiment.score >= threshold
      };
    }));

    // İstatistikleri hesapla
    const stats = {
      total: tweets.length,
      positive: tweets.filter(t => t.isPositive).length,
      filtered: tweets.filter(t => !t.isPositive).length
    };

    // Sadece pozitif tweet'leri döndür
    return NextResponse.json({
      tweets: tweets.filter(t => t.isPositive),
      users: data.includes.users,
      next_token: data.meta.next_token,
      stats
    });

  } catch (error) {
    console.error('Timeline error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch timeline' },
      { status: 500 }
    );
  }
} 