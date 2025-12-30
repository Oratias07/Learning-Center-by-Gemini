
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { Attachment, Message, Conversation } from "../types";

const SYSTEM_INSTRUCTION = `
אתה עוזר אקדמי בכיר. המטרה שלך היא לעזור למשתמש להתכונן למבחנים על סמך החומרים שסופקו בלבד.
שפה: עברית (רהוטה, מקצועית, אקדמית).

חוקים קריטיים:
1. סגנון: השתמש בשפה טבעית וזורמת. הימנע מרשימות רובוטיות משעממות.
2. מתמטיקה: עטוף נוסחאות בסימני דולר, למשל: $a^2 + b^2 = c^2$.
3. הפניות: ציין תמיד את שם הקובץ הרלוונטי בסוף הסברים: [שם_הקובץ.pdf].
4. הקשר קטגוריה: תקבל תקציר של שיחות קודמות באותו נושא. השתמש בו כדי לשמור על רצף לימודי ולמנוע חזרות מיותרות.
`;

export const validateHebrew = async (text: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return text;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ role: 'user', parts: [{ text: `שפר את העברית בטקסט הבא שיהיה טבעי וזורם, שמור על נוסחאות והפניות בדיוק כפי שהן: ${text}` }] }],
      config: { temperature: 0.1 }
    });
    return response.text || text;
  } catch (err) {
    return text;
  }
};

export const generateTitle = async (text: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "שיחה חדשה";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ role: 'user', parts: [{ text: `צור כותרת קצרה מאוד (עד 4 מילים) בעברית עבור השאלה: "${text}".` }] }],
      config: { temperature: 0.1 }
    });
    return response.text?.replace(/[*"]/g, '').trim() || "שיחה חדשה";
  } catch (err) {
    return "שיחה חדשה";
  }
};

export const askGemini = async (
  prompt: string,
  history: Message[],
  attachments: Attachment[],
  categoryContext: Conversation[],
  onChunk?: (text: string) => void,
  abortSignal?: AbortSignal
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("KEY_NOT_FOUND");

  const ai = new GoogleGenAI({ apiKey });
  
  // Build a summary of "Category Memory"
  const categoryMemory = categoryContext.length > 0 
    ? "הקשר משיחות קודמות בקטגוריה זו (לצורך עקביות):\n" + categoryContext.map(c => {
        const botMsgs = c.messages.filter(m => m.role === 'model');
        const lastAnswer = botMsgs.length > 0 ? botMsgs[botMsgs.length - 1].text.slice(0, 200) + '...' : 'אין תוכן';
        return `* נושא: ${c.title}. סיכום קודם: ${lastAnswer}`;
      }).join('\n')
    : "";

  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  const userParts: any[] = [
    { text: `${categoryMemory}\n\nשאלה נוכחית: ${prompt}` }
  ];

  attachments.forEach(att => {
    userParts.push({
      inlineData: { mimeType: att.mimeType, data: att.data }
    });
  });

  contents.push({ role: 'user', parts: userParts });

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 4000 } // PRO model with high reasoning for exams
      }
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      if (abortSignal?.aborted) throw new Error("הופסק על ידי המשתמש");
      const text = chunk.text || "";
      fullText += text;
      if (onChunk) onChunk(fullText);
    }
    
    return fullText;
  } catch (error: any) {
    const msg = error.message?.toLowerCase() || "";
    if (msg.includes("api key") || msg.includes("not found") || msg.includes("invalid")) {
      throw new Error("KEY_NOT_FOUND");
    }
    throw error;
  }
};
