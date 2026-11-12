import { GoogleGenAI } from "@google/genai";
import {
  syllabusSchema,
  topicPlanSchema,
  type Syllabus,
  type TopicPlan,
} from "./schemas";

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
- Put each topic as its own separate item in the "topics" array, for example
  ["Binary search trees", "Balanced trees (AVL, red-black)"]. Never combine
  several topics into one string, and never start an item with a week range
  like "Weeks 8-12:".
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
        httpOptions: { timeout: 90000 }, // give up on one attempt after 90s
      },
    })
  );

  const json = JSON.parse(response.text ?? "");
  return syllabusSchema.parse(json); // throws if the AI's output is malformed
}

export async function planTopics(input: {
  course: string;
  title: string;
  type: string;
  date: string;
  topics: string[];
  weight?: string | null;
}): Promise<TopicPlan> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `You are helping a college student prepare for a ${input.type}.
Course: ${input.course}
${input.type}: ${input.title} (${input.date})${input.weight ? `\nWorth: ${input.weight}` : ""}

Topics covered:
${input.topics.map((t) => `- ${t}`).join("\n")}

For each topic, say how much study time it deserves relative to the others,
and give one short sentence on what to practice.

Return ONLY JSON in exactly this shape:
{
  "topics": [
    { "name": string, "weight": number from 1 (light review) to 5 (needs the most time), "focus": string }
  ]
}

Rules:
- Use every topic exactly once, with the name copied exactly as written above.
- Do not add topics that are not in the list.
- Harder or more foundational topics get higher weights.`;

  const response = await withRetry((model) =>
    ai.models.generateContent({
      model,
      contents: [{ text: prompt }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
        httpOptions: { timeout: 60000 },
      },
    })
  );

  return topicPlanSchema.parse(JSON.parse(response.text ?? ""));
}