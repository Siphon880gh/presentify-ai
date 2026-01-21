# Presentify AI App - Agent Documentation

## Overview

Presentify is a React-based presentation creation app powered by Gemini AI. Users can generate slideshows from topics, upload documents for grounded content, and present with voice narration.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router (HashRouter)
- **AI**: Google Gemini API (via `services/geminiService.ts`)
- **Storage**: IndexedDB + localStorage (via Repository pattern in `services/storageService.ts`)
- **Export**: jsPDF, pptxgenjs, html2canvas

## Architecture

### File Structure

```
/
├── App.tsx              # Main app with EditorView, PromptWizard, PresenterView
├── types.ts             # TypeScript interfaces (Presentation, Slide, User, etc.)
├── components/
│   └── SlideRenderer.tsx # Renders individual slides with edit capabilities
├── services/
│   ├── geminiService.ts  # AI generation (presentations, images, TTS)
│   └── storageService.ts # Data persistence layer (Repository pattern)
├── demo/
│   └── index.ts          # Demo presentation data
└── vite.config.ts        # Vite configuration
```

### Data Flow

1. UI components interact with `storageService.ts` (never directly with localStorage/IndexedDB)
2. Storage service manages all persistence with user-scoped data
3. AI features call `geminiService.ts` for generation

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
```

## UI Components

### EditorView (main workspace)
- Header with auth controls (Login/Signup/Logout in top-right)
- Topic input with mode selector (Simple/Advanced)
- Slide outline sidebar (draggable in edit mode)
- Slide canvas with SlideRenderer
- Edit mode toolbar (add text/image, change layout, regenerate)

### Auth Flow
1. Users see Login/Signup buttons in header when not authenticated
2. Empty state shows call-to-action to sign up
3. After login, user's presentations load from storage
4. Logout clears current presentation and resets state

### PresenterView (fullscreen presentation)
- Slide display with navigation
- Auto-play with voice narration
- Speaker notes with synchronized scrolling

### PromptWizard (advanced generation)
- Document upload (.pdf, .docx, .txt, .csv, .md, images)
- URL input for web sources
- Slide structure/focus definition
- Generation mode selection

## Important Notes

1. **Passwords are not secure** - Uses simple hash for local testing only
2. **No backend** - All data stays in browser storage
3. **Repository pattern** - UI should never directly access localStorage/IndexedDB
4. **User scoping** - All data operations automatically filter by current user
