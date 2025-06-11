import { Tweet } from "@/lib/twitter";
import { Card } from "./ui/card";
import Image from "next/image";
import Link from "next/link";

export function TweetCard({ tweet }: { tweet: Tweet }) {
  const formattedDate = new Date(tweet.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3 p-4">
        <Image
          src={tweet.author.profile_image_url}
          alt={tweet.author.name}
          width={48}
          height={48}
          className="rounded-full"
        />
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href={`https://twitter.com/${tweet.author.username}`}
                target="_blank"
                className="font-medium hover:underline"
              >
                {tweet.author.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                @{tweet.author.username} · {formattedDate}
              </p>
            </div>
          </div>
          <p className="text-sm">{tweet.text}</p>
        </div>
      </div>
    </Card>
  );
} 