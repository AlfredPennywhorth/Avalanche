import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
} else {
    console.warn('VITE_GEMINI_API_KEY is not set. Gemini features will be disabled.');
}

export interface CommentEvaluation {
    isEnglish: boolean;
    isConstructive: boolean;
    reason?: string;
    error?: boolean;
}

export const evaluateComment = async (text: string): Promise<CommentEvaluation> => {
    if (!genAI) {
        console.warn('Gemini is not initialized.');
        return { error: true, isEnglish: false, isConstructive: true }; // Fallback to safe defaults
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
You are a moderation and language analysis assistant for a social feed app called Avalanche.
Analyze the following comment. Determine if it is written primarily in English, and if it is constructive/appropriate (not spam, not hate speech, not purely gibberish, not overly rude).
It is OK if a comment is short or uses emojis, as long as it's not malicious.
Return ONLY valid JSON with no markdown formatting or extra text.
Format:
{
  "isEnglish": boolean,
  "isConstructive": boolean,
  "reason": "Brief explanation"
}

Comment: "${text}"
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Strip markdown if AI returned markdown block (e.g. \`\`\`json ... \`\`\`)
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        return {
            isEnglish: !!parsed.isEnglish,
            isConstructive: !!parsed.isConstructive,
            reason: parsed.reason
        };

    } catch (error) {
        console.error('Error evaluating comment with Gemini:', error);
        return { error: true, isEnglish: false, isConstructive: true };
    }
};
