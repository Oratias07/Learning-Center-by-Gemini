
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { Attachment, Message } from "../types";

const SYSTEM_INSTRUCTION = `
אתה עוזר לימודים אינטליגנטי ומקצועי בעברית, בסגנון Gemini.
תפקידך לענות על שאלות המשתמש אך ורק על סמך חומרי הלימוד שסופקו לך.

הנחיות קריטיות למבנה התשובה:
1. סגנון כתיבה: כתוב בצורה זורמת, טבעית ואינטליגנטית. הימנע לחלוטין ממיספור רובוטי.
2. מתמטיקה: נוסחאות בתוך סימני דולר ($...$).
3. הפניות: חובה להוסיף הפניה מדויקת: [שם_הקובץ.סיומת, עמ' X].
4. שפה: עברית רהוטה בלבד.
`;

export const validateHebrew = async (text: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("KEY_NOT_FOUND");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: `שפר את העברית בטקסט הבא שיהיה טבעי וזורם, שמור על נוסחאות והפניות: ${text}` }] }],
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
  onChunk?: (text: string) => void,
  abortSignal?: AbortSignal
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("KEY_NOT_FOUND");

  const ai = new GoogleGenAI({ apiKey });
  
  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  const currentParts: any[] = [{ text: prompt }];
  attachments.forEach(att => {
    currentParts.push({
      inlineData: { mimeType: att.mimeType, data: att.data }
    });
  });

  contents.push({ role: 'user', parts: currentParts });

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
      }
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      if (abortSignal?.aborted) throw new Error("הפעולה הופסקה");
      const text = chunk.text || "";
      fullText += text;
      if (onChunk) onChunk(fullText);
    }
    
    return fullText;
  } catch (error: any) {
    const errorMsg = error.message?.toLowerCase() || "";
    if (errorMsg.includes("api key") || errorMsg.includes("not found") || errorMsg.includes("invalid")) {
      throw new Error("KEY_NOT_FOUND");
    }
    throw error;
  }
};
