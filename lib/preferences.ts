export const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
] as const;

export type Day = (typeof DAYS)[number];
export type TimeOfDay = "morning" | "afternoon" | "night";

// Hours on a 24-hour clock, e.g. start: 13, end: 15 means 1 PM to 3 PM.
export type Timeframe = { start: number; end: number };

export type StudyPreferences = {
    hoursPerDay: number;
    timeOfDay: TimeOfDay;
    availability: Record<Day, Timeframe[]>; // empty array = no study that day
};

export const TIME_RANGES: Record<
    TimeOfDay,
    { label: string; start: number; end: number }
> = {
    morning: { label: "Morning", start: 6, end: 12 },
    afternoon: { label: "Afternoon", start: 12, end: 18 },
    night: { label: "Night", start: 18, end: 24 },
};

export function emptyAvailability(): Record<Day, Timeframe[]> {
    return {
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: [],
        Sunday: [],
    };
}

export function formatHour(h: number): string {
    const hour24 = h % 24;
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:00 ${suffix}`;
}

export function formatTimeframe(f: Timeframe): string {
    return `${formatHour(f.start)} – ${formatHour(f.end)}`;
}

// Blocks that are `hours` long, inside the chosen part of the day.
export function generateTimeframes(
    hours: number,
    timeOfDay: TimeOfDay
): Timeframe[] {
    const { start, end } = TIME_RANGES[timeOfDay];
    const frames: Timeframe[] = [];

    for (let s = start; s + hours <= end; s += hours) {
        frames.push({ start: s, end: s + hours });
    }

    // If a block doesn't fit evenly, add one more that ends at the window's end.
    const last = frames[frames.length - 1];
    if (!last || last.end < end) {
        const s = end - hours;
        if (s >= start && (!last || s > last.start)) {
            frames.push({ start: s, end });
        }
    }
    return frames;
}

const STORAGE_KEY = "studyPreferences";

export function loadPreferences(): StudyPreferences | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (
            typeof parsed?.hoursPerDay === "number" &&
            typeof parsed?.timeOfDay === "string" &&
            parsed?.availability
        ) {
            return parsed as StudyPreferences;
        }
        return null;
    } catch {
        return null;
    }
}

export function savePreferences(prefs: StudyPreferences) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
        // storage unavailable (private window, etc.); the app still works
    }
}