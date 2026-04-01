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

export const generateAvaResponse = async (context: string, type: 'post' | 'mention'): Promise<string | null> => {
    if (!genAI) {
        console.warn('Gemini is not initialized.');
        return null;
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = type === 'post'
            ? `You are Ava, a friendly and encouraging native English teacher participating in a social app called Avalanche. A student just made a new post with the text: "${context}". Write a short, encouraging comment (max 2 sentences) complementing their effort, giving a tiny English tip related to their text, or asking a fun follow-up question in English. Use emojis. ❄️`
            : `You are Ava, a friendly English teacher participating in an app called Avalanche. A student mentioned you in a comment saying: "${context}". Reply directly to them in a short, friendly, and helpful manner (max 2 sentences). Use emojis. ❄️`;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error: any) {
        const status = error?.status || error?.httpStatusCode || error?.code || 'unknown';
        const message = error?.message || JSON.stringify(error);
        console.error(`[Ava] Error generating response — Status: ${status} | Message: ${message}`);
        if (status === 429 || message.includes('429') || message.includes('quota') || message.includes('rate')) {
            console.warn('[Ava] Rate limit hit. Ava will be silent for this request.');
        }
        return null;
    }
};
