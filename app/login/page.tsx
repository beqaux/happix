'use client';

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Sign in with X
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your X account to access your archive
          </p>
        </div>

        <Button 
          className="w-full" 
          size="lg"
          onClick={() => signIn("twitter", { callbackUrl: "/archive" })}
        >
          Continue with X
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              or
            </span>
          </div>
        </div>

        <Button variant="outline" asChild className="w-full" size="lg">
          <Link href="/" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Return to home
          </Link>
        </Button>
      </div>
    </div>
  );
} 