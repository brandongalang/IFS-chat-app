const express = require('express')
const cors = require('cors')

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// Mock chat API endpoint for testing
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' })
    }

    console.log('Received messages:', messages)

    // Mock streaming response for testing
    const mockResponse = `I hear you sharing about "${messages[messages.length - 1].content}". It sounds like there might be different parts of you with different feelings about this situation. What comes up for you when you notice these different reactions?`

    // Simple mock streaming - in real implementation this would be Mastra's streaming
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })

    // Simulate streaming by sending chunks
    const words = mockResponse.split(' ')
    for (let i = 0; i < words.length; i++) {
      const chunk = i === 0 ? words[i] : ' ' + words[i]
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
      await new Promise(resolve => setTimeout(resolve, 50)) // Small delay for streaming effect
    }
    
    res.write(`data: [DONE]\n\n`)
    res.end()

  } catch (error) {
    console.error('Chat API error:', error)
    return res.status(500).json({ error: 'Something went wrong: ' + error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Development API server running on http://localhost:${PORT}`)
})