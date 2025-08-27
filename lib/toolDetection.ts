import { ToolCall } from '@/types/chat';

export function detectTool(text: string): ToolCall | null {
  const lowerText = text.toLowerCase();
  
  // Weather detection
  if (lowerText.includes('weather')) {
    const location = extractLocation(text) || 'Unknown Location';
    return {
      name: 'lookup_weather',
      summary: `7-day weather forecast for ${location}`,
      inputs: { location },
      details: 'Retrieved current conditions and 7-day forecast from weather API. Temperature, precipitation, and wind data included.',
      rawJson: {
        location,
        current: {
          temp: 65,
          condition: 'partly_cloudy',
          humidity: 72
        },
        forecast: [
          { day: 'Today', high: 68, low: 52, condition: 'partly_cloudy' },
          { day: 'Tomorrow', high: 71, low: 55, condition: 'sunny' }
        ]
      }
    };
  }
  
  // Calculator detection
  if (lowerText.includes('calc') || lowerText.includes('calculate') || /\d+\s*[+\-*/]\s*\d+/.test(text)) {
    const expression = extractMathExpression(text) || text;
    const result = evaluateSafeMath(expression);
    return {
      name: 'calculate',
      summary: `Mathematical calculation: ${expression}`,
      inputs: { expression },
      details: `Performed arithmetic calculation using safe math evaluation.`,
      rawJson: {
        input: expression,
        result: result,
        operation: 'arithmetic'
      }
    };
  }
  
  // Search/lookup detection
  if (lowerText.includes('search') || lowerText.includes('lookup') || lowerText.includes('find')) {
    const query = extractSearchQuery(text) || text;
    return {
      name: 'web_search',
      summary: `Search results for: ${query}`,
      inputs: { query },
      details: 'Performed web search and retrieved relevant results.',
      rawJson: {
        query,
        results: [
          { title: 'Example Result 1', url: 'https://example.com/1' },
          { title: 'Example Result 2', url: 'https://example.com/2' }
        ],
        total_results: 1250
      }
    };
  }
  
  // Pattern-based tool detection: [tool:name param=value]
  const toolPattern = /\[tool:(\w+)\s+([^\]]+)\]/i;
  const match = text.match(toolPattern);
  if (match) {
    const [, toolName, params] = match;
    const parsedParams = parseToolParams(params);
    return {
      name: toolName,
      summary: `Custom tool: ${toolName}`,
      inputs: parsedParams,
      details: `Executed custom tool with provided parameters.`,
      rawJson: {
        tool_name: toolName,
        parameters: parsedParams,
        execution_time: Date.now()
      }
    };
  }
  
  return null;
}

function extractLocation(text: string): string | null {
  const patterns = [
    /weather.*?in\s+([a-zA-Z\s,]+)/i,
    /(?:what's|whats).*?weather.*?([a-zA-Z\s,]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

function extractMathExpression(text: string): string | null {
  const mathPattern = /(\d+(?:\.\d+)?\s*[+\-*/]\s*\d+(?:\.\d+)?)/;
  const match = text.match(mathPattern);
  return match ? match[1] : null;
}

function extractSearchQuery(text: string): string | null {
  const patterns = [
    /(?:search|lookup|find)\s+(?:for\s+)?(.+)/i,
    /(.+)(?:\s+search|\s+lookup)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

function parseToolParams(params: string): Record<string, any> {
  const result: Record<string, any> = {};
  const paramPattern = /(\w+)=([^\s]+)/g;
  let match;
  
  while ((match = paramPattern.exec(params)) !== null) {
    const [, key, value] = match;
    // Try to parse as number or boolean, otherwise keep as string
    if (value === 'true') result[key] = true;
    else if (value === 'false') result[key] = false;
    else if (!isNaN(Number(value))) result[key] = Number(value);
    else result[key] = value.replace(/['"]/g, '');
  }
  
  return result;
}

function evaluateSafeMath(expression: string): number | string {
  // Only allow basic math operations for safety
  const safeExpression = expression.replace(/[^0-9+\-*/.() ]/g, '');
  try {
    // Use Function constructor for safe evaluation (limited scope)
    return Function(`"use strict"; return (${safeExpression})`)();
  } catch {
    return 'Error: Invalid expression';
  }
}
