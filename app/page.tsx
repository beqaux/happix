import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Positive Interaction Archive
        </h1>
        
        <p className="max-w-prose text-lg text-muted-foreground sm:text-xl">
          Save your positive memories from X, organize them and rediscover them whenever you want.
          Filter out negative content and focus on what makes you happy.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/timeline">
              View Positive Timeline
            </Link>
          </Button>
          
          <Button asChild size="lg" variant="outline">
            <Link href="/archive">
              Browse Liked Tweets
            </Link>
          </Button>
          
          <Button variant="ghost" asChild size="lg">
            <Link href="/about">
              Learn More
            </Link>
          </Button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-12">
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-lg font-semibold">Secure Login</h3>
            <p className="text-sm text-muted-foreground">
              Sign in securely with your X account. Your data always stays under your control.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <h3 className="text-lg font-semibold">Automatic Archiving</h3>
            <p className="text-sm text-muted-foreground">
              Posts you like are automatically archived. No manual action required.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <h3 className="text-lg font-semibold">Easy Access</h3>
            <p className="text-sm text-muted-foreground">
              Access your archive anytime, anywhere and relive your positive memories.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
