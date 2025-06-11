import { pipeline, env } from '@xenova/transformers';

interface SentimentResult {
  label: string;
  score: number;
}

// Modeli yüklemek için yardımcı fonksiyon
let sentimentPipeline: any = null;

async function initializePipeline() {
  if (!sentimentPipeline) {
    // Modeli CPU'da çalıştır
    env.backends.onnx.wasm.numThreads = 1;
    
    // dbmdz/bert-base-turkish-sentiment modeli
    sentimentPipeline = await pipeline('sentiment-analysis', 'dbmdz/bert-base-turkish-sentiment');
  }
  return sentimentPipeline;
}

// Emoji skorlarını tanımlayalım
const emojiScores: { [key: string]: number } = {
  '😊': 1, '😃': 1, '😄': 1, '😁': 1, '😅': 0.5, '😂': 0.5, '🤣': 0.5,
  '😇': 1, '🥰': 1, '😍': 1, '🤩': 1, '😘': 1, '😗': 0.5, '☺️': 0.5,
  '😉': 0.5, '😌': 0.5, '😏': 0, '🙂': 0.5, '🤗': 1, '🤭': 0.5,
  '😔': -0.5, '😪': -0.5, '😕': -0.5, '😢': -1, '😭': -1, '😤': -1,
  '😠': -1, '😡': -1, '🤬': -1, '😱': -0.5, '😨': -0.5, '😰': -0.5,
  '😥': -0.5, '😓': -0.5, '🙄': -0.5, '😒': -0.5, '😩': -1, '😫': -1
};

// Tweet tipini belirleyen fonksiyon
function determineTweetType(text: string, sentiment: string): string {
  if (text.includes('😂') || text.includes('😅') || text.includes('🤣')) {
    return 'komik';
  } else if (text.includes('💡') || text.includes('📚') || text.includes('🎓')) {
    return 'bilgilendirici';
  } else if (text.includes('💪') || text.includes('✨') || text.includes('🌟')) {
    return 'motivasyonel';
  } else if (text.includes('🎨') || text.includes('🎭') || text.includes('🎬')) {
    return 'sanatsal';
  }

  // Eğer emoji bazlı tip belirlenemezse, duyguya göre belirle
  if (sentiment === 'positive') {
    return text.length > 100 ? 'bilgilendirici' : 'motivasyonel';
  }
  
  return 'genel';
}

// Emoji analizi yapan fonksiyon
function analyzeEmojis(text: string): { score: number; count: number } {
  let score = 0;
  let count = 0;

  for (const [emoji, emojiScore] of Object.entries(emojiScores)) {
    const emojiRegex = new RegExp(emoji, 'g');
    const matches = text.match(emojiRegex);
    if (matches) {
      score += emojiScore * matches.length;
      count += matches.length;
    }
  }

  return { score, count };
}

export async function analyzeSentiment(text: string) {
  try {
    // BERT modelini yükle
    const classifier = await initializePipeline();
    
    // BERT ile duygu analizi yap
    const result = await classifier(text);
    const bertSentiment = result[0];
    
    // Emoji analizi
    const { score: emojiScore, count: emojiCount } = analyzeEmojis(text);
    
    // BERT ve emoji skorlarını birleştir
    const combinedScore = (
      bertSentiment.score * (bertSentiment.label === 'positive' ? 1 : -1) +
      emojiScore
    ) / (emojiCount > 0 ? 2 : 1); // Emoji varsa ortalamasını al
    
    // Kategoriyi belirle
    let category = 'nötr';
    if (combinedScore > 0.3) category = 'pozitif';
    else if (combinedScore < -0.3) category = 'negatif';
    
    // Tweet tipini belirle
    const type = determineTweetType(text, bertSentiment.label);
    
    return {
      score: combinedScore,
      category,
      type,
      stats: {
        bertScore: bertSentiment.score,
        bertLabel: bertSentiment.label,
        emojiScore,
        emojis: emojiCount
      }
    };
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    throw error;
  }
} 