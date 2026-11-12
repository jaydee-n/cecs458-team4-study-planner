# CECS-458 Team 4 AI Assisted Study Planner
Educational study planner for personally curated schedules to meet your studying goals. Submit your studying preferences and key course documents to curate a personalized academic calendar to optimize study time for exams and quizzes.

## Getting Started

### 1. Prerequisites

- Node.js 20 or newer (check with `node -v`)
- Git

### 2. Clone and Install

```bash
git clone https://github.com/jaydee-n/cecs458-team4-study-planner.git
cd cecs458-team4-study-planner
npm install
```

### 3. Get your own Gemini API key

1. Go to https://aistudio.google.com and sign in with a Google account.
2. Click **Get API key**, then **Create API key**. Choose **Create API key in new project** so you get your own usage quota.
3. Copy the key.

### 4. Create your `.env.local` file

In the project root, create a file named `.env.local`. Then, paste your personal API key:

```
GEMINI_API_KEY=paste-your-key-here
```

The default model is Gemini 3.5 Flash Lite for testing purposes.

- No quotes and no spaces around the `=`.
- `.env.local` is git-ignored.
- Environment files are only read at startup, so restart `npm run dev` after changing it.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000 to view the prototype.

## Using the Application

1. Answer the preferences quiz that pops up on the calendar page. Submit your results, but this can be edited later on.
2. Click **Start Uploading Documents** in the sidebar and choose a syllabus PDF that includes key deadlines you'd like to meet.
3. Click an exam or quiz on the calendar and press **Build Study Plan**.

Study preferences, uploaded files, and events are held in memory only for testing purposes. Refreshing the page will clear them.

## Project Structure

```
app/
  page.tsx                      Home page
  calendar/page.tsx             Calendar page
  api/extract-syllabus/route.ts Gemini implementation to read syllabus PDF
  api/build-plan/route.ts       Adds focus tips to study topics extracted with Gemini
components/
  Calendar.tsx                  Calendar, sidebar, popups
  SyllabusUpload.tsx            Upload button
  PreferencesQuiz.tsx           Study preferences quiz
lib/
  llm.ts                        Gemini calls and retry logic
  schemas.ts                    Zod schemas for AI output
  scheduler.ts                  Places study sessions into open time
  preferences.ts                Quiz data types and time helpers
```

## Known Issues or Tips

- The free tier of Gemini has a small daily request limit, so delayed responses may not be because of a code error but rather a high demand on Gemini's servers.
- If a module cannot be found try `npm install`

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
