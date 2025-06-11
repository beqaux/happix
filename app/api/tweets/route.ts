import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Retry configuration
const MAX_RETRY_COUNT = 2;
const BASE_DELAY = 2000; // 2 seconds

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Parse rate limit reset time
function parseRateLimitReset(resetHeader: string | null): Date | null {
  if (!resetHeader) return null;
  const timestamp = parseInt(resetHeader);
  if (isNaN(timestamp)) return null;
  
  const resetDate = new Date(timestamp * 1000);
  // If the reset date is more than 24 hours in the future, something's wrong
  if (resetDate.getTime() - Date.now() > 24 * 60 * 60 * 1000) {
    return null;
  }
  return resetDate;
}

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
    while (retryCount <= MAX_RETRY_COUNT) {
      try {
        const response = await fetch(`${endpoint}?${queryParams}`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        });

        // Check rate limit headers
        const rateLimitRemaining = response.headers.get('x-rate-limit-remaining');
        const rateLimitReset = parseRateLimitReset(
          response.headers.get('x-rate-limit-reset')
        );

        console.log('Rate Limit Info:', {
          remaining: rateLimitRemaining,
          resetAt: rateLimitReset?.toISOString() || 'Unknown'
        });

        if (response.status === 429) {
          const waitTime = rateLimitReset 
            ? Math.max(0, rateLimitReset.getTime() - Date.now())
            : BASE_DELAY * Math.pow(2, retryCount); // Exponential backoff
          
          if (waitTime > 30000) { // If wait time is more than 30 seconds
            return NextResponse.json({
              error: "Rate limit exceeded",
              retryAfter: rateLimitReset?.toISOString() || 'a few minutes',
              message: "We've hit X's rate limit. Please try again later."
            }, { 
              status: 429,
              headers: rateLimitReset ? {
                'Retry-After': Math.ceil(waitTime / 1000).toString()
              } : {}
            });
          }
          
          console.log(`Rate limited. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
          
          if (retryCount < MAX_RETRY_COUNT) {
            await sleep(waitTime);
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

          if (retryCount < MAX_RETRY_COUNT) {
            await sleep(BASE_DELAY * Math.pow(2, retryCount));
            retryCount++;
            continue;
          }

          // If we're out of retries, return a user-friendly error
          return NextResponse.json({
            error: "Failed to fetch tweets",
            message: "There was a problem connecting to X. Please try again later.",
            details: errorData?.detail || response.statusText
          }, { 
            status: response.status 
          });
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
        if (retryCount < MAX_RETRY_COUNT) {
          await sleep(BASE_DELAY * Math.pow(2, retryCount));
          retryCount++;
          continue;
        }
        
        // If all retries failed, return a user-friendly error
        return NextResponse.json({
          error: "Service unavailable",
          message: "We're having trouble connecting to X. Please try again later.",
          details: error instanceof Error ? error.message : "Unknown error"
        }, { 
          status: 503 
        });
      }
    }

    // If we get here, all retries failed
    return NextResponse.json({
      error: "Service unavailable",
      message: "We're having trouble connecting to X. Please try again later.",
      details: lastError instanceof Error ? lastError.message : "Unknown error"
    }, { 
      status: 503 
    });
    
  } catch (error) {
    console.error("Error fetching tweets:", error);
    return NextResponse.json({
      error: "Internal server error",
      message: "Something went wrong on our end. Please try again later.",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { 
      status: 500 
    });
  }
} 