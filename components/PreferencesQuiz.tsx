"use client";

import { useState } from "react";
import {
  DAYS,
  TIME_RANGES,
  emptyAvailability,
  formatHour,
  formatTimeframe,
  generateTimeframes,
  type Day,
  type StudyPreferences,
  type TimeOfDay,
  type Timeframe,
} from "@/lib/preferences";

const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6];
const TOTAL_STEPS = DAYS.length + 2; // questions + 7 days + finish screen

function sameFrame(a: Timeframe, b: Timeframe) {
  return a.start === b.start && a.end === b.end;
}

function noneSkipped(): Record<Day, boolean> {
  return {
    Monday: false,
    Tuesday: false,
    Wednesday: false,
    Thursday: false,
    Friday: false,
    Saturday: false,
    Sunday: false,
  };
}

const optionClass = (selected: boolean) =>
  `w-full rounded-lg border px-4 py-2.5 text-left text-sm transition ${
    selected
      ? "border-blue-600 bg-blue-50 text-blue-700"
      : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
  }`;

export default function PreferencesQuiz({
  initial,
  onComplete,
  onDismiss,
}: {
  initial?: StudyPreferences | null;
  onComplete: (prefs: StudyPreferences) => void;
  onDismiss?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [hours, setHours] = useState<number | null>(
    initial?.hoursPerDay ?? null
  );
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay | null>(
    initial?.timeOfDay ?? null
  );
  const [availability, setAvailability] = useState<Record<Day, Timeframe[]>>(
    initial?.availability ?? emptyAvailability()
  );
  const [skipped, setSkipped] = useState<Record<Day, boolean>>(() => {
    const s = noneSkipped();
    if (initial) {
      for (const d of DAYS) s[d] = initial.availability[d].length === 0;
    }
    return s;
  });

  const currentDay: Day | null = step >= 1 && step <= DAYS.length ? DAYS[step - 1] : null;
  const frames =
    hours !== null && timeOfDay !== null
      ? generateTimeframes(hours, timeOfDay)
      : [];

  function resetDays() {
    setAvailability(emptyAvailability());
    setSkipped(noneSkipped());
  }

  function chooseHours(h: number) {
    if (h !== hours) resetDays(); // old timeframes no longer match
    setHours(h);
  }

  function chooseTime(t: TimeOfDay) {
    if (t !== timeOfDay) resetDays();
    setTimeOfDay(t);
  }

  function toggleFrame(day: Day, frame: Timeframe) {
    setSkipped((p) => ({ ...p, [day]: false }));
    setAvailability((p) => {
      const cur = p[day];
      const next = cur.some((f) => sameFrame(f, frame))
        ? cur.filter((f) => !sameFrame(f, frame))
        : [...cur, frame].sort((a, b) => a.start - b.start);
      return { ...p, [day]: next };
    });
  }

  function toggleNone(day: Day) {
    if (skipped[day]) {
      setSkipped((p) => ({ ...p, [day]: false }));
    } else {
      setSkipped((p) => ({ ...p, [day]: true }));
      setAvailability((p) => ({ ...p, [day]: [] }));
    }
  }

  const canNext =
    step === 0
      ? hours !== null && timeOfDay !== null
      : currentDay
        ? skipped[currentDay] || availability[currentDay].length > 0
        : true;

  function finish() {
    if (hours === null || timeOfDay === null) return;
    onComplete({ hoursPerDay: hours, timeOfDay, availability });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg space-y-5 rounded-xl bg-white p-6 text-gray-900 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Step {step + 1} of {TOTAL_STEPS}
          </p>
          {onDismiss && (
            <button
              aria-label="Close"
              className="rounded p-1 text-gray-500 hover:bg-gray-100"
              onClick={onDismiss}
            >
              ✕
            </button>
          )}
        </div>

        {/* Step 0: hours and time of day */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 font-semibold">
                How many hours would you like to study per day?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {HOUR_OPTIONS.map((h) => (
                  <button
                    key={h}
                    className={optionClass(hours === h)}
                    onClick={() => chooseHours(h)}
                  >
                    {h} {h === 1 ? "hour" : "hours"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 font-semibold">
                When do you prefer to study?
              </p>
              <div className="space-y-2">
                {(Object.keys(TIME_RANGES) as TimeOfDay[]).map((t) => (
                  <button
                    key={t}
                    className={optionClass(timeOfDay === t)}
                    onClick={() => chooseTime(t)}
                  >
                    {TIME_RANGES[t].label}{" "}
                    <span className="text-gray-500">
                      ({formatHour(TIME_RANGES[t].start)} –{" "}
                      {formatHour(TIME_RANGES[t].end)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Steps 1-7: one screen per day */}
        {currentDay && (
          <div className="space-y-3">
            <div>
              <p className="text-xl font-semibold">{currentDay}</p>
              <p className="text-sm text-gray-600">
                {step === 1
                  ? "Great! Please select the timeframes you'd like to study, then press Next."
                  : "Select the timeframes you'd like to study."}
              </p>
            </div>
            <div className="space-y-2">
              {frames.map((f) => (
                <button
                  key={`${f.start}-${f.end}`}
                  className={optionClass(
                    availability[currentDay].some((x) => sameFrame(x, f))
                  )}
                  onClick={() => toggleFrame(currentDay, f)}
                >
                  {formatTimeframe(f)}
                </button>
              ))}
              <button
                className={optionClass(skipped[currentDay])}
                onClick={() => toggleNone(currentDay)}
              >
                None (no studying on {currentDay})
              </button>
            </div>
          </div>
        )}

        {/* Final screen */}
        {step === TOTAL_STEPS - 1 && (
          <div className="space-y-2 py-4 text-center">
            <p className="text-xl font-semibold">
              Great! Begin uploading key dates now.
            </p>
            <p className="text-sm text-gray-600">
              Your study preferences are saved. You can change them any time
              from the sidebar.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:invisible"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </button>

          {step < TOTAL_STEPS - 1 ? (
            <button
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-300"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </button>
          ) : (
            <button
              className="rounded-lg bg-green-600 px-5 py-2 text-sm text-white hover:bg-green-700"
              onClick={finish}
            >
              Go to calendar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}