'use client';

import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavigationProps {
  onLaunchApp: () => void;
}

export function Navigation({ onLaunchApp }: NavigationProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 rounded-full border border-white/10 w-full max-w-2xl ${
        scrolled ? 'bg-[#05060F]/90 backdrop-blur-lg' : 'bg-[#05060F]/50 backdrop-blur-sm'
      }`}
    >
      <div className="px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-[#5145F6]" />
            <span className="text-xl font-bold">Prometheus</span>
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={onLaunchApp} size="sm">
              Launch App
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
