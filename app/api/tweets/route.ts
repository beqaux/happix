import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Retry configuration
const RETRY_COUNT = 3;
const RETRY_DELAY = 1000; // 1 second

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request: NextRequest) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);

    console.log('API Route - Session:', {
      userId: session?.user?.id,
      hasAccessToken: !!session?.accessToken
    });

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get cursor from query params
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");

    // X API endpoint for liked tweets
    const endpoint = `https://api.twitter.com/2/users/${session.user.id}/liked_tweets`;
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      "tweet.fields": "created_at,author_id,public_metrics,entities",
      "user.fields": "name,username,profile_image_url",
      "expansions": "author_id",
      "max_results": "10",
      ...(cursor && { pagination_token: cursor }),
    });

    console.log('X API Request:', {
      endpoint,
      queryParams: queryParams.toString(),
      hasAccessToken: !!session.accessToken
    });

    let lastError = null;
    let retryCount = 0;

    // Retry loop
    while (retryCount < RETRY_COUNT) {
      try {
        const response = await fetch(`${endpoint}?${queryParams}`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        });

        // Check rate limit headers
        const rateLimitRemaining = response.headers.get('x-rate-limit-remaining');
        const rateLimitReset = response.headers.get('x-rate-limit-reset');

        console.log('Rate Limit Info:', {
          remaining: rateLimitRemaining,
          resetAt: rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toISOString() : null
        });

        if (response.status === 429) {
          const resetTime = parseInt(rateLimitReset || '0') * 1000;
          const waitTime = Math.max(0, resetTime - Date.now());
          
          console.log(`Rate limited. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
          
          if (retryCount < RETRY_COUNT - 1) {
            await sleep(Math.min(waitTime, RETRY_DELAY));
            retryCount++;
            continue;
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          console.error('X API Error:', {
            status: response.status,
            statusText: response.statusText,
            errorData,
            attempt: retryCount + 1
          });

          if (retryCount < RETRY_COUNT - 1) {
            await sleep(RETRY_DELAY);
            retryCount++;
            continue;
          }

          // If we're out of retries, throw the last error
          throw new Error(
            `X API error (${response.status}): ${
              errorData?.detail || response.statusText
            }`
          );
        }

        const data = await response.json();
        console.log('X API Response:', {
          tweetCount: data.data?.length || 0,
          userCount: data.includes?.users?.length || 0,
          hasNextToken: !!data.meta?.next_token
        });

        // Return tweets and pagination info
        return NextResponse.json({
          tweets: data.data || [],
          users: data.includes?.users || [],
          next_token: data.meta?.next_token,
        });

      } catch (error) {
        lastError = error;
        if (retryCount < RETRY_COUNT - 1) {
          await sleep(RETRY_DELAY);
          retryCount++;
          continue;
        }
        throw error;
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Failed to fetch tweets after all retries');
    
  } catch (error) {
    console.error("Error fetching tweets:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to fetch tweets",
        retryAfter: "Please wait a few minutes and try again"
      },
      { status: 500 }
    );
  }
} 