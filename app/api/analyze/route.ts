import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { synthesizePerfectLap, formatLapTime } from '@/lib/telemetry-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId } = body;

    if (!trackId || typeof trackId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid trackId provided' },
        { status: 400 }
      );
    }

    const perfectLap = synthesizePerfectLap(trackId);

    if (!process.env.NEXT_OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.NEXT_OPENAI_API_KEY,
    });

    const summaryText = `
Perfect Lap Analysis for Track: ${trackId.toUpperCase()}

Theoretical Best Lap Time: ${formatLapTime(perfectLap.theoreticalTime)}

Sector Breakdown:
${perfectLap.sectorStats
  .map(
    (stat) =>
      `- ${stat.sectorName}: ${formatLapTime(stat.bestTime)} (Lap ${stat.lapNumber}) | Avg Speed: ${stat.avgSpeed.toFixed(1)} km/h | Time Gain: ${stat.timeGain.toFixed(3)}s`
  )
  .join('\n')}

Total Data Points: ${perfectLap.chartData.length}
Number of Sectors Analyzed: ${perfectLap.sectorStats.length}
    `.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional Race Engineer analyzing telemetry data for the Toyota GR Cup. You have been provided with REAL telemetry data including theoretical best lap time, sector times, lap numbers, average speeds, and time gains.

Your analysis MUST:
1. Reference the SPECIFIC theoretical best lap time provided
2. Discuss the ACTUAL sector times and lap numbers given
3. Highlight which sectors show the most potential for improvement based on the time gain values
4. Provide technical coaching on speed, braking, and corner entry based on the average speeds shown
5. Be specific and actionable - no generic advice

NEVER claim the data is missing or incorrect. You have been given complete, accurate telemetry data. Analyze what was provided. Keep your response under 200 words.`,
        },
        {
          role: 'user',
          content: summaryText,
        },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    const rawAnalysis = completion.choices[0]?.message?.content || 'Analysis unavailable';
    const aiAnalysis = rawAnalysis.replace(/\*\*/g, '').replace(/\*/g, '');

    return NextResponse.json({
      chartData: perfectLap.chartData,
      aiAnalysis,
      theoreticalTime: perfectLap.theoreticalTime,
      sectorStats: perfectLap.sectorStats,
    });
  } catch (error: any) {
    console.error('Analysis error:', error);

    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Telemetry file not found. Please ensure CSV file exists in public/data/' },
        { status: 404 }
      );
    }

    if (error.message?.includes('No valid laps')) {
      return NextResponse.json(
        { error: 'No valid laps detected in telemetry data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to analyze telemetry data' },
      { status: 500 }
    );
  }
}
