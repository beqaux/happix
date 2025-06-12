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

    // Session'da hata varsa (örn: token yenileme hatası)
    if (session.error === 'RefreshAccessTokenError') {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 }
      );
    }

    // URL'den parametreleri al
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const threshold = parseFloat(searchParams.get('threshold') || '0.7'); // Varsayılan 0.7

    // X API endpoint'i
    const endpoint = `https://api.twitter.com/2/users/${session.user.id}/home_timeline`;
    const params = new URLSearchParams({
      'tweet.fields': 'created_at,public_metrics,author_id,text',
      'user.fields': 'profile_image_url,name,username',
      'expansions': 'author_id',
      'max_results': '20',
    });

    if (cursor) {
      params.append('pagination_token', cursor);
    }

    console.log('Fetching from Twitter API:', endpoint);
    console.log('With params:', params.toString());
    console.log('Using token:', session.accessToken.substring(0, 10) + '...');

    // X API'sine istek at
    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      // API hatası detaylarını al
      let errorDetail;
      try {
        const error = await response.json();
        console.error('Twitter API error response:', error);
        errorDetail = error.detail || error.message || response.statusText;
      } catch (e) {
        console.error('Failed to parse error response:', e);
        errorDetail = response.statusText;
      }

      if (response.status === 401) {
        return NextResponse.json(
          { error: "Your session has expired. Please sign in again." },
          { status: 401 }
        );
      }

      throw new Error(`Twitter API error: ${errorDetail}`);
    }

    const rawData = await response.text(); // Önce text olarak al
    console.log('Raw API response:', rawData);

    let data;
    try {
      data = JSON.parse(rawData);
    } catch (e) {
      console.error('Failed to parse API response:', e);
      throw new Error('Invalid response from Twitter API');
    }

    // API yanıtını kontrol et
    if (!data || !Array.isArray(data.data)) {
      console.error('Unexpected API response structure:', data);
      return NextResponse.json({
        tweets: [],
        users: [],
        next_token: null,
        stats: { total: 0, positive: 0, filtered: 0 }
      });
    }
    
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
      users: data.includes?.users || [],
      next_token: data.meta?.next_token,
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