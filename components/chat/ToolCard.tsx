'use client'

import { useState } from 'react';
import { ToolCall } from '@/types/chat';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, RefreshCw, CloudSun, Calculator, Search, Gavel } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToolCardProps {
  tool: ToolCall;
  messageId: string;
  onRerun: () => void;
}

export function ToolCard({ tool, messageId, onRerun }: ToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'lookup_weather':
        return <CloudSun className="w-4 h-4 text-accent" />;
      case 'calculate':
        return <Calculator className="w-4 h-4 text-accent" />;
      case 'web_search':
        return <Search className="w-4 h-4 text-accent" />;
      default:
        return <Gavel className="w-4 h-4 text-accent" />;
    }
  };

  const formatInputs = (inputs?: Record<string, any>) => {
    if (!inputs) return null;
    
    return Object.entries(inputs).map(([key, value]) => (
      <span key={key} className="font-mono bg-muted px-1 py-0.5 rounded text-xs mr-1">
        {key}: &quot;{String(value)}&quot;
      </span>
    ));
  };

  return (
    <div 
      className="bg-card border border-border rounded-lg p-3 shadow-sm"
      data-testid={`tool-card-${messageId}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-accent/10 rounded flex items-center justify-center">
              {getToolIcon(tool.name)}
            </div>
            <span className="font-medium text-sm" data-testid={`text-tool-name-${messageId}`}>
              {tool.name}
            </span>
          </div>
          <p className="text-muted-foreground text-xs mt-1" data-testid={`text-tool-summary-${messageId}`}>
            {tool.summary}
          </p>
          {tool.inputs && (
            <div className="text-xs text-muted-foreground mt-1" data-testid={`text-tool-inputs-${messageId}`}>
              {formatInputs(tool.inputs)}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-2 h-6 w-6"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid={`button-tool-toggle-${messageId}`}
        >
          {isExpanded ? (
            <ChevronUp className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          )}
        </Button>
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-border" data-testid={`tool-details-${messageId}`}>
              <div className="space-y-3">
                {tool.details && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Details
                    </h4>
                    <p className="text-sm mt-1" data-testid={`text-tool-details-${messageId}`}>
                      {tool.details}
                    </p>
                  </div>
                )}
                
                {tool.rawJson && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Raw Response
                    </h4>
                    <pre 
                      className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto max-h-32"
                      data-testid={`text-tool-raw-${messageId}`}
                    >
                      {JSON.stringify(tool.rawJson, null, 2)}
                    </pre>
                  </div>
                )}
                
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onRerun}
                  className="w-full"
                  data-testid={`button-tool-rerun-${messageId}`}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Re-run Gavel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
