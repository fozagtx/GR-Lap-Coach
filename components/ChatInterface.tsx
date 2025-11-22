'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ChatInterfaceProps {
  sessionId: string | null;
}

export function ChatInterface({ sessionId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [streamingMessage, setStreamingMessage] = useState('');

  useEffect(() => {
    if (sessionId) {
      loadChatHistory();
    }
  }, [sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMessage]);

  const loadChatHistory = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/chat/history?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingMessage('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: input,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        setStreamingMessage(accumulatedText);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: accumulatedText,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingMessage('');
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!sessionId) {
    return (
      <Card className="border-2 border-gray-600 bg-gray-800">
        <CardContent className="pt-6">
          <div className="text-center text-gray-400 py-8">
            <Bot className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 opacity-50" />
            <p className="text-sm md:text-base">Upload and analyze a telemetry file to start coaching</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-gray-600 flex flex-col h-[500px] md:h-[600px] bg-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white text-base md:text-lg">
          <Bot className="w-5 h-5 text-cyan-400" />
          Race Engineer Coach
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 px-4 md:px-6" ref={scrollRef}>
          <div className="space-y-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-cyan-900 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 md:w-4 md:h-4 text-cyan-400" />
                  </div>
                )}
                <div
                  className={`rounded-lg px-3 md:px-4 py-2 max-w-[85%] md:max-w-[80%] ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-xs md:text-sm leading-relaxed">
                    {message.content.replace(/\*\*/g, '').replace(/\*/g, '')}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-blue-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            {streamingMessage && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-cyan-900 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 md:w-4 md:h-4 text-cyan-400" />
                </div>
                <div className="rounded-lg px-3 md:px-4 py-2 max-w-[85%] md:max-w-[80%] bg-gray-700 text-gray-100">
                  <p className="whitespace-pre-wrap text-xs md:text-sm leading-relaxed">
                    {streamingMessage.replace(/\*\*/g, '').replace(/\*/g, '')}
                    <span className="inline-block w-0.5 h-4 bg-cyan-400 animate-pulse ml-0.5" />
                  </p>
                </div>
              </div>
            )}
            {isLoading && !streamingMessage && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-cyan-900 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 md:w-4 md:h-4 text-cyan-400" />
                </div>
                <div className="rounded-lg px-4 py-2 bg-gray-700">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="border-t border-gray-700 p-3 md:p-4 bg-gray-800">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your performance..."
              disabled={isLoading}
              className="flex-1 bg-gray-900 border-gray-600 text-white placeholder:text-gray-400 focus:border-cyan-500 focus:ring-cyan-500"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2 hidden sm:block">
            Ask about braking points, corner speeds, or sector improvements
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
