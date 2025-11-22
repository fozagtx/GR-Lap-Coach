'use client';

import { useState } from 'react';
import { Search, Mic, Zap, Upload, TrendingUp, Activity, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { FileUpload } from '@/components/FileUpload';
import { ChatInterface } from '@/components/ChatInterface';
import { StreamingAnalysis } from '@/components/StreamingAnalysis';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

interface AnalysisResult {
  sessionId: string;
  chartData: Array<{ distance: number; speed: number; sector: string }>;
  aiAnalysis: string;
  theoreticalTime: number;
  sectorStats: Array<{
    sectorName: string;
    bestTime: number;
    lapNumber: number;
    timeGain: number;
    avgSpeed: number;
  }>;
}

export default function Home() {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expandedAccordion, setExpandedAccordion] = useState<number | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('trackName', 'COTA');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();
      setResult(data);
      setShowAnalysis(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis');
    } finally {
      setLoading(false);
    }
  };

  const formatLapTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.floor((timeInSeconds % 1) * 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  const features = [
    { title: 'Perfect Lap Synthesis', desc: 'Automatically combines the fastest sectors from your data' },
    { title: 'AI Race Engineer', desc: 'Get personalized coaching insights powered by GPT-4o' },
    { title: 'Smart Drafting Filter', desc: 'Filters out laps affected by slipstream automatically' },
    { title: 'Real-time Chat', desc: 'Ask questions and get instant feedback on your performance' },
  ];


  return (
    <div className="min-h-screen bg-[#05060F]">
      {!showAnalysis && <Navigation onLaunchApp={() => setShowAnalysis(true)} />}

      {!showAnalysis ? (
        <>
          <section className="relative pt-20 pb-12 md:pt-24 md:pb-20">
            <div className="container-custom">
              <Card className="w-full h-[600px] md:h-[700px] bg-black/[0.96] relative overflow-hidden border-2 border-gray-800 rounded-3xl">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>

                <div className="flex flex-col md:flex-row h-full relative z-10">
                  <div className="flex-1 p-6 md:p-12 flex flex-col justify-center">
                    <div className="max-w-2xl">
                      <div className="inline-block px-4 py-2 bg-blue-600/10 border border-blue-600/20 rounded-full mb-6">
                        <span className="text-blue-400 text-xs md:text-sm font-medium">Powered by GPT-4o</span>
                      </div>

                      <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 mb-6 leading-tight">
                        Prometheus <span className="text-blue-500">V3</span>
                        <br />
                        <span className="text-2xl md:text-4xl lg:text-5xl italic font-light">Race telemetry reimagined</span>
                      </h1>

                      <p className="text-base md:text-lg text-neutral-300 mb-8 leading-relaxed">
                        Upload your telemetry data and get instant AI-powered insights. Perfect lap synthesis, smart drafting filters, and real-time coaching.
                      </p>

                      <div className="flex flex-col sm:flex-row gap-4">
                        <GradientButton
                          onClick={() => setShowAnalysis(true)}
                          size="lg"
                        >
                          <Upload className="w-5 h-5 mr-2" />
                          Start Analysis
                        </GradientButton>
                        <GradientButton
                          variant="variant"
                          size="lg"
                        >
                          View Demo
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </GradientButton>
                      </div>

                      <div className="mt-8 flex flex-wrap gap-6 text-xs md:text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                          <span>AI-Powered</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span>Toyota GR Cup Certified</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                          <span>Real-time Analysis</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 relative hidden md:flex items-center justify-center">
                    <div className="relative w-[400px] h-[400px]">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full opacity-20 blur-3xl animate-pulse"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Activity className="w-48 h-48 text-cyan-400/40" />
                      </div>
                      <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
                      <div className="absolute bottom-1/4 right-1/4 w-2 h-2 bg-blue-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                      <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          <section className="section-spacing bg-white">
            <div className="container-custom">
              <div className="grid md:grid-cols-2 gap-16 items-center">
                <div>
                  <p className="text-xs md:text-sm uppercase tracking-wider text-gray-600 mb-4">CAPABILITIES</p>
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                    Outperform the <span className="italic font-light">competition</span> with V3
                  </h2>
                  <button className="btn-secondary text-sm md:text-base">TRY IT OUT</button>
                </div>

                <div className="space-y-4">
                  {features.map((feature, idx) => (
                    <div
                      key={idx}
                      className="border-b border-[#E6E8F0] pb-4 cursor-pointer"
                      onClick={() => setExpandedAccordion(expandedAccordion === idx ? null : idx)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 text-sm md:text-base">{feature.title}</span>
                        {expandedAccordion === idx ? (
                          <ChevronDown className="w-5 h-5 text-blue-600" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      {expandedAccordion === idx && (
                        <p className="mt-2 text-xs md:text-sm text-gray-600">{feature.desc}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>


          <footer className="border-t border-white/10 py-8">
            <div className="container-custom">
              <div className="flex flex-col sm:flex-row items-center justify-between text-xs md:text-sm text-gray-400 gap-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  <span>Prometheus</span>
                </div>
                <div>© 2025 Prometheus AI. All rights reserved.</div>
              </div>
            </div>
          </footer>
        </>
      ) : (
        <div className="pt-24 pb-12 min-h-screen">
          <div className="container-custom">
            <div className="mb-8">
              <Button
                onClick={() => setShowAnalysis(false)}
                variant="outline"
                className="text-[#89D3FF] hover:text-white transition-colors"
              >
                ← Back to Home
              </Button>
            </div>

            {!result ? (
              <div className="max-w-3xl mx-auto space-y-8">
                <div className="text-center mb-12">
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white">Upload Your Telemetry</h1>
                  <p className="text-base md:text-lg text-gray-300">
                    Drop your CSV file below to begin analysis
                  </p>
                </div>

                <FileUpload
                  onFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                  onClearFile={handleClearFile}
                />

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-center">
                  <button
                    onClick={handleUploadAndAnalyze}
                    disabled={loading || !selectedFile}
                    className="btn-primary text-lg px-12 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Activity className="w-5 h-5 mr-2 animate-spin inline" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 mr-2 inline" />
                        Analyze Telemetry
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="text-center mb-12">
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white">Analysis Complete</h1>
                  <div className="text-4xl md:text-5xl lg:text-6xl font-bold text-gradient mb-2">
                    {formatLapTime(result.theoreticalTime)}
                  </div>
                  <p className="text-base md:text-lg text-gray-300">Theoretical Best Lap Time</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-12">
                  {result.sectorStats.map((stat, idx) => (
                    <Card key={idx} className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg hover:shadow-xl transition-all">
                      <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-2">
                          <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{stat.sectorName}</h3>
                          <div className="text-left sm:text-right">
                            <div className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400">
                              {formatLapTime(stat.bestTime)}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Lap {stat.lapNumber}</div>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600 dark:text-gray-400">Avg Speed</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{stat.avgSpeed.toFixed(1)} km/h</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Time Gain</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">+{stat.timeGain.toFixed(3)}s</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="bg-gray-900 border-2 border-gray-700">
                  <CardContent className="p-4 md:p-8">
                    <h3 className="text-xl md:text-2xl font-bold mb-6 text-white">Speed Trace</h3>
                    <div className="h-64 md:h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={result.chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#3C4466" />
                          <XAxis dataKey="distance" stroke="#8A8FA3" />
                          <YAxis dataKey="speed" stroke="#8A8FA3" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0A0D1C',
                              border: '1px solid #3C4466',
                              borderRadius: '0.75rem',
                            }}
                            formatter={(value: any) => [`${value.toFixed(1)} km/h`, 'Speed']}
                          />
                          <Line
                            type="monotone"
                            dataKey="speed"
                            stroke="#5145F6"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid lg:grid-cols-2 gap-6">
                  <StreamingAnalysis analysis={result.aiAnalysis} />

                  <Card className="bg-gray-900 border-2 border-gray-700 rounded-2xl shadow-lg">
                    <CardContent className="pt-6">
                      <h3 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-cyan-400" />
                        Interactive Coaching
                      </h3>
                      <p className="text-gray-300 mb-4 text-sm md:text-base">
                        Ask the AI race engineer specific questions about your performance
                      </p>
                      <ChatInterface sessionId={result.sessionId} />
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
