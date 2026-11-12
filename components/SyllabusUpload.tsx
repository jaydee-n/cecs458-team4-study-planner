"use client";

import { useState } from "react";
import type { Syllabus } from "@/lib/schemas";

export default function SyllabusUpload({
    onExtracted,
}: {
    onExtracted: (s: Syllabus, fileName: string) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);
        try {
            const body = new FormData();
            body.append("file", file);
            const res = await fetch("/api/extract-syllabus", { method: "POST", body });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Upload failed.");
            onExtracted(data, file.name);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setLoading(false);
            e.target.value = "";
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <label
                className={`block cursor-pointer rounded-lg px-4 py-2.5 text-center text-white ${loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
                    }`}
            >
                {loading ? "Reading syllabus..." : "Upload Documents"}
                <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={loading}
                    onChange={handleChange}
                />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    );
}