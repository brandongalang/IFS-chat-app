import { ToolCall } from '@/types/chat';

export function detectTool(text: string): ToolCall | null {
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

type ToolParams = Record<string, string | number | boolean>;

function parseToolParams(params: string): ToolParams {
  const result: ToolParams = {};
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
