import { Message, MockAIClient, ToolCall } from '@/types/chat';
import { detectTool } from './toolDetection';

class MockAIClientImpl implements MockAIClient {
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateResponse(messages: Message[], tool?: ToolCall): string {
    const lastMessage = messages[messages.length - 1];
    const userText = lastMessage.content.toLowerCase();

    if (tool) {
      const toolResponses: Record<string, string> = {
        lookup_weather: `I called the weather lookup tool to get current conditions for ${tool.inputs?.location || 'the requested location'}. Expand the tool card above to inspect the detailed results.\n\nBased on the data, the area is currently experiencing ${tool.rawJson?.current?.condition?.replace('_', ' ') || 'mild conditions'} with a temperature of ${tool.rawJson?.current?.temp || 'comfortable'}°F and ${tool.rawJson?.current?.humidity || 70}% humidity. The forecast shows stable conditions continuing through the week.`,
        
        calculate: `I performed the calculation using the math tool. Expand the tool card above to see the detailed computation.\n\nThe result of ${tool.inputs?.expression} is ${tool.rawJson?.result}. This calculation was processed using safe arithmetic evaluation.`,
        
        web_search: `I searched for "${tool.inputs?.query}" and found relevant results. Expand the tool card above to view the search results and additional details.\n\nThe search returned ${tool.rawJson?.total_results || 'several'} results with information related to your query.`,
        
        default: `I called the ${tool.name} tool with the provided parameters. Expand the tool card above to inspect the results and raw response data.\n\nThe tool executed successfully and returned the requested information.`
      };

      return toolResponses[tool.name] || toolResponses.default;
    }

    // Generate contextual responses based on user input
    if (userText.includes('hello') || userText.includes('hi')) {
      return 'Hello! I\'m your AI assistant powered by the Vercel AI SDK. I can help you with weather information, calculations, searches, and more. Try asking me about the weather in a specific city, or give me a math problem to solve!';
    }
    
    if (userText.includes('help')) {
      return 'I can help you with various tasks:\n\n• **Weather**: Ask about weather in any city (e.g., "What\'s the weather in Seattle?")\n• **Calculations**: Give me math problems (e.g., "Calculate 15 * 23")\n• **Search**: Search for information (e.g., "Search for AI trends")\n• **Voice Input**: Use the microphone button to speak your questions\n\nI use tool calling to provide accurate, up-to-date information. Tool cards will appear above my responses when I use external data sources.';
    }
    
    if (userText.includes('test')) {
      return 'I\'m working perfectly! This is a demonstration of the Vercel AI SDK\'s streaming capabilities. You can see this message appearing progressively as if it\'s being generated in real-time.\n\nTry some example prompts:\n• "Weather in Portland"\n• "Calculate 42 * 7"\n• Use voice input with the microphone button';
    }
    
    return 'I understand your message and I\'m here to help! While this is a frontend demo with mocked responses, the interface uses real Vercel AI SDK primitives that will work seamlessly with a live backend.\n\nTry asking about weather, giving me calculations, or using the voice input feature to see the full functionality in action.';
  }

  streamMessage(params: {
    messages: Message[];
    onToken: (token: string, isComplete: boolean) => void;
  }): { cancel: () => void } {
    const { messages, onToken } = params;
    const lastMessage = messages[messages.length - 1];
    
    // Detect tool usage
    const tool = detectTool(lastMessage.content);
    const response = this.generateResponse(messages, tool || undefined);
    
    // Split response into chunks for streaming simulation
    const words = response.split(' ');
    let currentChunk = '';
    let timeouts: Array<ReturnType<typeof setTimeout>> = [];
    let cancelled = false;

    // If tool detected, simulate tool execution delay first
    const initialDelay = tool ? 500 : 0;

    words.forEach((word, index) => {
      const timeout = setTimeout(() => {
        if (cancelled) return;
        
        currentChunk += (index > 0 ? ' ' : '') + word;
        const isComplete = index === words.length - 1;
        
        // Return complete message with tool data on completion
        if (isComplete && tool) {
          onToken(currentChunk, true);
        } else {
          onToken(currentChunk, isComplete);
        }
      }, initialDelay + index * (50 + Math.random() * 150)); // Random delay between 50-200ms per word
      
      timeouts.push(timeout);
    });

    return {
      cancel: () => {
        cancelled = true;
        timeouts.forEach(clearTimeout);
      }
    };
  }
}

export const mockAIClient = new MockAIClientImpl();
