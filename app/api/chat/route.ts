import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { formatLapTime } from '@/lib/telemetry-engine-upload';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, message } = body;

    if (!sessionId || !message) {
      return new Response(JSON.stringify({ error: 'Session ID and message are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: sessionData, error: sessionError } = await supabase
      .from('telemetry_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError || !sessionData) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: chatHistory, error: chatError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (chatError) {
      console.error('Failed to load chat history:', chatError);
    }

    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      role: 'user',
      content: message,
    });

    const openai = new OpenAI({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    });

    const contextMessage = `
You are analyzing telemetry data for this session:

Track: ${sessionData.track_name}
Theoretical Best Lap: ${formatLapTime(sessionData.theoretical_time)}

Sector Stats:
${sessionData.sector_stats
  .map(
    (stat: any) =>
      `- ${stat.sectorName}: ${formatLapTime(stat.bestTime)} (Lap ${stat.lapNumber}) | Avg Speed: ${stat.avgSpeed.toFixed(1)} km/h | Time Gain: ${stat.timeGain.toFixed(3)}s`
  )
  .join('\n')}

The driver is asking questions about their performance. Use this telemetry context to provide specific, actionable coaching advice.
    `.trim();

    const messages: any[] = [
      {
        role: 'system',
        content: `You are an expert motorsport racing coach for the Toyota GR86 Cup. You analyze telemetry data and provide personalized coaching.

## YOUR ROLE
- Answer specific questions about lap times, sectors, and technique
- Provide actionable advice based on telemetry data
- Be encouraging but honest about areas for improvement
- Reference specific sector times and speeds from the data
- Keep responses concise (under 150 words) but informative

## DATA HANDLING
- Work with available lap-level data (sector times, speeds, lap numbers)
- Accept data even if there are minor inconsistencies
- Focus on actionable insights rather than data validation
- Be transparent about limitations in the data

## RESPONSE STYLE
- Ground all advice in actual telemetry data provided
- Prioritize practical, implementable recommendations
- Use specific metrics and numbers when discussing performance
- Acknowledge when data is insufficient for detailed analysis

Never reject or complain about data quality - work with what you have to provide maximum value.`,
      },
      {
        role: 'user',
        content: contextMessage,
      },
    ];

    if (chatHistory && chatHistory.length > 0) {
      chatHistory.slice(-6).forEach((msg: any) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }

    messages.push({
      role: 'user',
      content: message,
    });

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 300,
      stream: true,
    });

    let fullResponse = '';

    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || '';
          fullResponse += text;
          controller.enqueue(encoder.encode(text));
        }

        const cleanedResponse = fullResponse.replace(/\*\*/g, '').replace(/\*/g, '');
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          role: 'assistant',
          content: cleanedResponse,
        });

        controller.close();
      },
    });

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to process chat message' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
