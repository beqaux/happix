import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyzeSentiment } from '@/lib/sentiment';

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
}

interface User {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}

// Rate limit yönetimi için yardımcı fonksiyonlar
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  let lastError;
  let waitTime = 1000; // Başlangıç bekleme süresi: 1 saniye

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      // Rate limit headers'ı kontrol et
      const remaining = response.headers.get('x-rate-limit-remaining');
      const reset = response.headers.get('x-rate-limit-reset');
      
      if (remaining && parseInt(remaining) < 2) {
        console.warn(`Rate limit almost exceeded. ${remaining} requests remaining. Reset at ${new Date(parseInt(reset!) * 1000)}`);
      }

      if (response.status === 429) {
        // Rate limit aşıldı, bekleme süresini hesapla
        const resetTime = reset ? parseInt(reset) * 1000 : Date.now() + waitTime;
        const waitDuration = Math.max(0, resetTime - Date.now());
        
        console.warn(`Rate limit exceeded. Waiting ${waitDuration}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitDuration));
        continue;
      }

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      lastError = error;
      
      if (i < maxRetries - 1) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
        waitTime *= 2; // Her denemede bekleme süresini 2'ye katla
      }
    }
  }

  throw lastError;
}

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
    const threshold = parseFloat(searchParams.get('threshold') || '0.7');

    // Kullanıcının kendi tweet'lerini al
    const userTweetsResponse = await fetchWithRetry(
      `https://api.twitter.com/2/users/${session.user.id}/tweets?max_results=5&tweet.fields=created_at,public_metrics,author_id,text&expansions=author_id&user.fields=profile_image_url,name,username`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      }
    );

    const userTweetsData = await userTweetsResponse.json();
    const userTweets = userTweetsData.data || [];

    // Kullanıcının beğendiği tweet'leri al
    const likedTweetsResponse = await fetchWithRetry(
      `https://api.twitter.com/2/users/${session.user.id}/liked_tweets?max_results=5&tweet.fields=created_at,public_metrics,author_id,text&expansions=author_id&user.fields=profile_image_url,name,username`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      }
    );

    const likedTweetsData = await likedTweetsResponse.json();
    const likedTweets = likedTweetsData.data || [];

    // Tüm tweet'leri birleştir
    const allTweets = [...userTweets, ...likedTweets];

    // Tweet'leri tarihe göre sırala
    allTweets.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Tweet'leri analiz et
    const tweets = await Promise.all(allTweets.map(async (tweet) => {
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

    // Kullanıcı bilgilerini topla
    const users = [
      ...(userTweetsData.includes?.users || []),
      ...(likedTweetsData.includes?.users || [])
    ];

    // Sadece pozitif tweet'leri döndür
    return NextResponse.json({
      tweets: tweets.filter(t => t.isPositive),
      users,
      next_token: null, // Şimdilik pagination yok
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