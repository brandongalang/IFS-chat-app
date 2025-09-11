import { Message, MockAIClient } from '@/types/chat';

class MockAIClientImpl implements MockAIClient {
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateResponse(messages: Message[]): string {
    const lastMessage = messages[messages.length - 1];
    const userText = lastMessage.content.toLowerCase();

    // Tool-specific responses have been removed from the mock client.

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
    
    const response = this.generateResponse(messages);
    
    // Split response into chunks for streaming simulation
    const words = response.split(' ');
    let currentChunk = '';
    const timeouts: Array<ReturnType<typeof setTimeout>> = [];
    let cancelled = false;

    const initialDelay = 0;

    words.forEach((word, index) => {
      const timeout = setTimeout(() => {
        if (cancelled) return;
        
        currentChunk += (index > 0 ? ' ' : '') + word;
        const isComplete = index === words.length - 1;
        
        onToken(currentChunk, isComplete);
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
