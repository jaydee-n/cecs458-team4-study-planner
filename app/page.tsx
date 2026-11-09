export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">AI Study Planner</h1>
      <p className="text-gray-600">Upload your syllabus. Get a study plan.</p>
      <button className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700">
        Get Started
      </button>
    </main>
  );
}