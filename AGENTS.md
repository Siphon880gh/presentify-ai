# Presentify AI App - Agent Documentation

## Overview

Presentify is a React-based presentation creation app powered by Gemini AI. Users can generate slideshows from topics, upload documents for grounded content, and present with voice narration.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router (HashRouter)
- **AI**: Google Gemini API (via `services/geminiService.ts`)
- **Storage (Local)**: IndexedDB + localStorage (via Repository pattern in `services/storageService.ts`)
- **Storage (Remote)**: REST API client (via Repository pattern in `services/onlineStorageService.ts`)
- **Export**: jsPDF, pptxgenjs, html2canvas
- **Backend (Migration Target)**: Plain PHP + MongoDB (implemented in `AGENTS/`)

## Testing Infrastructure

The app includes two test harness components for validating core system logic without using the full production UI.

### Test Harnesses
- **`TestHarness.tsx`**: Local storage mode - uses IndexedDB and localStorage via `services/storageService.ts`
- **`TestHarnessOnline.tsx`**: Remote API mode - uses the remote API via `services/onlineStorageService.ts`

### Test Mode Activation
- Set `testMode: true` in `config.ts` to boot into the test harness.
- Set `testModeOnline: true` (default) to use the online test harness with remote API.
- Set `testModeOnline: false` to use the local storage test harness.

### Diagnostic Capabilities
- **Auth Lifecycle**: Validates signup, login, and logout state transitions.
- **Data Isolation**: Verifies that presentations and session data are correctly scoped to the `userId` of the currently authenticated session.
- **Settings Persistence**: Validates that `UserSettings` are persisted per-user.
- **Security Validation**: Ensures that cross-user data access (deletions/reads) is restricted at the service layer.
- **System Health**: Local harness provides "Factory Reset" to purge all local storage and IndexedDB instances.

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

The server files are located in the `AGENTS/` directory and act as the specification for the frontend-to-remote-API migration.

### Remote API Connection
- **Base URL**: `https://wengindustries.com/backend/presentify/api.php`
- **Client**: `services/onlineStorageService.ts` implements the repository pattern wrapping all API calls
- **Authentication**: JWT token stored in memory, passed via `Authorization: Bearer <token>` header

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