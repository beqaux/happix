import { Tweet, TwitterUser } from "@/lib/twitter";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Heart, MessageCircle, Repeat2, Share } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface TweetCardProps {
  tweet: Tweet;
  author: TwitterUser;
}

export function TweetCard({ tweet, author }: TweetCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <Image
          src={author.profile_image_url}
          alt={author.name}
          width={40}
          height={40}
          className="rounded-full"
        />
        <div className="flex flex-col">
          <span className="font-semibold">{author.name}</span>
          <span className="text-sm text-muted-foreground">@{author.username}</span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap">{tweet.text}</p>
        {tweet.entities?.urls?.map((url) => (
          <Link
            key={url.url}
            href={url.expanded_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-sm text-blue-500 hover:underline"
          >
            {url.display_url}
          </Link>
        ))}
      </CardContent>
      <CardFooter className="flex justify-between border-t p-4 text-muted-foreground">
        <div className="flex items-center gap-1">
          <MessageCircle className="h-4 w-4" />
          <span className="text-xs">{tweet.public_metrics.reply_count}</span>
        </div>
        <div className="flex items-center gap-1">
          <Repeat2 className="h-4 w-4" />
          <span className="text-xs">{tweet.public_metrics.retweet_count}</span>
        </div>
        <div className="flex items-center gap-1">
          <Heart className="h-4 w-4" />
          <span className="text-xs">{tweet.public_metrics.like_count}</span>
        </div>
        <div className="flex items-center gap-1">
          <Share className="h-4 w-4" />
          <span className="text-xs">{formatDistanceToNow(new Date(tweet.created_at))}</span>
        </div>
      </CardFooter>
    </Card>
  );
} 