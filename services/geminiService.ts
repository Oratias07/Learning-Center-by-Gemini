
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { Attachment, Message, Conversation } from "../types";

const SYSTEM_INSTRUCTION = `
אתה עוזר לימודים אינטליגנטי ומקצועי בעברית, בסגנון Gemini.
תפקידך לענות על שאלות המשתמש אך ורק על סמך חומרי הלימוד שסופקו לך.

הנחיות קריטיות למבנה התשובה:
1. סגנון כתיבה: כתוב בצורה זורמת, טבעית ואינטליגנטית. הימנע לחלוטין ממיספור רובוטי או רשימות מוגזמות.
2. מתמטיקה: נוסחאות חובה בתוך סימני דולר ($...$).
3. הפניות: חובה להוסיף הפניה מדויקת בסוף כל פסקה רלוונטית: [שם_הקובץ.סיומת].
4. שפה: עברית רהוטה בלבד.
5. הקשר רחב: תקבל מידע משיחות קודמות בקטגוריה זו. השתמש בו כדי לשמור על עקביות ולהבין למה המשתמש מתכוון.
`;

export const validateHebrew = async (text: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return text;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
      model: 'gemini-3-flash-preview',
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
  
  // Create a summary of other conversations in the same category for better context
  const contextSummary = categoryContext.length > 0 
    ? "רקע משיחות קודמות בקטגוריה זו:\n" + categoryContext.map(c => {
        const lastMsg = c.messages.slice(-1)[0];
        return `- שיחה בנושא "${c.title}": ${lastMsg ? lastMsg.text.slice(0, 100) + '...' : 'אין הודעות'}`;
      }).join('\n')
    : "";

  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  const userParts: any[] = [
    { text: `${contextSummary}\n\nשאלה חדשה: ${prompt}` }
  ];

  // Add attachments as inline data
  attachments.forEach(att => {
    userParts.push({
      inlineData: {
        mimeType: att.mimeType,
        data: att.data
      }
    });
  });

  contents.push({ role: 'user', parts: userParts });

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3,
      }
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      if (abortSignal?.aborted) throw new Error("Aborted");
      const text = chunk.text || "";
      fullText += text;
      if (onChunk) onChunk(fullText);
    }
    
    return fullText;
  } catch (error: any) {
    const msg = error.message?.toLowerCase() || "";
    if (msg.includes("api key") || msg.includes("not found")) {
      throw new Error("KEY_NOT_FOUND");
    }
    throw error;
  }
};
