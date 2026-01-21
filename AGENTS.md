
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

## Testing Infrastructure

The app includes a dedicated **Test Harness** (`TestHarness.tsx`) for validating core system logic without using the full production UI.

### Test Mode Activation
- Switch `testMode: true` in `config.ts` to boot into the Storage Lab.

### Diagnostic Capabilities
- **Auth Lifecycle**: Validates signup, login, and logout state transitions.
- **Data Isolation**: Verifies that IndexedDB presentations and session data are correctly scoped to the `userId` of the currently authenticated session.
- **System Health**: Provides "Soft Reset" and "Nuke Storage" utilities to clean diagnostic environments.

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

### Auth Functions (in storageService.ts)

```typescript
signup(email, password, displayName) -> { success, error?, user? }
login(email, password) -> { success, error?, user? }
logout() -> void
getCurrentUser() -> User | null
getCurrentUserId() -> string | null
```

### User-Scoped Data Access

All data functions automatically scope to the current user:
- `getSettings()` / `updateSettings()` - user's preferences
- `listPresentations()` - only user's presentations
- `getPresentation(id)` - returns null if not owned by user
- `savePresentation()` - automatically sets userId
- `deletePresentation(id)` - verifies ownership before delete
- `saveCurrentSession()` / `loadCurrentSession()` - user-specific working session

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

// ... other UI-related documentation follows ...
```