# LandNexus Frontend

React + TypeScript + Vite frontend starter for the Maharashtra Land Acquisition Management System.

## Requirements
- Node.js 20 LTS or later
- npm 10+

## Run
```powershell
cd D:\landnexus-platform\LandNexus-frontend
npm install
npm run dev
```
Open http://localhost:5173

## Production build
```powershell
npm run build
npm run preview
```

## Included screens
- Secure-style sign-in screen (demo UI only)
- Overview dashboard with metrics and charts
- Government projects
- Consultant proposals and proposal review
- Land records and parcel register
- Land acquisition workflow
- Valuation & compensation
- GIS / map workspace placeholder
- Monitoring & reports
- Administration & user management
- Settings

## Backend integration
Set `VITE_API_BASE_URL` in `.env`. The current UI uses local demo data and browser state so the screens can be explored before the backend APIs are connected.

Important: Login is a front-end demonstration, not real authentication. Do not use it to protect production data. Connect it to the Spring Boot JWT authentication API, enforce permissions server-side, and remove demo credentials before deployment. All land-owner information shown is synthetic sample data.
