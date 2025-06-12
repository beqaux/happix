import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Tweet tablosunu oluştur
export async function createTweetsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS tweets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL,
        sentiment JSONB,
        metrics JSONB,
        cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        name TEXT,
        profile_image_url TEXT,
        cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    console.log('Veritabanı tabloları oluşturuldu');
  } catch (error) {
    console.error('Veritabanı tabloları oluşturulurken hata:', error);
  }
}

// Tweet'leri cache'le
export async function cacheTweets(tweets: any[], users: any[]) {
  try {
    // Tweet'leri toplu olarak ekle
    for (const tweet of tweets) {
      await sql`
        INSERT INTO tweets (id, user_id, text, created_at, sentiment, metrics)
        VALUES (${tweet.id}, ${tweet.author_id}, ${tweet.text}, ${tweet.created_at}, ${JSON.stringify(tweet.sentiment)}, ${JSON.stringify(tweet.public_metrics)})
        ON CONFLICT (id) 
        DO UPDATE SET
          sentiment = ${JSON.stringify(tweet.sentiment)},
          metrics = ${JSON.stringify(tweet.public_metrics)},
          cached_at = CURRENT_TIMESTAMP;
      `;
    }

    // Kullanıcıları toplu olarak ekle
    for (const user of users) {
      await sql`
        INSERT INTO users (id, username, name, profile_image_url)
        VALUES (${user.id}, ${user.username}, ${user.name}, ${user.profile_image_url})
        ON CONFLICT (id) 
        DO UPDATE SET
          username = ${user.username},
          name = ${user.name},
          profile_image_url = ${user.profile_image_url},
          cached_at = CURRENT_TIMESTAMP;
      `;
    }

    console.log(`${tweets.length} tweet ve ${users.length} kullanıcı cache'lendi`);
  } catch (error) {
    console.error('Tweet\'ler cache\'lenirken hata:', error);
    throw error;
  }
}

// Cache'lenmiş tweet'leri getir
export async function getCachedTweets(userId: string) {
  try {
    const result = await sql`
      SELECT 
        t.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'name', u.name,
          'profile_image_url', u.profile_image_url
        ) as user
      FROM tweets t
      JOIN users u ON t.user_id = u.id
      WHERE t.cached_at > NOW() - INTERVAL '24 hours'
      ORDER BY t.created_at DESC;
    `;

    return result.map(row => ({
      ...row,
      user: JSON.parse(row.user)
    }));
  } catch (error) {
    console.error('Cache\'lenmiş tweet\'ler alınırken hata:', error);
    throw error;
  }
}

// Cache'in yaşını kontrol et
export async function getCacheAge() {
  try {
    const result = await sql`
      SELECT MAX(cached_at) as last_cache
      FROM tweets;
    `;
    
    return result[0]?.last_cache;
  } catch (error) {
    console.error('Cache yaşı kontrol edilirken hata:', error);
    return null;
  }
} 