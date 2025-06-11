"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Tweet } from '../../types/tweet';
import { User } from '../../types/user';

interface SentimentAnalysis {
  score: number;
  category: string;
  type: string;
  stats: {
    bertScore: number;
    bertLabel: string;
    emojiScore: number;
    emojis: number;
  };
}

interface TweetWithSentiment extends Tweet {
  sentiment?: SentimentAnalysis;
}

export default function ArchivePage() {
  const { data: session } = useSession();
  const [tweets, setTweets] = useState<TweetWithSentiment[]>([]);
  const [users, setUsers] = useState<{ [key: string]: User }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('all'); // 'all', 'positive', 'negative', 'neutral'
  const [typeFilter, setTypeFilter] = useState<string>('all'); // 'all', 'komik', 'bilgilendirici', 'motivasyonel', 'sanatsal'

  useEffect(() => {
    if (session?.accessToken) {
      fetchTweets();
    }
  }, [session]);

  const fetchTweets = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/tweets');
      
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '60');
          setRetryAfter(retryAfter);
          throw new Error(`Rate limit exceeded. Try again in ${retryAfter} seconds.`);
        }
        throw new Error('Failed to fetch tweets');
      }

      const data = await response.json();
      
      // Her tweet için duygu analizi yap
      const tweetsWithSentiment = await Promise.all(
        data.tweets.map(async (tweet: Tweet) => {
          try {
            const sentimentResponse = await fetch('/api/sentiment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text: tweet.text }),
            });

            if (sentimentResponse.ok) {
              const sentiment = await sentimentResponse.json();
              return { ...tweet, sentiment };
            }
            return tweet;
          } catch (error) {
            console.error('Error analyzing tweet:', error);
            return tweet;
          }
        })
      );

      setTweets(tweetsWithSentiment);
      
      // Kullanıcı bilgilerini güncelle
      const usersObj = data.users.reduce((acc: { [key: string]: User }, user: User) => {
        acc[user.id] = user;
        return acc;
      }, {});
      setUsers(prev => ({ ...prev, ...usersObj }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const filteredTweets = tweets.filter(tweet => {
    const matchesCategory = filter === 'all' || (tweet.sentiment?.category === filter);
    const matchesType = typeFilter === 'all' || (tweet.sentiment?.type === typeFilter);
    return matchesCategory && matchesType;
  });

  const getSentimentColor = (category?: string) => {
    switch (category) {
      case 'pozitif':
        return 'text-green-600';
      case 'negatif':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTypeEmoji = (type: string) => {
    switch (type) {
      case 'komik':
        return '😂';
      case 'bilgilendirici':
        return '💡';
      case 'motivasyonel':
        return '💪';
      case 'sanatsal':
        return '🎨';
      default:
        return '📝';
    }
  };

  if (!session) {
    return (
      <div className="p-4">
        <p>Please sign in to view your archive.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-4">Loading your archive...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-500">{error}</p>
        {retryAfter && (
          <p>Please wait {retryAfter} seconds before trying again.</p>
        )}
        <Button onClick={fetchTweets} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Your Positive Interactions</h1>

      <div className="mb-4 flex gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="all">Tüm Duygular</option>
          <option value="pozitif">Pozitif</option>
          <option value="negatif">Negatif</option>
          <option value="nötr">Nötr</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="all">Tüm Tipler</option>
          <option value="komik">Komik</option>
          <option value="bilgilendirici">Bilgilendirici</option>
          <option value="motivasyonel">Motivasyonel</option>
          <option value="sanatsal">Sanatsal</option>
          <option value="genel">Genel</option>
        </select>
      </div>

      <div className="space-y-4">
        {filteredTweets.map((tweet) => {
          const user = users[tweet.author_id];
          return (
            <div key={tweet.id} className="bg-white rounded-lg shadow-md p-6">
              {user && (
                <div className="flex items-center mb-4">
                  <div className="relative w-12 h-12 mr-4">
                    <Image
                      src={user.profile_image_url}
                      alt={user.name}
                      fill
                      className="rounded-full object-cover"
                      sizes="48px"
                    />
                  </div>
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-gray-500">@{user.username}</p>
                  </div>
                </div>
              )}
              
              <p className="text-gray-800 mb-4">{tweet.text}</p>
              
              {tweet.sentiment && (
                <div className="text-sm space-y-2">
                  <p className={getSentimentColor(tweet.sentiment.category)}>
                    Duygu: {tweet.sentiment.category} (Skor: {tweet.sentiment.score.toFixed(2)})
                  </p>
                  <p>
                    Tip: {getTypeEmoji(tweet.sentiment.type)} {tweet.sentiment.type}
                  </p>
                  <div className="text-gray-500 text-xs space-y-1">
                    <p>BERT Skoru: {tweet.sentiment.stats.bertScore.toFixed(2)} ({tweet.sentiment.stats.bertLabel})</p>
                    <p>Emoji Skoru: {tweet.sentiment.stats.emojiScore.toFixed(2)} (Emoji Sayısı: {tweet.sentiment.stats.emojis})</p>
                  </div>
                </div>
              )}

              <div className="flex justify-between text-sm text-gray-500 mt-4">
                <span>{new Date(tweet.created_at).toLocaleDateString()}</span>
                <div className="flex space-x-4">
                  <span>💬 {tweet.public_metrics.reply_count}</span>
                  <span>🔄 {tweet.public_metrics.retweet_count}</span>
                  <span>❤️ {tweet.public_metrics.like_count}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 