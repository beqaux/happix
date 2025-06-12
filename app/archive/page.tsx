"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Tweet } from '../../types/tweet';
import { User } from '../../types/user';
import { TweetCategories } from '@/lib/sentiment';
import { RefreshCw } from 'lucide-react';

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
  const fetchTweets = async (forceRefresh = false) => {
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const url = new URL('/api/tweets', window.location.origin);
      if (forceRefresh) {
        url.searchParams.set('refresh', 'true');
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

      setTweets(data.tweets);
      setUsers(data.users);
      saveToStorage(data.tweets, data.users);
      setLastRefreshTime(new Date());
      setCacheInfo({
        fromCache: data._meta.fromCache,
        cacheAge: data._meta.cacheAge,
        message: data._meta.message
      });

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
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tweet Arşivim</h1>
        
        {/* Refresh Butonu */}
        <div className="flex flex-col items-end">
          <Button
            onClick={() => fetchTweets(true)}
            disabled={loading || getRefreshTimeLeft() > 0}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Yükleniyor...' : 'Yenile'}
          </Button>
          {getRefreshTimeLeft() > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              {formatTimeLeft(getRefreshTimeLeft())} sonra tekrar deneyebilirsiniz
            </p>
          )}
        </div>
      </div>

      {/* Cache Durumu */}
      {cacheInfo && (
        <div className={`rounded-lg p-4 mb-4 ${cacheInfo.fromCache ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
          <p>
            {cacheInfo.fromCache ? (
              <>
                <span className="font-medium">Cache'lenmiş veriler gösteriliyor. </span>
                {cacheInfo.cacheAge && `(${formatCacheAge(cacheInfo.cacheAge)} önce cache'lendi)`}
              </>
            ) : (
              <span className="font-medium">Yeni veriler başarıyla çekildi.</span>
            )}
          </p>
          {cacheInfo.message && <p className="mt-1 text-sm">{cacheInfo.message}</p>}
        </div>
      )}

      {/* Son Yenileme Zamanı */}
      {lastRefreshTime && (
        <p className="text-sm text-gray-500 mb-4">
          Son yenileme: {lastRefreshTime.toLocaleTimeString()}
        </p>
      )}

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