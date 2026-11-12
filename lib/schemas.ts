import { z } from "zod";

export const syllabusSchema = z.object({
  courseName: z.string(),
  events: z.array(
    z.object({
      title: z.string(),
      type: z.enum(["exam", "quiz", "assignment", "project", "other"]),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
      topics: z
        .array(z.string())
        .nullish()
        .transform((t) => t ?? []),
      weight: z.string().nullish(), // e.g. "20% of grade"
    })
  ),
});

export type Syllabus = z.infer<typeof syllabusSchema>;

export const topicPlanSchema = z.object({
  topics: z.array(
    z.object({
      name: z.string(),
      weight: z.number().transform((n) => Math.min(5, Math.max(1, n))),
      focus: z
        .string()
        .nullish()
        .transform((f) => f ?? ""),
    })
  ),
});

export type TopicPlan = z.infer<typeof topicPlanSchema>;