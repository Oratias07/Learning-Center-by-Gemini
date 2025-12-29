
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { Attachment, Message } from "../types";

const SYSTEM_INSTRUCTION = `
אתה עוזר לימודים אינטליגנטי ומקצועי בעברית, בסגנון Gemini.
תפקידך לענות על שאלות המשתמש אך ורק על סמך חומרי הלימוד שסופקו לך.

הנחיות קריטיות למבנה התשובה:
1. סגנון כתיבה: כתוב בצורה זורמת, טבעית ואינטליגנטית. הימנע לחלוטין ממיספור רובוטי כמו "### 1" או "סעיף 1". השתמש בכותרות מודגשות במידת הצורך ובפסקאות קריאות.
2. מתמטיקה ונוסחאות: כל נוסחה או ביטוי מתמטי חייבים להיכתב בתוך סימני דולר ($...$). כל הביטויים חייבים להיות בשורה אחת.
3. הפניות: חובה להוסיף הפניה מדויקת לכל טענה. הפורמט חייב להיות: [שם_הקובץ.סיומת, עמ' X]. אם אין מספר עמוד, ציין רק את שם הקובץ.
4. שפה: עברית רהוטה בלבד.
5. בדיקת סיום: וודא שהתשובה מלאה, מסתיימת בנקודה, ואינה נקטעת באמצע.
`;

const REFINER_PROMPT = `
תפקידך הוא "עורך לשוני" עבור תשובה של בינה מלאכותית בעברית.
קרא את הטקסט הבא ושפר אותו לפי הכללים:
1. הפוך את הניסוח ליותר "אנושי" ופחות "רובוטי".
2. הסר רשימות ממוספרות כבדות (כמו 1, 2, 3) והחלף אותן בזרימה טקסטואלית או נקודות (bullets) במידה וזה נדרש.
3. וודא שכל הפניות הקבצים בסוגריים מרובעים נשמרות בדיוק כפי שהן.
4. וודא שכל הביטויים המתמטיים ($...$) נשמרים.
5. החזר אך ורק את הטקסט המשופר.

הטקסט לעריכה:
`;

export const validateHebrew = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: REFINER_PROMPT + text }] }],
    config: { temperature: 0.1 }
  });
  return response.text || text;
};

export const generateTitle = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: `צור כותרת קצרה מאוד (עד 4 מילים) בעברית עבור השאלה: "${text}". אל תשתמש בסימני כוכביות או הדגשה בכלל.` }] }],
    config: { temperature: 0.1 }
  });
  // Clean up any remaining asterisks or quotes
  return response.text?.replace(/[*"]/g, '').trim() || "שיחה חדשה";
};

export const askGemini = async (
  prompt: string,
  history: Message[],
  attachments: Attachment[],
  onChunk?: (text: string) => void,
  abortSignal?: AbortSignal
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
    
    const refinedText = await validateHebrew(fullText);
    return refinedText;
  } catch (error: any) {
    if (error.message?.includes("הופסקה") || abortSignal?.aborted) throw new Error("הופסקה");
    throw new Error("נכשלה התקשורת עם ה-AI.");
  }
};
