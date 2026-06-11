# SmartLearn AI

AI-powered adaptive learning platform built with Next.js 15, MongoDB, Clerk, and OpenAI.

## Features

- **Authentication** — Clerk sign-up/sign-in with protected routes
- **Onboarding** — Personalized learning profile stored in MongoDB
- **Dashboard** — Streaks, progress charts, AI recommendations
- **Syllabus Upload** — PDF extraction with `pdf-parse` + AI topic identification
- **Dynamic Subjects** — User-defined subjects and topics from database
- **Study Sessions** — AI tutor, Pomodoro timer, notes & quiz generation
- **Focus Mode** — Distraction-free Pomodoro study environment
- **Progress Analytics** — Streaks, weak areas, adaptive study plans
- **AI Notes** — Summary, key points, revision, interview, and quiz notes

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 App Router, TypeScript, Tailwind CSS, Framer Motion, Shadcn UI |
| Backend | Next.js API Routes, Mongoose |
| Database | MongoDB Atlas |
| Auth | Clerk |
| AI | OpenAI GPT-4o-mini (optional fallback without API key) |

## Getting Started

### 1. Clone and install

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

- [Clerk](https://clerk.com) — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- [MongoDB Atlas](https://www.mongodb.com/atlas) — `MONGODB_URI`
- [OpenAI](https://platform.openai.com) — `OPENAI_API_KEY` (optional but recommended)

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/
  (auth)/          # Clerk sign-in/sign-up
  (main)/          # Protected app pages
    dashboard/
    subjects/
    study/
    upload/
    notes/
    progress/
    focus/
  api/             # REST API routes
  onboarding/
components/
lib/
models/
hooks/
```

## User Flow

1. Sign up → Complete onboarding
2. Upload syllabus PDF → Topics extracted automatically
3. Browse subjects → Start study session
4. Use AI tutor, generate notes, track progress
5. View adaptive study plan on Progress page

## Deployment

Deploy to [Vercel](https://vercel.com):

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

## License

MIT
