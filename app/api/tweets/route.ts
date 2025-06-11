import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
      bearerToken: process.env.TWITTER_BEARER_TOKEN?.slice(0, 10) + '...'
    });

    // Make request to X API
    const response = await fetch(`${endpoint}?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('X API Error:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      throw new Error(`X API error: ${response.statusText}`);
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
    console.error("Error fetching tweets:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch tweets" },
      { status: 500 }
    );
  }
} 