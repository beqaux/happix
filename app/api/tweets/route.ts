import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyzeSentiment } from '@/lib/sentiment';
import { createTweetsTable, cacheTweets, getCachedTweets, getCacheAge } from '@/lib/db';

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

// Rate limit kontrolü için
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 dakika
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 saat

// Twitter API'den gelen reset timestamp'i saniyeye çevirme
function calculateRetryAfterSeconds(resetTimestamp: string | number): number {
  if (typeof resetTimestamp === 'string') {
    const resetDate = new Date(resetTimestamp).getTime();
    const now = Date.now();
    return Math.max(0, Math.ceil((resetDate - now) / 1000));
  }
  return Math.max(0, Math.ceil(Number(resetTimestamp) - Date.now() / 1000));
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

    // Veritabanı tablolarını oluştur
    await createTweetsTable();

    // Önce cache'i kontrol et
    const lastCacheTime = await getCacheAge();
    const forceRefresh = new URL(request.url).searchParams.get('refresh') === 'true';
    
    if (lastCacheTime && !forceRefresh) {
      const cacheAge = Date.now() - new Date(lastCacheTime).getTime();
      
      // Cache yeterince yeniyse, cache'den döndür
      if (cacheAge < CACHE_TTL) {
        const cachedTweets = await getCachedTweets(session.user.id);
        return NextResponse.json({
          tweets: cachedTweets,
          _meta: {
            fromCache: true,
            cacheAge: Math.floor(cacheAge / 1000),
            nextRefreshAvailable: new Date(lastCacheTime.getTime() + RATE_LIMIT_WINDOW).toLocaleString()
          }
        });
      }
    }

    // Get cursor from query params
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");

    // Rate limit kontrolü
    const now = Date.now();
    if (now - now < RATE_LIMIT_WINDOW) {
      const retryAfterSeconds = Math.ceil((RATE_LIMIT_WINDOW - (now - now)) / 1000);
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: retryAfterSeconds,
          message: `Lütfen ${retryAfterSeconds} saniye sonra tekrar deneyin.`
        },
        { status: 429 }
      );
    }

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
          const resetTimestamp = response.headers.get('x-rate-limit-reset');
          const retryAfterSeconds = resetTimestamp ? 
            calculateRetryAfterSeconds(resetTimestamp) : 
            60; // Varsayılan olarak 60 saniye

          // Rate limit aşıldıysa ve cache varsa, cache'den döndür
          if (lastCacheTime) {
            const cachedTweets = await getCachedTweets(session.user.id);
            if (cachedTweets.length > 0) {
              return NextResponse.json({
                tweets: cachedTweets,
                _meta: {
                  fromCache: true,
                  rateLimited: true,
                  retryAfter: retryAfterSeconds,
                  message: `Rate limit aşıldı. Cache'lenmiş tweet'ler gösteriliyor. ${retryAfterSeconds} saniye sonra yeni tweet'leri çekebilirsiniz.`
                }
              });
            }
          }

          return NextResponse.json(
            { 
              error: 'Twitter API rate limit exceeded',
              retryAfter: retryAfterSeconds,
              message: `Twitter API rate limit aşıldı. Lütfen ${retryAfterSeconds} saniye sonra tekrar deneyin.`
            },
            { status: 429 }
          );
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

        // Tweet'lere duygu analizi ekle
        const tweetsWithSentiment = await Promise.all(
          data.data.map(async (tweet: any) => {
            const sentiment = await analyzeSentiment(tweet.text);
            return { ...tweet, sentiment };
          })
        );

        // Kullanıcı bilgilerini düzenle
        const users = data.includes.users.reduce((acc: any, user: any) => {
          acc[user.id] = user;
          return acc;
        }, {});

        // Tweet'leri ve kullanıcıları cache'le
        await cacheTweets(tweetsWithSentiment, data.includes.users);

        // Return tweets and pagination info
        return NextResponse.json({
          tweets: tweetsWithSentiment,
          users,
          next_token: data.meta?.next_token,
          _meta: {
            lastRequestTime: now,
            nextAllowedTime: now + RATE_LIMIT_WINDOW,
            nextAllowedTimeFormatted: new Date(now + RATE_LIMIT_WINDOW).toLocaleString(),
            fromCache: false,
            refreshedAt: new Date().toISOString(),
            nextRefreshAvailable: new Date(Date.now() + RATE_LIMIT_WINDOW).toLocaleString()
          }
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