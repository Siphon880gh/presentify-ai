# Presentify AI App - Agent Documentation

## Overview

Presentify is a React-based presentation creation app powered by Gemini AI. Users can generate slideshows from topics, upload documents for grounded content, and present with voice narration.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router (HashRouter)
- **AI**: Google Gemini API (via `services/geminiService.ts`)
- **Storage**: IndexedDB + localStorage (via Repository pattern in `services/storageService.ts`)
- **Export**: jsPDF, pptxgenjs, html2canvas
- **Backend (Migration Target)**: Plain PHP + MongoDB (implemented in `AGENTS/`)

## Testing Infrastructure

The app includes a dedicated **Test Harness** (`TestHarness.tsx`) for validating core system logic without using the full production UI.

### Test Mode Activation
- Switch `testMode: true` in `config.ts` to boot into the Storage Lab.

### Diagnostic Capabilities
- **Auth Lifecycle**: Validates signup, login, and logout state transitions.
- **Data Isolation**: Verifies that IndexedDB presentations and session data are correctly scoped to the `userId` of the currently authenticated session.
- **Settings Persistence**: Validates that `UserSettings` are persisted per-user in local storage.
- **Security Validation**: Ensures that cross-user data access (deletions/reads) is restricted at the service layer.
- **System Health**: Provides "Factory Reset" to purge all local storage and IndexedDB instances.

## Multi-User Authentication System

The app supports multiple local users for in-person testing. All data is stored client-side.

### Storage Schema (Database-style)

**localStorage tables:**
- `presentify_users` - User[] (accounts with id, email, passwordHash, displayName, createdAt)
- `presentify_auth` - { userId: string } (current logged-in session)
- `presentify_settings` - { [userId]: UserSettings } (per-user preferences)

**IndexedDB stores:**
- `presentations` - Presentation objects with `userId` field for ownership
- `session` - Per-user current working session (key: `user_{userId}_current`)

## Backend REST API (Migration Source of Truth)

The server files are located in the `AGENTS/` directory and act as the specification for future frontend-to-remote-API migration.

### Key Files
- `AGENTS/api.php`: Plain PHP REST API implementing the full spec (Auth, Presentations, Sessions, Settings).
- `AGENTS/seed.php`: PHP script to populate the MongoDB instance with test accounts.
- `.env`: Local configuration for backend services.

### API Endpoints
- `GET ?action=status`: Health check for API and DB connectivity.
- `POST ?action=signup`: User registration.
- `POST ?action=login`: User authentication (returns JWT).
- `GET ?action=me`: Current user details (JWT required).
- `GET ?action=presentations`: User presentation library.
- `GET/POST/PUT/DELETE ?action=presentation`: Individual presentation CRUD.
- `GET/PUT/DELETE ?action=session`: User session state.
- `GET/PUT ?action=settings`: User preferences.

## Key Types

```typescript
interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
}

interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
  userId?: string;  // Owner's user ID
  transitionType?: SlideTransition;
  defaultVoiceName?: string;
}

interface UserSettings {
  defaultAdvancedMode: boolean;
  autoplayDelay: number;
}
```