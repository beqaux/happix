"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Tweet } from '../../types/tweet';
import { User } from '../../types/user';
import { TweetCategories } from '@/lib/sentiment';

interface SentimentAnalysis {
  score: number;
  category: string;
  type: string;
  stats: {
    bertScore: number;
    bertLabel: string;
    categoryScores: {
      motivational: number;
      funny: number;
      informative: number;
      artistic: number;
    };
    topCategory: string;
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

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
    const matchesCategory = selectedCategory === 'all' || 
      (tweet.sentiment && tweet.sentiment.category === selectedCategory);
    const matchesType = selectedType === 'all' || 
      (tweet.sentiment && tweet.sentiment.type === selectedType);
    return matchesCategory && matchesType;
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case TweetCategories.POSITIVE:
        return 'text-green-600';
      case TweetCategories.NEUTRAL:
        return 'text-gray-600';
      default:
        return 'text-blue-600';
    }
  };

  const getTypeEmoji = (type: string) => {
    switch (type) {
      case TweetCategories.MOTIVATIONAL:
        return '💪';
      case TweetCategories.FUNNY:
        return '😂';
      case TweetCategories.INFORMATIVE:
        return '💡';
      case TweetCategories.ARTISTIC:
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
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Tweet Arşivim</h1>
      
      <div className="flex gap-4 mb-6">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="all">Tüm Kategoriler</option>
          <option value={TweetCategories.POSITIVE}>Pozitif</option>
          <option value={TweetCategories.NEUTRAL}>Nötr</option>
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="all">Tüm Tipler</option>
          <option value={TweetCategories.MOTIVATIONAL}>Motivasyonel</option>
          <option value={TweetCategories.FUNNY}>Komik</option>
          <option value={TweetCategories.INFORMATIVE}>Bilgilendirici</option>
          <option value={TweetCategories.ARTISTIC}>Sanatsal</option>
        </select>
      </div>

      <div className="space-y-4">
        {filteredTweets.map((tweet) => {
          const user = users[tweet.author_id];
          return (
            <div key={tweet.id} className="bg-white p-4 rounded-lg shadow">
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
                <div className="text-sm space-y-2 border-t pt-2">
                  <div className="flex justify-between items-center">
                    <p className={getCategoryColor(tweet.sentiment.category)}>
                      Kategori: {tweet.sentiment.category}
                    </p>
                    <p>
                      {getTypeEmoji(tweet.sentiment.type)} {tweet.sentiment.type}
                    </p>
                  </div>
                  
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>BERT: {(tweet.sentiment.stats.bertScore * 100).toFixed(1)}% {tweet.sentiment.stats.bertLabel}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <p>Motivasyonel: {(tweet.sentiment.stats.categoryScores.motivational * 100).toFixed(1)}%</p>
                      <p>Komik: {(tweet.sentiment.stats.categoryScores.funny * 100).toFixed(1)}%</p>
                      <p>Bilgilendirici: {(tweet.sentiment.stats.categoryScores.informative * 100).toFixed(1)}%</p>
                      <p>Sanatsal: {(tweet.sentiment.stats.categoryScores.artistic * 100).toFixed(1)}%</p>
                    </div>
                    <p>Emoji Sayısı: {tweet.sentiment.stats.emojis}</p>
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