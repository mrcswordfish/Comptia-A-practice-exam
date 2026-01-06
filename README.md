# CompTIA A+ Practice Exam Simulator (Core 1 / Core 2)

A Vite + React + TypeScript web app that simulates a CompTIA A+ exam session:
- Core selection: **220-1201** or **220-1202**
- **90 questions** per session
- **90-minute timer**
- PBQ-style questions (ordering + matching)
- Review screen before final submit
- Results with explanations + Objective Coverage Dashboard
- Analytics: attempt history + weak objectives trendlines

## Quick start
```bash
npm install
npm run dev
```

## Build for deployment
```bash
npm run build
npm run preview
```

Deploy the `dist/` folder to any static host (Netlify/Vercel/GitHub Pages, etc.).

## Objective titles + sub-bullets (recommended)
This project can auto-extract objective titles and bullet lists from your official exam-objectives PDFs.

1) Create a folder at project root:
```
objectives/
```

2) Place your PDFs inside that folder (names must match):
- `CompTIA A+ 220-1201 Exam Objectives (4.0).pdf`
- `CompTIA A+ 220-1202 Exam Objectives (4.0).pdf`

3) Run:
```bash
npm run extract-objectives
```

This generates `src/objectives.generated.ts` (auto-generated).

If you don't run this, the app uses a minimal built-in objective metadata file so it still compiles and runs.

## Notes
- This app **does not use brain dumps** or copyrighted exam questions. Questions are original and objective-aligned.
