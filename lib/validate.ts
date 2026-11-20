import type { Day, StudyPreferences } from "./preferences";
import type { PlannedSession } from "./scheduler";

export type PlanCheck = { ok: boolean; issues: string[] };

const WEEKDAYS: Day[] = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

function weekdayOf(date: string): Day {
    const [y, m, d] = date.split("-").map(Number);
    return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

// Checks a finished plan: every session must be before the deadline, inside the
// student's availability for that weekday, and must not overlap another session.
export function validatePlan(
    sessions: PlannedSession[],
    opts: { examDate: string; prefs: StudyPreferences}
): PlanCheck {
    const issues: string[] = [];
    
    for (const s of sessions) {
        const label = `${s.date} ${s.start}:00-${s.end}:00`;

        if (s.date >= opts.examDate) {
            issues.push(`Session ${label} is not before the ${opts.examDate} deadline.`);
        }

        const day = weekdayOf(s.date);
        const windows = opts.prefs.availability[day] ?? [];
        const inside = windows.some((w) => s.start >= w.start && s.end <= w.end);
        if (!inside) {
            issues.push(`Session ${label} is outside your available hours on ${day}.`);
        }
    }

    // Overlaps: on each day, a session must not start before the previous one ends.
    const sorted = [...sessions].sort((a, b) =>
        a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1
    );
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (prev.date === cur.date && cur.start < prev.end) {
            issues.push(`Sessions on ${cur.date} overlap.`);
        }
    }

    return { ok: issues.length === 0, issues };
}