import { pipeline, env } from '@xenova/transformers';

interface SentimentResult {
  label: string;
  score: number;
}

// Modeli yüklemek için yardımcı fonksiyon
let sentimentPipeline: any = null;

// Tweet kategorileri
export const TweetCategories = {
  MOTIVATIONAL: 'motivasyonel',
  FUNNY: 'komik',
  INFORMATIVE: 'bilgilendirici',
  ARTISTIC: 'sanatsal',
  POSITIVE: 'pozitif',
  NEUTRAL: 'nötr'
} as const;

// Pozitif kelime grupları
const positiveWordGroups = {
  motivational: [
    'başar', 'hedef', 'azim', 'inan', 'güç', 'motivasyon', 'ilham',
    'gelişim', 'potansiyel', 'hayaller', 'vizyon', 'kararlılık'
  ],
  funny: [
    'komik', 'espri', 'gül', 'eğlen', 'kahkaha', 'mizah', 'şaka',
    'caps', 'parodi', 'absürt', 'ironi'
  ],
  informative: [
    'bilgi', 'öğren', 'eğitim', 'araştır', 'keşfet', 'analiz',
    'kaynak', 'makale', 'çalışma', 'veri', 'sonuç'
  ],
  artistic: [
    'sanat', 'müzik', 'resim', 'tasarım', 'yaratıcı', 'estetik',
    'film', 'fotoğraf', 'şiir', 'dans', 'performans'
  ]
};

// Pozitif emoji grupları
const positiveEmojiGroups = {
  motivational: ['💪', '🎯', '✨', '🌟', '⭐', '🔥', '👊', '🚀', '💫'],
  funny: ['😂', '🤣', '😅', '😆', '😄', '😃', '😹', '🤪'],
  informative: ['📚', '💡', '🔍', '📊', '📈', '🧠', '💭', '📝'],
  artistic: ['🎨', '🎭', '🎬', '📸', '🎵', '🎼', '🎪', '🖼️']
};

async function initializePipeline() {
  if (!sentimentPipeline) {
    env.backends.onnx.wasm.numThreads = 1;
    sentimentPipeline = await pipeline('sentiment-analysis', 'dbmdz/bert-base-turkish-sentiment');
  }
  return sentimentPipeline;
}

function calculateCategoryScore(text: string, emojis: string[], category: string): number {
  const words = text.toLowerCase().split(/\s+/);
  let score = 0;

  // Kelime bazlı skor
  const categoryWords = positiveWordGroups[category as keyof typeof positiveWordGroups] || [];
  for (const word of words) {
    if (categoryWords.some(keyword => word.includes(keyword))) {
      score += 0.5;
    }
  }

  // Emoji bazlı skor
  const categoryEmojis = positiveEmojiGroups[category as keyof typeof positiveEmojiGroups] || [];
  for (const emoji of emojis) {
    if (categoryEmojis.includes(emoji)) {
      score += 0.3;
    }
  }

  return score;
}

function detectEmojis(text: string): string[] {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  return text.match(emojiRegex) || [];
}

export async function analyzeSentiment(text: string) {
  const pipeline = await initializePipeline();
  const result = await pipeline(text);
  const emojis = detectEmojis(text);

  // Kategori skorlarını hesapla
  const categoryScores = {
    motivational: calculateCategoryScore(text, emojis, 'motivational'),
    funny: calculateCategoryScore(text, emojis, 'funny'),
    informative: calculateCategoryScore(text, emojis, 'informative'),
    artistic: calculateCategoryScore(text, emojis, 'artistic')
  };

  // En yüksek kategori skorunu bul
  const topCategory = Object.entries(categoryScores)
    .reduce((a, b) => a[1] > b[1] ? a : b)[0];

  // BERT skoru pozitifse ve kategori skoru yeterince yüksekse
  const isBertPositive = result[0].label === 'positive' && result[0].score > 0.7;
  const hasCategoryMatch = categoryScores[topCategory as keyof typeof categoryScores] > 0.5;

  return {
    score: result[0].score,
    category: isBertPositive ? TweetCategories.POSITIVE : TweetCategories.NEUTRAL,
    type: hasCategoryMatch ? TweetCategories[topCategory.toUpperCase() as keyof typeof TweetCategories] : TweetCategories.NEUTRAL,
    stats: {
      bertScore: result[0].score,
      bertLabel: result[0].label,
      categoryScores,
      topCategory,
      emojis: emojis.length
    }
  };
} 