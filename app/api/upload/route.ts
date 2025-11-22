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

    if (!perfectLap.theoreticalTime || perfectLap.theoreticalTime <= 0) {
      return NextResponse.json(
        { error: 'Invalid lap time calculated. Please check telemetry data quality.' },
        { status: 400 }
      );
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

    if (!process.env.NEXT_OPENAI_API_KEY) {
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
