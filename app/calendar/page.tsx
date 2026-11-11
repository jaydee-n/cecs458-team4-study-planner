import { Suspense } from "react";
import Calendar from "@/components/Calendar";

export default function CalendarPage() {
  return (
    <main className="min-h-screen">
      <h1 className="p-4 text-3xl font-bold">My Calendar</h1>
      <Suspense fallback={<div className="p-4">Loading calendar...</div>}>
        <Calendar />
      </Suspense>
    </main>
  );
}