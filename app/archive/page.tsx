'use client';

import { Button } from "@/components/ui/button";
import { TweetCard } from "@/components/tweet-card";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Tweet, getLikedTweets } from "@/lib/twitter";
import { useSession } from "next-auth/react";

export default function ArchivePage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();

  const fetchTweets = useCallback(async (cursor?: string) => {
    try {
      setIsLoading(true);
      const data = await getLikedTweets({
        accessToken: session!.accessToken!,
        userId: session!.user!.id,
      }, cursor);

      if (cursor) {
        setTweets(prev => [...prev, ...data.tweets]);
      } else {
        setTweets(data.tweets);
      }
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error('Error loading tweets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session?.accessToken) {
      fetchTweets();
    }
  }, [session, fetchTweets]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="h-32 w-32 animate-spin rounded-full border-4 border-muted border-t-foreground" />
      </div>
    );
  }

  if (tweets.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <div className="flex max-w-md flex-col items-center gap-4">
          <div className="rounded-full bg-muted p-4">
            <Inbox className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold">Arşiviniz Boş</h2>
          <p className="text-sm text-muted-foreground">
            X&apos;te beğendiğiniz gönderiler burada görünecek. Hemen birkaç gönderi beğenerek başlayın!
          </p>
          <Button asChild>
            <Link href="https://twitter.com" target="_blank" rel="noopener noreferrer">
              X&apos;e Git
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Arşiviniz</h1>
        <Button 
          variant="outline" 
          onClick={() => fetchTweets()}
          disabled={isLoading}
        >
          Yenile
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tweets.map((tweet) => (
          <TweetCard key={tweet.id} tweet={tweet} />
        ))}
      </div>

      {nextCursor && (
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchTweets(nextCursor)}
            disabled={isLoading}
          >
            Daha Fazla Yükle
          </Button>
        </div>
      )}
    </div>
  );
} 