// Gemini API utility for medical triage

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

export async function getTriageResult(symptoms) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.')
  }

  const prompt = `You are a medical triage assistant. 
Do NOT diagnose. 
Only suggest the most suitable medical specialist and urgency level.

User symptoms:
"${symptoms}"

Return JSON only in this format:
{
  "specialist": "",
  "urgency": ""
}

Urgency must be one of:
- normal
- urgent
- emergency

Return only valid JSON, no markdown or extra text.`

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 150,
        },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Gemini API error response:', data)
      const errorMsg = data.error?.message || `Gemini API error: ${response.status}`
      throw new Error(errorMsg)
    }

    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      console.error('Unexpected API response format:', data)
      throw new Error('Unexpected response format from Gemini API')
    }

    const content = data.candidates[0].content.parts[0].text.trim()
    
    // Remove markdown code blocks if present
    let jsonString = content
    if (content.startsWith('```')) {
      jsonString = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    }

    // Parse the JSON response
    const result = JSON.parse(jsonString)
    
    return {
      specialist: result.specialist || 'General Practitioner',
      urgency: result.urgency || 'normal',
    }
  } catch (error) {
    console.error('Error calling Gemini:', error)
    throw error
  }
}
