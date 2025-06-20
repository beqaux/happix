'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { format } from 'date-fns';
import { Loader2, RefreshCcw } from 'lucide-react';
import Link from 'next/link';

interface Tweet {
  id: string;
  author_id: string;
  text: string;
  created_at: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  sentiment: {
    label: 'positive' | 'negative' | 'neutral';
    score: number;
    confidence: number;
  };
  isPositive: boolean;
}

interface User {
  id: string;
  name: string;
  username: string;
  profile_image_url: string;
}

interface Stats {
  total: number;
  positive: number;
  filtered: number;
}

export default function TimelinePage() {
  const { data: session, status } = useSession();
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [threshold, setThreshold] = useState(70);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTimeline = async (cursor?: string, shouldRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (cursor) {
        params.append('cursor', cursor);
      }
      params.append('threshold', (threshold / 100).toString());

      const response = await fetch(`/api/timeline?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch timeline');
      }

      if (shouldRefresh) {
        setTweets(data.tweets);
      } else {
        setTweets(prev => cursor ? [...prev, ...data.tweets] : data.tweets);
      }
      
      setUsers(data.users);
      setNextToken(data.next_token);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      if (err instanceof Error && err.message.includes('session has expired')) {
        // Oturumu yenile
        window.location.href = '/api/auth/signin';
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchTimeline();
    }
  }, [session, threshold]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTimeline(undefined, true);
  };

  const getSentimentColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800';
    if (score >= 0.6) return 'bg-emerald-100 text-emerald-800';
    return 'bg-blue-100 text-blue-800';
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg text-gray-600">Please sign in to view your timeline.</p>
        <Button asChild>
          <Link href="/api/auth/signin">Sign In</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Positive Timeline</h1>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
        
        <div className="mt-4 max-w-xl">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Pozitiflik Eşiği: %{threshold}
          </label>
          <Slider
            value={[threshold]}
            onValueChange={(value) => setThreshold(value[0])}
            max={100}
            step={5}
            className="py-4"
          />
          <p className="mt-1 text-sm text-gray-500">
            Sadece %{threshold} ve üzeri pozitiflik skoruna sahip tweet'ler gösterilir.
          </p>
        </div>

        {stats && (
          <div className="mt-4 text-sm text-gray-600">
            {stats.total} tweet içinden {stats.positive} pozitif tweet gösteriliyor.
            ({stats.filtered} tweet filtrelendi)
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
          {error}
          {error.includes('session has expired') && (
            <Button
              onClick={() => window.location.href = '/api/auth/signin'}
              variant="link"
              className="ml-2 text-red-700 underline"
            >
              Yeniden Giriş Yap
            </Button>
          )}
        </div>
      )}

      {tweets.length === 0 && !loading && !error && (
        <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800">
          Henüz gösterilecek tweet yok. Eşik değerini düşürmeyi veya yenilemeyi deneyin.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tweets.map((tweet) => {
          const user = users.find(u => u.id === tweet.author_id);
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
                <span className={`rounded-full px-3 py-1 text-sm ${getSentimentColor(tweet.sentiment.score)}`}>
                  😊 {Math.round(tweet.sentiment.score * 100)}% Positive
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
            onClick={() => fetchTimeline(nextToken)}
            disabled={loading}
            variant="outline"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  );
} 