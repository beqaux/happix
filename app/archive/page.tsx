import { Button } from "@/components/ui/button";
import { Inbox } from "lucide-react";
import Link from "next/link";

export default function ArchivePage() {
  const isLoading = false;
  const tweets = [];

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
        <Button variant="outline">Yenile</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Tweet kartları burada listelenecek */}
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Tweet içeriği burada görünecek...</p>
        </div>
      </div>
    </div>
  );
} 