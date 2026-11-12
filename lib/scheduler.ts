import type { Day, StudyPreferences } from "./preferences";

export type PlanTopic = { name: string; weight: number; focus?: string };

export type PlannedSession = {
    date: string; // YYYY-MM-DD
    start: number; // 24-hour clock
    end: number;
    topics: string[];
    note?: string;
    isReview?: boolean;
};

// How many days before the date studying starts.
const LEAD_DAYS: Record<string, number> = { exam: 14, quiz: 7 };

// true: harder topics get more sessions. false: every topic gets the same number.
const USE_WEIGHTS = false;

// false: study topics in syllabus order (all of topic 1, then topic 2, ...).
// true: rotate through the topics (1, 2, 3, 1, 2, 3, ...).
const INTERLEAVE = false;

const WEEKDAYS: Day[] = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

const pad = (n: number) => String(n).padStart(2, "0");

function toISO(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(s: string) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Turns "Weeks 8-12: binary search trees, balanced trees (AVL, red-black), BFS and DFS"
// into separate topics. Commas inside parentheses stay with their topic.
export function splitTopics(topics: string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();

    for (const raw of topics) {
        // Drop a leading label like "Weeks 8-12:" or "Week 3:".
        const text = raw.replace(
            /^\s*(?:weeks?|wks?)\s*\d+(?:\s*(?:-|–|to|,|&|and)\s*\d+)*\s*:\s*/i,
            ""
        );

        const parts: string[] = [];
        let current = "";
        let depth = 0;
        for (const ch of text) {
            if (ch === "(") depth++;
            if (ch === ")") depth = Math.max(0, depth - 1);
            if ((ch === "," || ch === ";") && depth === 0) {
                parts.push(current);
                current = "";
            } else {
                current += ch;
            }
        }
        parts.push(current);

        for (const p of parts) {
            const t = p.trim().replace(/\.$/, "").replace(/^and\s+/i, "");
            if (!t) continue;
            const key = t.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(t.charAt(0).toUpperCase() + t.slice(1));
        }
    }
    return out;
}

export function fallbackTopics(topics: string[], title: string): PlanTopic[] {
    if (topics.length === 0) return [{ name: `Review for ${title}`, weight: 3 }];
    return topics.map((name) => ({ name, weight: 3 }));
}

// Splits `slotCount` sessions across topics, giving every topic at least one.
function allocateCounts(topics: PlanTopic[], slotCount: number): number[] {
    const counts = topics.map(() => 1);
    const extra = slotCount - topics.length;
    if (extra <= 0) return counts;

    const weights = topics.map((t) => (USE_WEIGHTS ? Math.max(1, t.weight) : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    const ideal = weights.map((w) => (extra * w) / total);

    let left = extra;
    ideal.forEach((x, i) => {
        counts[i] += Math.floor(x);
        left -= Math.floor(x);
    });

    const byRemainder = ideal
        .map((x, i) => ({ i, r: x - Math.floor(x) }))
        .sort((a, b) => b.r - a.r);
    for (let k = 0; left > 0; left--, k = (k + 1) % byRemainder.length) {
        counts[byRemainder[k].i]++;
    }
    return counts;
}

export function buildSchedule(opts: {
    examDate: string;
    type: string;
    topics: PlanTopic[];
    prefs: StudyPreferences;
    now?: Date;
}): PlannedSession[] {
    const { examDate, type, topics, prefs } = opts;
    const now = opts.now ?? new Date();
    const exam = parseDate(examDate);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const earliest = addDays(exam, -(LEAD_DAYS[type] ?? 7));
    const first = earliest > today ? earliest : today;
    const earliestHourToday = Math.ceil(now.getHours() + now.getMinutes() / 60);

    // 1. Every open slot from the start date up to the day before the exam.
    const slots: { date: string; start: number; end: number }[] = [];
    for (let d = first; d < exam; d = addDays(d, 1)) {
        const frames = prefs.availability[WEEKDAYS[d.getDay()]] ?? [];
        for (const f of frames) {
            if (d.getTime() === today.getTime() && f.start < earliestHourToday) {
                continue; // already passed today
            }
            slots.push({ date: toISO(d), start: f.start, end: f.end });
        }
    }
    if (slots.length === 0 || topics.length === 0) return [];

    // 2. Keep the last slot for a final review when there's enough room.
    const reserveReview = slots.length >= 3;
    const studySlots = reserveReview ? slots.slice(0, -1) : slots;
    const reviewSlot = reserveReview ? slots[slots.length - 1] : null;

    const sessions: PlannedSession[] = [];

    if (studySlots.length < topics.length) {
        // Fewer slots than topics: group topics into the same session.
        const T = topics.length;
        const S = studySlots.length;
        studySlots.forEach((slot, i) => {
            const group = topics.slice(
                Math.floor((i * T) / S),
                Math.floor(((i + 1) * T) / S)
            );
            sessions.push({
                ...slot,
                topics: group.map((t) => t.name),
                note: group
                    .map((t) => t.focus)
                    .filter(Boolean)
                    .join(" "),
            });
        });
    } else {
        // 3. Give each topic an equal number of sessions, then lay them out in order.
        const counts = allocateCounts(topics, studySlots.length);
        const order: number[] = [];

        if (INTERLEAVE) {
            const assigned = topics.map(() => 0);
            for (let k = 0; k < studySlots.length; k++) {
                let best = -1;
                let bestScore = Infinity;
                topics.forEach((_, i) => {
                    if (assigned[i] >= counts[i]) return;
                    const score = (assigned[i] + 0.5) / counts[i];
                    if (score < bestScore) {
                        bestScore = score;
                        best = i;
                    }
                });
                assigned[best]++;
                order.push(best);
            }
        } else {
            counts.forEach((c, i) => {
                for (let k = 0; k < c; k++) order.push(i);
            });
        }

        studySlots.forEach((slot, k) => {
            const t = topics[order[k]];
            sessions.push({ ...slot, topics: [t.name], note: t.focus });
        });
    }

    if (reviewSlot) {
        sessions.push({
            ...reviewSlot,
            topics: topics.map((t) => t.name),
            note: "Go back over everything, starting with the topics you feel least sure about.",
            isReview: true,
        });
    }

    return sessions;
}