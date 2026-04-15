import { generateContentSchema } from '@/types/schemas'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/ai/generate-content
 * Generate social media content using OpenAI GPT-4
 * Optimized for Indian social media context
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = generateContentSchema.parse(body)
    
    const apiKey = process.env.OPENAI_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }
    
    // Build system prompt for Indian social media context
    const systemPrompt = `You are an expert social media content creator for the Indian market. 
Your content should be culturally relevant, engaging, and optimized for the specified platform.
Consider Indian festivals, trends, and cultural nuances when generating content.
Use appropriate emojis and hashtags for the platform and language.
Keep the tone consistent with the requested tone (professional, casual, humorous, festive, hinglish, formal_hindi, regional_casual).
If festival_context is provided, incorporate that festival's themes and traditions naturally.`
    
    const userPrompt = `Generate social media content for ${parsed.platform} in ${parsed.language} with a ${parsed.tone} tone.
Prompt: ${parsed.prompt}
${parsed.festival_context ? `Festival context: ${parsed.festival_context}` : ''}
${parsed.max_length ? `Max length: ${parsed.max_length} characters` : ''}
${parsed.include_hashtags ? 'Include relevant hashtags at the end.' : ''}
${parsed.include_emoji ? 'Use appropriate emojis throughout.' : ''}`
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })
    
    const data = await response.json()
    
    if (data.error) {
      throw new Error(data.error.message)
    }
    
    const generatedContent = data.choices[0]?.message?.content || ''
    
    return NextResponse.json({
      content: generatedContent,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate content' },
      { status: 500 }
    )
  }
}
