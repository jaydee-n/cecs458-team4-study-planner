import { GoogleGenAI } from "@google/genai";
import { syllabusSchema, type Syllabus } from "./schemas";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL; // optional

function isOverloaded(err: unknown) {
  const status = (err as { status?: number })?.status;
  const msg = err instanceof Error ? err.message : String(err);
  return status === 503 || msg.includes("UNAVAILABLE");
}

// Retries when Google is overloaded, then tries the fallback model if set.
async function withRetry<T>(call: (model: string) => Promise<T>): Promise<T> {
  const models = [MODEL, ...(FALLBACK_MODEL ? [FALLBACK_MODEL] : [])];
  let lastErr: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[extract] model=${model} attempt=${attempt + 1}`);
        return await call(model);
      } catch (err) {
        console.log(
          `[extract] failed: ${err instanceof Error ? err.message.slice(0, 200) : err}`
        );
        lastErr = err;
        if (!isOverloaded(err)) throw err; // only retry overload errors
        await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt)); // 1.5s, 3s, 6s
      }
    }
  }
  throw lastErr;
}

export async function extractSyllabus(pdfBase64: string): Promise<Syllabus> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const today = new Date().toISOString().slice(0, 10);

  const prompt = `You are reading a college course syllabus. Extract the graded
events and what each one covers.

Return ONLY JSON in exactly this shape:
{
  "courseName": string,
  "events": [
    {
      "title": string,
      "type": "exam" | "quiz" | "assignment" | "project" | "other",
      "date": "YYYY-MM-DD",
      "topics": string[],
      "weight": string or null
    }
  ]
}

Rules:
- Today's date is ${today}. If the syllabus gives a date without a year,
  choose the year that makes the date the next upcoming occurrence.
- Only include events that have a specific date. Skip anything undated.
- For exams and quizzes, "topics" should list the likely topics covered, based on
  the course schedule up to that date (weekly topics, chapters, lectures).
- For assignments and projects, "topics" can be a short list of what it involves.
- "weight" is the grade percentage if stated, otherwise null.
- Do not invent events or dates that are not in the document.`;

  const response = await withRetry((model) =>
    ai.models.generateContent({
      model,
      contents: [
        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        { text: prompt },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
        httpOptions: { timeout: 40000 }, // give up on one attempt after 40s
      },
    })
  );

  const json = JSON.parse(response.text ?? "");
  return syllabusSchema.parse(json); // throws if the AI's output is malformed
}