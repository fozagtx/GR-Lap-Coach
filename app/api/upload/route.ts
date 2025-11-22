import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { synthesizePerfectLapFromContent, formatLapTime } from '@/lib/telemetry-engine-upload';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const trackName = formData.get('trackName') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 });
    }

    const csvContent = await file.text();

    const perfectLap = synthesizePerfectLapFromContent(csvContent);

    if (!perfectLap || !perfectLap.sectorStats || perfectLap.sectorStats.length === 0) {
      return NextResponse.json(
        { error: 'No valid sectors found in telemetry data. Please check CSV format.' },
        { status: 400 }
      );
    }

    // Relaxed validation - warn but continue if theoretical time seems low
    if (!perfectLap.theoreticalTime || perfectLap.theoreticalTime <= 0) {
      console.warn('Theoretical time is unusually low:', perfectLap.theoreticalTime);
      // Continue processing rather than rejecting - AI can handle edge cases
    }

    const { data: sessionData, error: sessionError } = await supabase
      .from('telemetry_sessions')
      .insert({
        track_name: trackName || 'Unknown Track',
        file_name: file.name,
        file_path: `uploads/${Date.now()}_${file.name}`,
        theoretical_time: perfectLap.theoreticalTime,
        sector_stats: perfectLap.sectorStats,
        chart_data: perfectLap.chartData,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Database error:', sessionError);
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
    }

    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return NextResponse.json(
        {
          sessionId: sessionData.id,
          chartData: perfectLap.chartData,
          aiAnalysis: 'OpenAI API key not configured. Upload successful, but AI analysis unavailable.',
          theoreticalTime: perfectLap.theoreticalTime,
          sectorStats: perfectLap.sectorStats,
        },
        { status: 200 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    });

    const summaryText = `
Perfect Lap Analysis for Track: ${trackName || 'COTA'}

Theoretical Best Lap Time: ${formatLapTime(perfectLap.theoreticalTime)}

Sector Breakdown:
${perfectLap.sectorStats
  .map(
    (stat) =>
      `- ${stat.sectorName}: Best Time ${formatLapTime(stat.bestTime)} from Lap ${stat.lapNumber}. Average Speed: ${stat.avgSpeed.toFixed(1)} km/h. Potential Time Gain: ${stat.timeGain.toFixed(3)}s compared to average sector time.`
  )
  .join('\n')}

Total Data Points: ${perfectLap.chartData.length}
Number of Sectors Analyzed: ${perfectLap.sectorStats.length}

Provide specific, actionable coaching advice based on this real telemetry data.
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

    await supabase.from('chat_messages').insert({
      session_id: sessionData.id,
      role: 'assistant',
      content: aiAnalysis,
    });

    return NextResponse.json({
      sessionId: sessionData.id,
      chartData: perfectLap.chartData,
      aiAnalysis,
      theoreticalTime: perfectLap.theoreticalTime,
      sectorStats: perfectLap.sectorStats,
    });
  } catch (error: any) {
    console.error('Upload error:', error);

    if (error.message?.includes('No valid laps')) {
      return NextResponse.json(
        { error: 'No valid laps detected in telemetry data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to process telemetry data' },
      { status: 500 }
    );
  }
}
