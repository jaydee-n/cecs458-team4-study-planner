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
import type { Syllabus } from "@/lib/schemas";

type StudyEvent = {
  id: string;
  course: string;
  title: string;
  type: string;
  date: string;
  topics: string[];
  weight?: string | null;
};

const COLORS: Record<string, string> = {
  exam: "#dc2626",
  quiz: "#ea580c",
  assignment: "#d97706",
  project: "#7c3aed",
  other: "#2563eb",
};

export default function Calendar() {
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<StudyEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = events.find((e) => e.id === selectedId) ?? null;

  // FullCalendar reads the current time, so only render it in the browser.
  useEffect(() => setMounted(true), []);

  function handleExtracted(s: Syllabus) {
    const stamp = Date.now();
    const newEvents: StudyEvent[] = s.events.map((e, i) => ({
      id: `${stamp}-${i}`,
      course: s.courseName,
      title: e.title,
      type: e.type,
      date: e.date,
      topics: e.topics,
      weight: e.weight,
    }));
    setEvents((prev) => [...prev, ...newEvents]);
  }

  const calendarEvents = events.map((e) => ({
    id: e.id,
    title: `${e.course}: ${e.title}`,
    start: e.date,
    allDay: true,
    color: COLORS[e.type] ?? COLORS.other,
  }));

  return (
    <div className="w-full p-4">
      <div className="mb-4">
        <SyllabusUpload onExtracted={handleExtracted} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Calendar (3/4) */}
        <div className="min-w-0 lg:col-span-3">
          {mounted ? (
            <FullCalendar
              plugins={[themePlugin, dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "timeGridWeek,dayGridMonth",
              }}
              events={calendarEvents}
              height={600}
              slotMinTime="07:00:00"
              slotMaxTime="23:00:00"
              nowIndicator
              eventClick={(info) => setSelectedId(info.event.id)}
            />
          ) : (
            <div className="h-[600px] rounded-lg border" />
          )}
        </div>

        {/* Details panel (1/4) */}
        <aside className="rounded-lg border p-4 lg:col-span-1">
          {selected ? (
            <div className="space-y-3">
              <div>
                <p className="text-lg font-semibold">{selected.title}</p>
                <p className="text-sm text-gray-600">
                  {selected.course} · {selected.type} · {selected.date}
                  {selected.weight ? ` · ${selected.weight}` : ""}
                </p>
              </div>

              {selected.topics.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Likely topics</p>
                  <ul className="list-disc pl-5 text-sm text-gray-700">
                    {selected.topics.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.type === "exam" && (
                <button
                  className="w-full rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                  onClick={() => alert("Study plan generation coming next!")}
                >
                  Build Study Plan
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {events.length === 0
                ? "Upload a syllabus to see your events."
                : "Click an event to see its details."}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}