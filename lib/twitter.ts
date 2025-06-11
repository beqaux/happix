export interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  entities?: {
    urls?: Array<{
      url: string;
      expanded_url: string;
      display_url: string;
      media_key?: string;
    }>;
    mentions?: Array<{
      username: string;
      id: string;
    }>;
    hashtags?: Array<{
      tag: string;
    }>;
  };
}

export interface TwitterUser {
  id: string;
  name: string;
  username: string;
  profile_image_url: string;
}

export interface TwitterResponse {
  tweets: Tweet[];
  users: TwitterUser[];
  nextCursor?: string;
}

export async function getLikedTweets(
  _: { accessToken: string; userId: string },
  cursor?: string
): Promise<TwitterResponse> {
  const params = new URLSearchParams();
  if (cursor) {
    params.append('cursor', cursor);
  }

  const response = await fetch(`/api/tweets?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch tweets');
  }

  const data = await response.json();
  return {
    tweets: data.tweets,
    users: data.users,
    nextCursor: data.next_token,
  };
} 