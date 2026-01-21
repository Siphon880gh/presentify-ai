# Data Persistence Specification

## Multi-User Storage Architecture

Presentify supports multiple local user accounts with complete data isolation. All data is stored client-side using localStorage and IndexedDB.

---

## Storage Schema

### localStorage Tables

| Key | Type | Description |
|-----|------|-------------|
| `presentify_users` | `User[]` | All registered user accounts |
| `presentify_auth` | `{ userId: string }` | Current logged-in session |
| `presentify_settings` | `{ [userId]: UserSettings }` | Per-user preferences map |

### IndexedDB Stores

**Database:** `PresentifyDB` (version 2)

| Store | Key | Index | Description |
|-------|-----|-------|-------------|
| `presentations` | `id` (keyPath) | `userId` | User presentations with ownership |
| `session` | `user_{userId}_current` | — | Per-user working session state |

---

## Type Definitions

```typescript
interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
}

interface UserSettings {
  defaultAdvancedMode: boolean;
  autoplayDelay: number;
}

interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
  userId?: string;        // Owner's user ID
  updatedAt?: string;
  transitionType?: SlideTransition;
  defaultVoiceName?: string;
}

interface PresentationMeta {
  id: string;
  title: string;
  updatedAt: string;
  slideCount: number;
}
```

---

## Authentication API

### `signup(email, password, displayName)`
Creates a new user account and auto-logs them in.

**Returns:** `{ success: boolean; error?: string; user?: User }`

**Errors:**
- `"Email already registered"` — duplicate email

### `login(email, password)`
Authenticates existing user and creates session.

**Returns:** `{ success: boolean; error?: string; user?: User }`

**Errors:**
- `"User not found"` — email not registered
- `"Incorrect password"` — password mismatch

### `logout()`
Clears the current auth session from localStorage.

### `getCurrentUser()`
**Returns:** `User | null` — Full user object or null if not logged in.

### `getCurrentUserId()`
**Returns:** `string | null` — User ID or null if not logged in.

---

## User-Scoped Data API

All data functions automatically scope to the current authenticated user. Operations fail silently (return empty/null) if no user is logged in.

### Settings

```typescript
getSettings(): UserSettings
// Returns current user's settings or defaults

updateSettings(settings: Partial<UserSettings>): void
// Merges partial settings into current user's preferences
```

**Default Settings:**
```typescript
{
  defaultAdvancedMode: true,
  autoplayDelay: 2000
}
```

### Presentations

```typescript
listPresentations(): Promise<PresentationMeta[]>
// Returns metadata for all presentations owned by current user

getPresentation(id: string): Promise<Presentation | null>
// Returns presentation only if owned by current user

savePresentation(presentation: Presentation): Promise<void>
// Saves with current user's ID and updated timestamp

deletePresentation(id: string): Promise<void>
// Deletes only if current user owns the presentation
```

### Session State

```typescript
saveCurrentSession(presentation: Presentation, slideIndex: number): Promise<boolean>
// Persists working state to user-specific session key

loadCurrentSession(): Promise<{ presentation: Presentation | null; slideIndex: number }>
// Loads user's last working state

clearCurrentSession(): Promise<void>
// Removes user's session data (used on logout)
```

---

## Data Isolation Rules

1. **Presentations** are tagged with `userId` on save
2. **Listing** filters results by current user
3. **Fetching** returns null if user doesn't own the presentation
4. **Deleting** verifies ownership before removal
5. **Session keys** are namespaced: `user_{userId}_current`
6. **Settings** are stored in a map keyed by userId

---

## Security Notes

- Passwords are hashed using a simple local hash (not cryptographically secure)
- This is designed for local multi-user testing, not production security
- All data remains client-side (no server communication)
- Cross-user data access is prevented at the service layer

---

## Utility Functions

```typescript
generateId(): string
// Returns random 9-character alphanumeric ID

initializeStorage(): Promise<void>
// Ensures IndexedDB and localStorage tables exist
```

---

## Migration Notes

**v1 → v2 Changes:**
- Added `userId` index to presentations store
- Changed session keys from `current` to `user_{userId}_current`
- Settings changed from single object to per-user map
- All data functions now scope to authenticated user
