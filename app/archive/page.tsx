"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Tweet } from '../../types/tweet';
import { User } from '../../types/user';
import { TweetCategories } from '@/lib/sentiment';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

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
  const [retryAfter, setRetryAfter] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{
    fromCache: boolean;
    cacheAge?: number;
    message?: string;
  } | null>(null);
  const [nextToken, setNextToken] = useState<string | null>(null);

  // Local Storage Keys
  const STORAGE_KEYS = {
    TWEETS: 'happix_tweets',
    USERS: 'happix_users',
    LAST_REFRESH: 'happix_last_refresh'
  };

  // Veriyi Local Storage'dan yükleme
  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const storedTweets = localStorage.getItem(STORAGE_KEYS.TWEETS);
        const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
        const storedLastRefresh = localStorage.getItem(STORAGE_KEYS.LAST_REFRESH);

        if (storedTweets && storedUsers) {
          setTweets(JSON.parse(storedTweets));
          setUsers(JSON.parse(storedUsers));
          setLastRefreshTime(storedLastRefresh ? new Date(storedLastRefresh) : null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading from storage:', error);
      }
    };

    loadFromStorage();
  }, []);

  // Veriyi Local Storage'a kaydetme
  const saveToStorage = (newTweets: TweetWithSentiment[], newUsers: { [key: string]: User }) => {
    try {
      localStorage.setItem(STORAGE_KEYS.TWEETS, JSON.stringify(newTweets));
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(newUsers));
      localStorage.setItem(STORAGE_KEYS.LAST_REFRESH, new Date().toISOString());
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  };

  // Tweet'leri çekme fonksiyonu
  const fetchTweets = async (forceRefresh = false, cursor?: string) => {
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const url = new URL('/api/tweets', window.location.origin);
      if (forceRefresh) {
        url.searchParams.set('refresh', 'true');
      }

      if (cursor) {
        url.searchParams.append('cursor', cursor);
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setRetryAfter(data.retryAfter || 60);
          setError(data.message || 'Rate limit aşıldı. Lütfen daha sonra tekrar deneyin.');
        } else {
          setError(data.error || 'Tweet\'ler alınırken bir hata oluştu');
        }
        setLoading(false);
        return;
      }

      setTweets(prev => cursor ? [...prev, ...data.tweets] : data.tweets);
      setUsers(data.users);
      saveToStorage(data.tweets, data.users);
      setLastRefreshTime(new Date());
      setCacheInfo({
        fromCache: data._meta.fromCache,
        cacheAge: data._meta.cacheAge,
        message: data._meta.message
      });
      setNextToken(data.next_token);

      if (data._meta.retryAfter) {
        setRetryAfter(data._meta.retryAfter);
      }
    } catch (error) {
      setError('Tweet\'ler alınırken bir hata oluştu');
      console.error('Error fetching tweets:', error);
    } finally {
      setLoading(false);
    }
  };

  // İlk yükleme
  useEffect(() => {
    if (session && tweets.length === 0) {
      fetchTweets();
    }
  }, [session]);

  // Refresh butonu için kalan süre hesaplama
  const getRefreshTimeLeft = () => {
    if (!retryAfter || !lastRefreshTime) return 0;
    const now = new Date();
    const timeSinceLastRefresh = (now.getTime() - lastRefreshTime.getTime()) / 1000;
    return Math.max(0, Math.ceil(retryAfter - timeSinceLastRefresh));
  };

  // Kalan süreyi formatla
  const formatTimeLeft = (seconds: number) => {
    if (seconds <= 0) return '0 saniye';
    if (seconds < 60) return `${seconds} saniye`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} dakika ${remainingSeconds} saniye`;
  };

  // Cache yaşını formatla
  const formatCacheAge = (seconds: number) => {
    if (seconds < 60) return `${seconds} saniye`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} dakika`;
    return `${Math.floor(seconds / 3600)} saat ${Math.floor((seconds % 3600) / 60)} dakika`;
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

  const getSentimentColor = (sentiment: SentimentAnalysis) => {
    switch (sentiment.category) {
      case 'positive':
        return 'bg-green-100 text-green-800';
      case 'negative':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSentimentEmoji = (sentiment: SentimentAnalysis) => {
    switch (sentiment.category) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😔';
      default:
        return '😐';
    }
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-600">Please sign in to view your archive.</p>
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
        {retryAfter > 0 && (
          <p>Please wait {retryAfter} seconds before trying again.</p>
        )}
        <Button onClick={() => fetchTweets(true)} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Your Positive Interactions</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredTweets.map((tweet) => {
          const user = users[tweet.author_id];
          if (!user) return null;

          return (
            <div key={tweet.id} className="rounded-lg border p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <img
                  src={user.profile_image_url}
                  alt={user.name}
                  className="h-10 w-10 rounded-full"
                />
                <div>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-gray-500">@{user.username}</div>
                </div>
              </div>

              <p className="mb-3 text-gray-800">{tweet.text}</p>

              <div className="mb-3 flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-sm ${getSentimentColor(tweet.sentiment as SentimentAnalysis)}`}>
                  {getSentimentEmoji(tweet.sentiment as SentimentAnalysis)} {tweet.sentiment?.category}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex gap-4">
                  <span>🔄 {tweet.public_metrics.retweet_count}</span>
                  <span>💬 {tweet.public_metrics.reply_count}</span>
                  <span>❤️ {tweet.public_metrics.like_count}</span>
                </div>
                <time>{format(new Date(tweet.created_at), 'MMM d, yyyy')}</time>
              </div>
            </div>
          );
        })}
      </div>

      {nextToken && (
        <div className="mt-8 flex justify-center">
          <Button
            onClick={() => fetchTweets(false, nextToken)}
            disabled={loading}
            variant="outline"
            size="lg"
          >
            {loading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
} 