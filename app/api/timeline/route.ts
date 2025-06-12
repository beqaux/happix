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
    const userTweetsResponse = await fetch(
      `https://api.twitter.com/2/users/${session.user.id}/tweets?max_results=10&tweet.fields=created_at,public_metrics,author_id,text&expansions=author_id&user.fields=profile_image_url,name,username`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!userTweetsResponse.ok) {
      console.error('Failed to fetch user tweets:', await userTweetsResponse.text());
      throw new Error('Failed to fetch user tweets');
    }

    const userTweetsData = await userTweetsResponse.json();
    const userTweets = userTweetsData.data || [];

    // Kullanıcının beğendiği tweet'leri al
    const likedTweetsResponse = await fetch(
      `https://api.twitter.com/2/users/${session.user.id}/liked_tweets?max_results=10&tweet.fields=created_at,public_metrics,author_id,text&expansions=author_id&user.fields=profile_image_url,name,username`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!likedTweetsResponse.ok) {
      console.error('Failed to fetch liked tweets:', await likedTweetsResponse.text());
      throw new Error('Failed to fetch liked tweets');
    }

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