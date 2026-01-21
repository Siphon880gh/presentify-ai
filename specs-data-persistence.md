# Presentify AI - Data Persistence Specification

## Overview

This document defines the data persistence strategy for the Presentify AI single-user application. The persistence layer uses browser `localStorage` with a normalized, database-like structure that maintains user work reliably across sessions.

---

## Storage Architecture

### Storage Keys (v2 Schema)

| Key | Purpose | Data Type |
|-----|---------|-----------|
| `presentify_db` | Main database containing all metadata and relationships | `PresentifyDB` |
| `presentify_images` | Separate storage for slide images (base64) | `ImageStore` |

This two-key approach separates large binary data (images) from structured metadata, making it easier to manage localStorage quota limits and enabling graceful degradation if images fail to save.

---

## Database Schema

### PresentifyDB (Main Database)

```typescript
interface PresentifyDB {
  version: number;                              // Schema version for migrations
  session: SessionState;                        // Active session pointer
  settings: UserSettings;                       // User preferences
  presentations: Record<string, PresentationRecord>;  // Presentation "table"
  slides: Record<string, SlideRecord>;          // Slides "table"
}
```

### SessionState

Tracks the currently active presentation and editing position.

```typescript
interface SessionState {
  presentationId: string | null;  // ID of active presentation
  slideIndex: number;             // Current slide position
  lastSavedAt: string;            // ISO timestamp of last auto-save
}
```

### UserSettings

Persisted user preferences that survive across sessions.

```typescript
interface UserSettings {
  defaultAdvancedMode: boolean;   // Simple vs Advanced generation mode
  autoplayDelay: number;          // Delay between slides in ms (0-5000)
  lastUsedVoice: string;          // Most recently selected TTS voice
}
```

**Defaults:**
- `defaultAdvancedMode`: `true`
- `autoplayDelay`: `1000`
- `lastUsedVoice`: `'Zephyr'`

### PresentationRecord

Presentation metadata stored in the presentations "table". References slides by ID.

```typescript
interface PresentationRecord {
  id: string;                     // Unique identifier
  title: string;                  // Presentation title
  defaultVoiceName?: string;      // Default TTS voice
  transitionType?: string;        // Global transition style
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
  slideIds: string[];             // Ordered array of slide IDs
}
```

### SlideRecord

Individual slide data stored in the slides "table". Each slide references its parent presentation.

```typescript
interface SlideRecord {
  id: string;                     // Unique identifier
  presentationId: string;         // Foreign key to presentation
  title: string;                  // Slide title (supports HTML)
  subtitle?: string;              // Optional subtitle (supports HTML)
  content: string[];              // Bullet points or paragraphs
  layout: SlideLayout;            // Layout type enum
  imagePrompt?: string;           // AI prompt used to generate image
  imageWidth?: number;            // Image dimensions
  imageHeight?: number;
  transitionType?: string;        // Per-slide transition override
  notes?: string;                 // Speaker notes for narration
  voiceName?: string;             // Per-slide voice override
  floatingElements?: FloatingElement[];  // User-added elements
}
```

### ImageStore

Separate storage for slide images, keyed by slide ID.

```typescript
interface ImageStore {
  [slideId: string]: string;      // slideId -> base64 data URL
}
```

---

## Enums

### SlideLayout

```typescript
enum SlideLayout {
  TITLE = 'TITLE',
  BULLETS = 'BULLETS',
  IMAGE_LEFT = 'IMAGE_LEFT',
  IMAGE_RIGHT = 'IMAGE_RIGHT',
  QUOTE = 'QUOTE',
  TWO_COLUMN = 'TWO_COLUMN'
}
```

### SlideTransition

```typescript
enum SlideTransition {
  FADE = 'FADE',
  SLIDE = 'SLIDE',
  ZOOM = 'ZOOM'
}
```

---

## Persistence Operations

### Auto-Save (Session Sync)

| Trigger | Action |
|---------|--------|
| Presentation state changes | Debounced save (1s delay) to database |
| Slide index changes | Included in session save |
| Any slide edit | Triggers presentation state change |

**Behavior:**
- Full presentation data is saved, not just deltas
- Images are saved alongside presentation data
- Session pointer (`presentationId`, `slideIndex`) is updated

### Manual Save (Library)

Identical to auto-save in v2 architecture. Every presentation with a title is automatically part of the library.

### Load from Library

1. Retrieve presentation record from `presentations` table
2. Retrieve all slides by IDs from `slides` table
3. Retrieve images from `ImageStore`
4. Reconstruct full `Presentation` object with images

### Settings Persistence

Settings are saved immediately when changed:
- `isAdvancedMode` toggle
- `autoplayDelay` slider

---

## Data NOT Persisted

The following data is intentionally transient:

| Data | Reason |
|------|--------|
| Wizard state (topics, files, URLs) | Temporary input for generation |
| Parsed file contents | Re-uploadable; large size |
| Voice preview cache | Cached in memory during session |
| Audio buffers for narration | Generated on-demand via API |
| UI state (modals open, dropdowns) | Ephemeral interaction state |
| Export progress | Temporary operation state |

---

## Migration Support

### Schema Versioning

The database includes a `version` field (currently `2`) for handling schema changes:

```typescript
if (db.version < SCHEMA_VERSION) {
  return migrateDB(db);
}
```

### Legacy Data Migration

The storage service includes automatic migration from the legacy (v1) scattered-key format:

**Legacy Keys Migrated:**
- `presentify_current` → Session state + current presentation
- `presentify_library` → Presentation metadata
- `presentify_pres_{id}` → Full presentation data
- `presentify_img_{presId}_{slideId}` → Slide images

Migration runs automatically on app initialization and removes legacy keys after successful migration.

---

## Storage Considerations

### localStorage Limits

- **Typical quota:** 5-10 MB per origin
- **Strategy:** 
  - Images stored separately in dedicated key
  - Structured data compressed by JSON serialization
  - Graceful degradation on quota errors

### Image Storage Strategy

1. Images stored in a single `presentify_images` key
2. Keyed by slide ID for direct lookup
3. When a slide is deleted, its image is also removed
4. If image save fails, presentation metadata is still preserved

### Orphan Cleanup

When a presentation is deleted:
1. Remove presentation record
2. Remove all referenced slide records
3. Remove all associated images
4. Clear session if deleted presentation was active

---

## API Reference

### Storage Service Functions

```typescript
// Initialization
initializeStorage(): void

// Settings
getSettings(): UserSettings
updateSettings(updates: Partial<UserSettings>): void

// Session
getSession(): SessionState
updateSession(updates: Partial<SessionState>): void

// Presentations
listPresentations(): PresentationMeta[]
getPresentation(id: string): Presentation | null
savePresentation(presentation: Presentation): boolean
deletePresentation(id: string): boolean

// Quick Session Operations
saveCurrentSession(presentation: Presentation, slideIndex: number): boolean
loadCurrentSession(): { presentation: Presentation | null; slideIndex: number }

// Images
saveSlideImage(slideId: string, imageUrl: string): boolean
getSlideImage(slideId: string): string | null

// Utilities
generateId(): string
getStorageStats(): StorageStats
clearAllData(): void
```

---

## Security Considerations

- **No sensitive data:** API keys should be in environment variables, not localStorage
- **XSS risk:** Data is used in rendering; sanitize HTML content appropriately
- **No encryption:** Data is stored in plain text; suitable for single-user local app

---

## Future Considerations

1. **IndexedDB Migration:** For larger presentations or better performance with blobs
2. **Cloud Sync:** Optional backup to Firebase/Supabase for multi-device access
3. **Export/Import:** JSON file export for backup and sharing
4. **Compression:** LZ-string compression for image data to maximize quota
