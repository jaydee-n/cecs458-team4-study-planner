"use client";

import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import themePlugin from "@fullcalendar/react/themes/classic";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import interactionPlugin from "@fullcalendar/react/interaction";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";

import SyllabusUpload from "./SyllabusUpload";
import PreferencesQuiz from "./PreferencesQuiz";
import type { Syllabus } from "@/lib/schemas";
import {
    TIME_RANGES,
    formatHour,
    type StudyPreferences,
} from "@/lib/preferences";
import {
    buildSchedule,
    fallbackTopics,
    splitTopics,
    type PlanTopic,
} from "@/lib/scheduler";

type StudyEvent = {
    id: string;
    fileId: string;
    course: string;
    title: string;
    type: string;
    date: string;
    topics: string[];
    weight?: string | null;
    // Only set on generated study sessions:
    startHour?: number;
    endHour?: number;
    forEventId?: string;
    note?: string;
};

type UploadedFile = {
    id: string;
    name: string;
    course: string;
    eventCount: number;
};

const COLORS: Record<string, string> = {
    exam: "#dc2626",
    quiz: "#ea580c",
    assignment: "#d97706",
    project: "#7c3aed",
    study: "#2563eb", // blue
    other: "#6b7280", // gray
};

const LABELS: Record<string, string> = {
    exam: "Exam",
    quiz: "Quiz",
    assignment: "Assignment",
    project: "Project",
    study: "Study session",
    other: "Other",
};

const STUDY_PLAN_TYPES = ["exam", "quiz"];

const pad = (n: number) => String(n).padStart(2, "0");

function timeText(e: StudyEvent) {
    if (e.startHour === undefined || e.endHour === undefined) return "";
    return `${formatHour(e.startHour)} – ${formatHour(e.endHour)}`;
}

export default function Calendar() {
    const [mounted, setMounted] = useState(false);
    const [events, setEvents] = useState<StudyEvent[]>([]);
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hovered, setHovered] = useState<{
        id: string;
        x: number;
        y: number;
    } | null>(null);
    const [prefs, setPrefs] = useState<StudyPreferences | null>(null);
    const [showQuiz, setShowQuiz] = useState(false);
    const [planning, setPlanning] = useState(false);
    const [planMessage, setPlanMessage] = useState<string | null>(null);

    const selected = events.find((e) => e.id === selectedId) ?? null;
    const hoveredEvent = events.find((e) => e.id === hovered?.id) ?? null;
    const hasPlan =
        selected !== null && events.some((e) => e.forEventId === selected.id);

    // FullCalendar reads the current time, so only render it in the browser.
    // Also load saved study preferences; if there are none, show the quiz.
    useEffect(() => {
        setMounted(true);
        setShowQuiz(true);
    }, []);

    // Close the popup with the Escape key.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setSelectedId(null);
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    function handleQuizComplete(p: StudyPreferences) {
        setPrefs(p);
        setShowQuiz(false);
    }

    function handleExtracted(s: Syllabus, fileName: string) {
        const stamp = Date.now();
        const fileId = `file-${stamp}`;

        const newEvents: StudyEvent[] = s.events.map((e, i) => ({
            id: `${stamp}-${i}`,
            fileId,
            course: s.courseName,
            title: e.title,
            type: e.type,
            date: e.date,
            topics: splitTopics(e.topics),
            weight: e.weight,
        }));

        setEvents((prev) => [...prev, ...newEvents]);
        setFiles((prev) => [
            ...prev,
            {
                id: fileId,
                name: fileName,
                course: s.courseName,
                eventCount: newEvents.length,
            },
        ]);
    }

    function removeFile(fileId: string) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        // Also removes any study sessions generated for that file's events.
        setEvents((prev) => prev.filter((e) => e.fileId !== fileId));
        setHovered(null);
    }

    async function handleBuildPlan(ev: StudyEvent) {
        if (!prefs) {
            setSelectedId(null);
            setShowQuiz(true);
            return;
        }

        setPlanning(true);
        setPlanMessage(null);

        // Make sure every topic is its own item, even for older events.
        const topicList = splitTopics(ev.topics);

        // Ask the AI for a focus tip per topic; fall back to plain topics.
        let topics: PlanTopic[] = fallbackTopics(topicList, ev.title);
        try {
            const res = await fetch("/api/build-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    course: ev.course,
                    title: ev.title,
                    type: ev.type,
                    date: ev.date,
                    topics: topicList,
                    weight: ev.weight ?? null,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.topics) && data.topics.length > 0) {
                    topics = data.topics;
                }
            }
        } catch {
            // keep the fallback topics
        }

        const sessions = buildSchedule({
            examDate: ev.date,
            type: ev.type,
            topics,
            prefs,
        });

        setPlanning(false);

        if (sessions.length === 0) {
            setPlanMessage(
                "No study time is available before this date. Try editing your study preferences to add more timeframes."
            );
            return;
        }

        const stamp = Date.now();
        const planEvents: StudyEvent[] = sessions.map((s, i) => ({
            id: `plan-${ev.id}-${stamp}-${i}`,
            fileId: ev.fileId,
            course: ev.course,
            title: s.isReview
                ? `Final review: ${ev.title}`
                : `Study: ${s.topics.join(", ")}`,
            type: "study",
            date: s.date,
            topics: s.topics,
            startHour: s.start,
            endHour: s.end,
            forEventId: ev.id,
            note: s.note,
        }));

        // Replace any earlier plan for this event.
        setEvents((prev) => [
            ...prev.filter((e) => e.forEventId !== ev.id),
            ...planEvents,
        ]);
        setSelectedId(null);
    }

    const calendarEvents = events.map((e) => {
        const base = {
            id: e.id,
            title: e.type === "study" ? e.title : `${e.course}: ${e.title}`,
            color: COLORS[e.type] ?? COLORS.other,
        };
        if (e.startHour !== undefined && e.endHour !== undefined) {
            return {
                ...base,
                allDay: false,
                start: `${e.date}T${pad(e.startHour)}:00:00`,
                end:
                    e.endHour >= 24
                        ? `${e.date}T23:59:00`
                        : `${e.date}T${pad(e.endHour)}:00:00`,
            };
        }
        return { ...base, allDay: true, start: e.date };
    });

    return (
        <div className="w-full p-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                {/* Calendar (3/4) */}
                <div className="min-w-0 lg:col-span-3">
                    {/* Legend */}
                    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
                        {Object.keys(COLORS).map((type) => (
                            <div
                                key={type}
                                className="flex items-center gap-2 text-sm text-gray-700"
                            >
                                <span
                                    className="inline-block h-3 w-3 rounded-sm"
                                    style={{ backgroundColor: COLORS[type] }}
                                />
                                {LABELS[type]}
                            </div>
                        ))}
                    </div>

                    {mounted ? (
                        <FullCalendar
                            colorScheme="light"
                            plugins={[
                                themePlugin,
                                dayGridPlugin,
                                timeGridPlugin,
                                interactionPlugin,
                            ]}
                            initialView="dayGridMonth"
                            headerToolbar={{
                                left: "prev,next today",
                                center: "title",
                                right: "dayGridMonth,timeGridWeek",
                            }}
                            events={calendarEvents}
                            height={700}
                            slotDuration="01:00:00"
                            slotMinTime="06:00:00"
                            slotMaxTime="24:00:00"
                            nowIndicator
                            eventClick={(info) => {
                                setPlanMessage(null);
                                setSelectedId(info.event.id);
                            }}
                            eventMouseEnter={(info) => {
                                info.el.style.cursor = "pointer";
                                info.el.style.filter = "brightness(1.15)";
                                setHovered({
                                    id: info.event.id,
                                    x: info.jsEvent.clientX,
                                    y: info.jsEvent.clientY,
                                });
                            }}
                            eventMouseLeave={(info) => {
                                info.el.style.filter = "";
                                setHovered(null);
                            }}
                        />
                    ) : (
                        <div className="h-[700px] rounded-lg border" />
                    )}
                </div>

                {/* Uploaded files sidebar (1/4) */}
                <aside className="rounded-lg border p-4 text-gray-900 lg:col-span-1">
                    <p className="mb-3 font-semibold">Uploaded files</p>

                    <div className="mb-4">
                        <SyllabusUpload onExtracted={handleExtracted} />
                    </div>

                    {files.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            No files yet. Upload a syllabus to get started.
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {files.map((f) => (
                                <li key={f.id} className="rounded-lg border p-3">
                                    <p className="break-words text-sm font-medium">{f.name}</p>
                                    <p className="text-xs text-gray-600">{f.course}</p>
                                    <p className="text-xs text-gray-600">
                                        {f.eventCount} event{f.eventCount === 1 ? "" : "s"} found
                                    </p>
                                    <button
                                        className="mt-2 text-xs text-red-600 hover:underline"
                                        onClick={() => removeFile(f.id)}
                                    >
                                        Remove
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Study preferences summary */}
                    {prefs && (
                        <div className="mt-5 border-t pt-4">
                            <p className="text-sm font-medium">Study preferences</p>
                            <p className="text-xs text-gray-600">
                                {prefs.hoursPerDay} {prefs.hoursPerDay === 1 ? "hour" : "hours"}{" "}
                                per day · {TIME_RANGES[prefs.timeOfDay].label}
                            </p>
                            <button
                                className="mt-2 text-xs text-blue-600 hover:underline"
                                onClick={() => setShowQuiz(true)}
                            >
                                Edit
                            </button>
                        </div>
                    )}
                </aside>
            </div>

            {/* Hover tooltip */}
            {hoveredEvent && hovered && !selected && (
                <div
                    className="pointer-events-none fixed z-40 max-w-xs rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
                    style={{ left: hovered.x + 12, top: hovered.y + 12 }}
                >
                    <p className="font-semibold">{hoveredEvent.title}</p>
                    <p className="text-gray-300">
                        {hoveredEvent.course} ·{" "}
                        {LABELS[hoveredEvent.type] ?? hoveredEvent.type}
                    </p>
                    <p className="text-gray-300">
                        {hoveredEvent.date}
                        {timeText(hoveredEvent) ? ` · ${timeText(hoveredEvent)}` : ""}
                        {hoveredEvent.weight ? ` · ${hoveredEvent.weight}` : ""}
                    </p>
                    {hoveredEvent.topics.length > 0 && (
                        <p className="mt-1 text-gray-400">
                            {hoveredEvent.topics.length} topic
                            {hoveredEvent.topics.length === 1 ? "" : "s"} · click for details
                        </p>
                    )}
                </div>
            )}

            {/* Event details popup */}
            {selected && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    style={{ animation: "fadeIn 150ms ease-out" }}
                    onClick={() => setSelectedId(null)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 text-gray-900 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-lg font-semibold">{selected.title}</p>
                                <p className="text-sm text-gray-600">
                                    {selected.course} ·{" "}
                                    {LABELS[selected.type] ?? selected.type} · {selected.date}
                                    {timeText(selected) ? ` · ${timeText(selected)}` : ""}
                                    {selected.weight ? ` · ${selected.weight}` : ""}
                                </p>
                            </div>
                            <button
                                aria-label="Close"
                                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                                onClick={() => setSelectedId(null)}
                            >
                                ✕
                            </button>
                        </div>

                        {selected.topics.length > 0 && (
                            <div>
                                <p className="text-sm font-medium">
                                    {selected.type === "study" ? "Topics to study" : "Likely topics"}
                                </p>
                                <ul className="list-disc pl-5 text-sm text-gray-700">
                                    {selected.topics.map((t, i) => (
                                        <li key={i}>{t}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {selected.note && (
                            <div>
                                <p className="text-sm font-medium">Focus</p>
                                <p className="text-sm text-gray-700">{selected.note}</p>
                            </div>
                        )}

                        {STUDY_PLAN_TYPES.includes(selected.type) && (
                            <div className="space-y-2">
                                <button
                                    className="w-full rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
                                    disabled={planning}
                                    onClick={() => handleBuildPlan(selected)}
                                >
                                    {planning
                                        ? "Building plan..."
                                        : hasPlan
                                            ? "Rebuild Study Plan"
                                            : "Build Study Plan"}
                                </button>
                                {planMessage && (
                                    <p className="text-sm text-red-600">{planMessage}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Study preferences quiz */}
            {showQuiz && (
                <PreferencesQuiz
                    initial={prefs}
                    onComplete={handleQuizComplete}
                    onDismiss={prefs ? () => setShowQuiz(false) : undefined}
                />
            )}
        </div>
    );
}