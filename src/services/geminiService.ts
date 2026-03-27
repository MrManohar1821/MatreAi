import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export interface PregnancyRiskAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
  alerts: string[];
  summary: string;
}

export const getRiskAssessment = async (data: any, language: string = 'en'): Promise<PregnancyRiskAssessment> => {
  const languageNames: Record<string, string> = {
    en: 'English',
    kn: 'Kannada',
    hi: 'Hindi'
  };
  const targetLanguage = languageNames[language] || 'English';

  const prompt = `You are a compassionate maternal health expert. Analyze the following pregnancy data and provide a detailed risk assessment (low, medium, high), supportive recommendations, and critical alerts.
  
  Data: ${JSON.stringify(data)}
  
  Your tone should be warm and encouraging. Offer practical, real-world advice for the symptoms or data provided.
  
  IMPORTANT: Provide the recommendations, alerts, and summary in ${targetLanguage}.
  Return the response in JSON format.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskLevel: { type: Type.STRING, enum: ["low", "medium", "high"] },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            alerts: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING }
          },
          required: ["riskLevel", "recommendations", "alerts", "summary"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as PregnancyRiskAssessment;
  } catch (error) {
    console.error("AI Assessment Error:", error);
    throw error;
  }
};

export const getChatResponse = async (history: { role: string, content: string }[], message: string, language: string = 'en') => {
  const languageNames: Record<string, string> = {
    en: 'English',
    kn: 'Kannada',
    hi: 'Hindi'
  };
  const targetLanguage = languageNames[language] || 'English';

  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: `You are MaternalAI, a deeply compassionate, empathetic, and expert maternal healthcare companion. You are a supportive partner in this pregnancy journey.
      
      - Tone: Warm, caring, and reassuring. Address the user as "Mama" or "Dear".
      - Empathy: Acknowledge the physical and emotional challenges. Offer comfort and validation (e.g., "I know it's hard to deal with this tiredness, but you're doing amazing").
      - Real-World Guidance: Provide practical, everyday suggestions for comfort (e.g., sleep positions, hydration, gentle stretches, soothing foods).
      - Safety First: Prioritize safety and recommend consulting a healthcare provider for medical concerns. 
      - Emergency: Be alert for red flags (bleeding, sudden vision changes, severe pain) and provide urgent but calm guidance to seek immediate care.
      
      IMPORTANT: Always respond in ${targetLanguage}.`
    }
  });

  const fullPrompt = history.map(h => `${h.role}: ${h.content}`).join("\n") + `\nuser: ${message}`;
  
  try {
    const responseStream = await chat.sendMessageStream({ message: fullPrompt });
    return responseStream;
  } catch (error) {
    console.error("AI Chat Stream Error:", error);
    throw error;
  }
};
