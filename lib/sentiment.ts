import { pipeline, env } from '@xenova/transformers';

// Modeli sunucu tarafında çalıştırmak için gerekli
env.useBrowserCache = false;
env.allowLocalModels = false;

// Sentiment analizi için pipeline
let sentimentPipeline: any = null;

export interface SentimentResult {
  label: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
}

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
    sentimentPipeline = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
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

export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  try {
    // Pipeline'ı ilk kullanımda yükle (lazy loading)
    if (!sentimentPipeline) {
      sentimentPipeline = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
    }

    // Metni analiz et
    const result = await sentimentPipeline(text);
    const sentiment = result[0];

    // Sonucu normalize et
    return {
      label: sentiment.label.toLowerCase() as 'positive' | 'negative' | 'neutral',
      score: sentiment.score,
      confidence: sentiment.score
    };
  } catch (error) {
    console.error('Duygu analizi sırasında hata:', error);
    // Hata durumunda nötr döndür
    return {
      label: 'neutral',
      score: 0.5,
      confidence: 0
    };
  }
} 