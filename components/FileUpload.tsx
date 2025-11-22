'use client';

import { useCallback, useState } from 'react';
import { Upload, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { Card, CardContent } from '@/components/ui/card';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClearFile: () => void;
}

export function FileUpload({ onFileSelect, selectedFile, onClearFile }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const csvFile = files.find((file) => file.name.toLowerCase().endsWith('.csv'));

      if (csvFile) {
        onFileSelect(csvFile);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files[0]) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  return (
    <Card className={`border-2 transition-all duration-300 midnight-blue ${isDragging ? 'border-[#5145F6] bg-[#5145F6]/10 glow-blue' : 'border-[#E6E8F0]/10'}`}>
      <CardContent className="pt-6">
        {selectedFile ? (
          <div className="flex items-center justify-between p-4 bg-[#0A0D1C] rounded-lg border border-[#E6E8F0]/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#5145F6]/10 flex items-center justify-center">
                <File className="w-5 h-5 text-[#5145F6]" />
              </div>
              <div>
                <p className="font-medium text-white">{selectedFile.name}</p>
                <p className="text-sm text-[#8A8FA3]">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClearFile} className="hover:bg-white/5">
              <X className="w-4 h-4 text-[#8A8FA3] hover:text-white" />
            </Button>
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center p-12 text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-[#5145F6]/10 flex items-center justify-center mb-6">
              <Upload className="w-10 h-10 text-[#5145F6]" />
            </div>
            <p className="mb-2 text-xl font-semibold text-white">Drop your CSV file here</p>
            <p className="mb-6 text-sm text-[#8A8FA3]">or</p>
            <label htmlFor="file-input">
              <GradientButton className="cursor-pointer" asChild>
                <span>Browse Files</span>
              </GradientButton>
              <input
                id="file-input"
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
            <p className="mt-6 text-xs text-[#8A8FA3]">
              Accepts CSV files with telemetry data
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
