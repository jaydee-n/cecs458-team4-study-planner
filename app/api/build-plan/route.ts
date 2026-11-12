import { NextResponse } from "next/server";
import { z } from "zod";
import { planTopics } from "@/lib/llm";

const inputSchema = z.object({
  course: z.string(),
  title: z.string(),
  type: z.string(),
  date: z.string(),
  topics: z.array(z.string()),
  weight: z.string().nullish(),
});

export async function POST(req: Request) {
  let input: z.infer<typeof inputSchema>;
  try {
    input = inputSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Equal weights, used whenever the AI can't help.
  const fallback = input.topics.map((name) => ({ name, weight: 3, focus: "" }));

  if (!process.env.GEMINI_API_KEY || input.topics.length === 0) {
    return NextResponse.json({ topics: fallback, source: "fallback" });
  }

  try {
    const plan = await planTopics(input);
    const byName = new Map(
      plan.topics.map((t) => [t.name.trim().toLowerCase(), t])
    );
    // Keep the original topic order and names; default any the AI skipped.
    const topics = input.topics.map((name) => {
      const match = byName.get(name.trim().toLowerCase());
      return match
        ? { name, weight: match.weight, focus: match.focus }
        : { name, weight: 3, focus: "" };
    });
    return NextResponse.json({ topics, source: "ai" });
  } catch (err) {
    console.error("Topic planning failed, using fallback:", err);
    return NextResponse.json({ topics: fallback, source: "fallback" });
  }
}