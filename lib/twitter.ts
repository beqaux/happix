export interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author: {
    id: string;
    name: string;
    username: string;
    profile_image_url: string;
  };
}

interface TwitterAPIResponse {
  data: {
    id: string;
    text: string;
    created_at: string;
    author_id: string;
  }[];
  includes: {
    users: {
      id: string;
      name: string;
      username: string;
      profile_image_url: string;
    }[];
  };
  meta: {
    result_count: number;
    next_token?: string;
  };
}

export async function getLikedTweets(
  auth: { accessToken: string; userId: string },
  cursor?: string
): Promise<{ tweets: Tweet[]; nextCursor?: string }> {
  const params = new URLSearchParams({
    "tweet.fields": "created_at",
    "user.fields": "profile_image_url",
    "expansions": "author_id",
    "max_results": "10",
  });

  if (cursor) {
    params.append("pagination_token", cursor);
  }

  const response = await fetch(
    `https://api.twitter.com/2/users/${auth.userId}/liked_tweets?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch tweets: ${response.statusText}`);
  }

  const data: TwitterAPIResponse = await response.json();

  const tweets: Tweet[] = data.data.map((tweet) => {
    const author = data.includes.users.find((user) => user.id === tweet.author_id);
    if (!author) throw new Error(`Could not find author for tweet ${tweet.id}`);

    return {
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      author: {
        id: author.id,
        name: author.name,
        username: author.username,
        profile_image_url: author.profile_image_url,
      },
    };
  });

  return {
    tweets,
    nextCursor: data.meta.next_token,
  };
} 