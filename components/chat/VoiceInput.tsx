'use client'

import { Button } from '@/components/ui/button';
import { Mic, MicOff, AlertTriangle } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { motion } from 'framer-motion';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const {
    isRecording,
    isSupported,
    transcript,
    startRecording,
    stopRecording,
    clearTranscript
  } = useSpeechRecognition();

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
      if (transcript.trim()) {
        onTranscript(transcript.trim());
        clearTranscript();
      }
    } else {
      clearTranscript();
      startRecording();
    }
  };

  if (!isSupported) {
    return (
      <Button
        variant="secondary"
        size="icon"
        disabled
        data-testid="button-voice-unsupported"
        title="Speech recognition not available in this browser"
      >
        <AlertTriangle className="w-4 h-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={handleToggleRecording}
      disabled={disabled}
      data-testid="button-voice-input"
      className={`transition-all duration-200 ${
        isRecording 
          ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' 
          : ''
      }`}
    >
      {isRecording ? (
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          <MicOff className="w-4 h-4" />
        </motion.div>
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </Button>
  );
}
