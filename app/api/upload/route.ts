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
          consistency: perfectLap.consistency,
          improvementAreas: perfectLap.improvementAreas,
          brakingZones: perfectLap.brakingZones,
          accelerationZones: perfectLap.accelerationZones,
          cornerAnalysis: perfectLap.cornerAnalysis,
          speedDeficits: perfectLap.speedDeficits,
        },
        { status: 200 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    });

    const consistencyInfo = perfectLap.consistency
      ? `
Consistency Metrics:
- Best Lap: ${formatLapTime(perfectLap.consistency.bestLapTime)}
- Average Lap: ${formatLapTime(perfectLap.consistency.avgLapTime)}
- Worst Lap: ${formatLapTime(perfectLap.consistency.worstLapTime)}
- Consistency Score: ${perfectLap.consistency.consistencyScore.toFixed(0)}/100
- Standard Deviation: ${perfectLap.consistency.stdDeviation.toFixed(3)}s
`
      : '';

    const improvementInfo = perfectLap.improvementAreas && perfectLap.improvementAreas.length > 0
      ? `
Priority Improvement Areas:
${perfectLap.improvementAreas
  .slice(0, 5)
  .map(
    (area, idx) =>
      `${idx + 1}. [${area.priority.toUpperCase()}] ${area.area} (${area.sector}): ${area.description}\n   → ${area.recommendation}`
  )
  .join('\n')}
`
      : '';

    const summaryText = `
Perfect Lap Analysis for Track: ${trackName || 'COTA'}

Theoretical Best Lap Time: ${formatLapTime(perfectLap.theoreticalTime)}
${consistencyInfo}
Sector Breakdown:
${perfectLap.sectorStats
  .map(
    (stat) =>
      `- ${stat.sectorName}: Best Time ${formatLapTime(stat.bestTime)} from Lap ${stat.lapNumber}. Average Speed: ${stat.avgSpeed.toFixed(1)} km/h. Potential Time Gain: ${stat.timeGain.toFixed(3)}s compared to average sector time.`
  )
  .join('\n')}
${improvementInfo}
Total Data Points: ${perfectLap.chartData.length}
Number of Sectors Analyzed: ${perfectLap.sectorStats.length}

Based on the improvement areas identified, provide specific, actionable coaching advice focusing on the highest priority areas where the driver can gain time.
    `.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert motorsport racing coach specializing in Toyota GR86 Cup racing. You analyze detailed telemetry data to provide specific, actionable coaching advice.

## DATA YOU RECEIVE
You work with comprehensive telemetry data including:
- Lap times, sector times, and lap numbers
- Consistency metrics (standard deviation, score out of 100)
- Prioritized improvement areas with specific locations and time losses
- Braking zone analysis with entry/exit speeds
- Corner speed analysis with minimum speeds
- Speed deficit zones showing where time is lost
- Average speeds and distance markers

## YOUR ANALYSIS CAPABILITIES
✓ Lap-to-lap consistency analysis with scoring
✓ Sector-by-sector performance breakdown
✓ Specific improvement area identification with priorities
✓ Braking point consistency evaluation
✓ Corner speed optimization opportunities
✓ Speed deficit analysis at specific track locations

## RESPONSE FORMAT
Provide concise, specific coaching focused on:
1. Top 2-3 priority improvement areas from the data
2. Specific locations (sectors/distances) where time is being lost
3. Concrete actions (e.g., "Brake 20m later", "Carry 5 km/h more through corner")
4. Consistency notes if score < 70/100

## COACHING STYLE
- Be specific with numbers and locations
- Prioritize high-impact improvements first
- Reference the improvement areas provided in the data
- Keep total response under 200 words but be precise

Focus on actionable, specific guidance that the driver can immediately apply. Reference exact sectors, speeds, and time losses from the data.`,
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
      consistency: perfectLap.consistency,
      improvementAreas: perfectLap.improvementAreas,
      brakingZones: perfectLap.brakingZones,
      accelerationZones: perfectLap.accelerationZones,
      cornerAnalysis: perfectLap.cornerAnalysis,
      speedDeficits: perfectLap.speedDeficits,
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
