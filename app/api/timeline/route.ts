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

    // Önce kullanıcının following listesini al
    const followingResponse = await fetch(
      `https://api.twitter.com/2/users/${session.user.id}/following`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!followingResponse.ok) {
      console.error('Failed to fetch following list:', await followingResponse.text());
      throw new Error('Failed to fetch following list');
    }

    const followingData = await followingResponse.json();
    
    if (!followingData.data || !Array.isArray(followingData.data)) {
      console.error('Invalid following data:', followingData);
      throw new Error('Invalid following data structure');
    }

    // Her bir takip edilen kullanıcının son tweet'lerini al
    const allTweets: Tweet[] = [];
    const userPromises = followingData.data.slice(0, 5).map(async (user: User) => {
      const userTimelineResponse = await fetch(
        `https://api.twitter.com/2/users/${user.id}/tweets?max_results=5&tweet.fields=created_at,public_metrics,author_id,text&expansions=author_id&user.fields=profile_image_url,name,username`,
        {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
          },
        }
      );

      if (!userTimelineResponse.ok) {
        console.warn(`Failed to fetch tweets for user ${user.id}:`, await userTimelineResponse.text());
        return [];
      }

      const timelineData = await userTimelineResponse.json();
      return timelineData.data || [];
    });

    const userResults = await Promise.allSettled(userPromises);
    userResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        allTweets.push(...result.value);
      }
    });

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
    const users = followingData.data;

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