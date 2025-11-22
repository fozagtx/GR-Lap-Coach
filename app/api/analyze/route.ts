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

    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
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
          content: `You are an expert motorsport racing coach specializing in Toyota GR86 Cup racing. You analyze lap and sector data to provide actionable coaching advice.

## DATA YOU RECEIVE
You work with LAP-LEVEL data containing:
- Lap times and lap numbers
- Sector times in seconds
- Average speed and top speed per lap
- Distance-based telemetry markers

## CRITICAL: DATA VALIDATION RULES
When validating lap times:
1. Calculate expected lap time from sector sum
2. Compare to reported lap time
3. If difference < 2.0 seconds: Accept and proceed
4. If difference > 2.0 seconds: Note discrepancy but CONTINUE analysis
5. NEVER reject data or throw errors about invalid lap times

## YOUR ANALYSIS CAPABILITIES
✓ Lap time consistency analysis
✓ Sector-by-sector performance breakdown
✓ Theoretical best lap calculations
✓ Race pace trends
✓ Focus area identification

## RESPONSE FORMAT
Structure responses with:
- Performance summary with specific metrics
- Sector analysis with best/avg times and gaps
- Key findings (2-3 bullet points)
- Actionable recommendations (prioritized 1-3)
- Data quality notes if needed

## ERROR HANDLING
- Missing data: Work with what's available
- Outliers: Note but include in analysis
- Validation failures: Proceed with warning
- Be transparent about limitations

Focus on extracting maximum value from the data while being honest about what you can and cannot determine. Keep response under 200 words.`,
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
