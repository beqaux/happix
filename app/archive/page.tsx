'use client';

import { Button } from "@/components/ui/button";
import { TweetCard } from "@/components/tweet-card";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Tweet, TwitterUser, getLikedTweets } from "@/lib/twitter";
import { useSession } from "next-auth/react";

export default function ArchivePage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [users, setUsers] = useState<TwitterUser[]>([]);
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
        setUsers(prev => [...prev, ...data.users]);
      } else {
        setTweets(data.tweets);
        setUsers(data.users);
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

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <div className="flex max-w-md flex-col items-center gap-4">
          <h2 className="text-lg font-semibold">Please Sign In</h2>
          <p className="text-sm text-muted-foreground">
            You need to sign in with your X account to view your archive.
          </p>
          <Button asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading && tweets.length === 0) {
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
          <h2 className="text-lg font-semibold">Your Archive is Empty</h2>
          <p className="text-sm text-muted-foreground">
            Posts you like on X will appear here. Start by liking a few posts!
          </p>
          <Button asChild>
            <Link href="https://twitter.com" target="_blank" rel="noopener noreferrer">
              Go to X
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Archive</h1>
        <Button 
          variant="outline" 
          onClick={() => fetchTweets()}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tweets.map((tweet) => {
          const author = users.find(user => user.id === tweet.author_id);
          if (!author) return null;
          return <TweetCard key={tweet.id} tweet={tweet} author={author} />;
        })}
      </div>

      {nextCursor && (
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchTweets(nextCursor)}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
} 