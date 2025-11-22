'use client';

import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StreamingAnalysisProps {
  analysis: string;
}

export function StreamingAnalysis({ analysis }: StreamingAnalysisProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [analysis]);

  useEffect(() => {
    if (currentIndex < analysis.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + analysis[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, 15);

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, analysis]);

  const cleanedText = displayedText.replace(/\*\*/g, '').replace(/\*/g, '');

  return (
    <Card variant="gradient" className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg">
      <CardContent className="pt-6">
        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          AI Insights
        </h3>
        <div className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line text-sm md:text-base min-h-[100px]">
          {cleanedText}
          {currentIndex < analysis.length && (
            <span className="inline-block w-0.5 h-4 bg-blue-600 animate-pulse ml-0.5" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
