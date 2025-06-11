import { NextResponse } from 'next/server';
import { analyzeSentiment } from '@/lib/sentiment';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const analysis = await analyzeSentiment(text);
    
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}