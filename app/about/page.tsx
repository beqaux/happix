import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-3xl py-12">
      <Button variant="ghost" asChild className="mb-8">
        <Link href="/" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Home
        </Link>
      </Button>

      <div className="space-y-8">
        <div>
          <h1 className="mb-4 text-3xl font-bold">About Positive Interaction Archive</h1>
          <p className="text-lg text-muted-foreground">
            Social media is an important part of our lives today. However, due to the constant flow of content,
            the posts that make us happy, inspire us, and we find valuable are quickly lost.
            This is exactly where the Positive Interaction Archive comes in.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Why Did We Develop This Project?</h2>
          <p className="text-muted-foreground">
            Millions of posts are made every day on platforms like X (Twitter). In this intense
            flow, it becomes difficult to access the content we like and value later.
            Positive Interaction Archive was designed as a solution to this problem.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">How Does It Work?</h2>
          <div className="space-y-2">
            <h3 className="font-medium">1. Secure Login with X</h3>
            <p className="text-muted-foreground">
              Sign in securely with your X account. Your data always remains under your
              control and is only accessed to the extent you permit.
            </p>

            <h3 className="font-medium">2. Automatic Archiving</h3>
            <p className="text-muted-foreground">
              Posts you like are automatically added to your archive. No extra action
              is required on your part.
            </p>

            <h3 className="font-medium">3. Easy Access</h3>
            <p className="text-muted-foreground">
              Access your archive anytime, from anywhere. You can categorize,
              search, and filter your posts.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Privacy and Security</h2>
          <p className="text-muted-foreground">
            Your privacy is important to us. Your data is stored securely and
            is only used to the extent you permit. We request minimal permissions
            for your X account and use these permissions only for necessary operations.
          </p>
        </div>

        <div className="flex justify-center pt-8">
          <Button asChild size="lg">
            <Link href="/login">
              Get Started
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
} 