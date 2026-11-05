# Legacy prototype

This folder contains the original single-file demo prototype (`App.tsx`, `data.ts`,
`styles.css`, `main.tsx`).

It is kept for reference only. No production route imports anything from this folder,
and the folder is excluded from TypeScript compilation in `tsconfig.json`.

The prototype used hard-coded demo data and a fake `localStorage` login. It must not be
used for real authentication or production screens.
