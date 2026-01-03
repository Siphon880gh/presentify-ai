
# Presentify AI - Project Context

> [!NOTE]
> **Approximate Location Cues:** Line references in this documentation (e.g., "near the middle", "top 25%") are intentional to ensure documentation remains resilient to minor code shifts.

## 1. High-Level Overview
Presentify AI is a professional, AI-powered presentation generation tool. It leverages Google’s Gemini API to transform text prompts into structured multi-slide presentations. Users can edit content in real-time, swap layouts, change transitions, regenerate AI-driven imagery, and use a dedicated Presenter Mode with synchronized controls.

### Tech Stack
- **Framework:** React 19 (via ESM imports)
- **Routing:** HashRouter (via `react-router-dom`)
- **Styling:** Tailwind CSS (via CDN in `index.html`)
- **AI Integration:** `@google/genai` (Gemini 3 Flash for text, Gemini 2.5 Flash for images)
- **Exporting Libraries:** `jspdf` (PDF generation), `html2canvas` (DOM capturing), `pptxgenjs` (PowerPoint generation)

## 2. File Tree & Roles
- `App.tsx`: The main orchestrator. Includes `HashRouter` and primary views (`EditorView`, `PresenterView`). Features an auto-expanding multiline prompt field in the header for complex topics.
- `EditorView`: Manages presentation state, slide navigation, drag-and-drop reordering, export logic, and speaker notes editing.
- `PresenterView`: A specialized view for presenters that displays the current slide, next slide preview, speaker notes, and a session timer.
- `components/SlideRenderer.tsx`: Contains the `SlideRenderer` for visual output and the `RichTextEditor`.
- `services/geminiService.ts`: Abstraction layer for Gemini API. Handles structured JSON generation including speaker notes.
- `types.ts`: Defines `SlideLayout`, `SlideTransition`, and the `Presentation` schema (including `notes`).

## 3. Architecture & Code Flow

### Presenter Mode (Fullscreen)
- **Mechanism:** Uses the browser's Fullscreen API (`document.documentElement.requestFullscreen()`) to display slides in fullscreen mode within the same window.
- **Flow:** Clicking "Present" requests fullscreen and renders a minimal slide view with hidden controls. Controls (prev/next, slide counter, exit) appear on hover at the bottom of the screen.
- **Navigation:** Arrow keys (Left/Right), Space, PageUp/PageDown for slide navigation. Escape exits fullscreen.
- **State Sync:** The `PresenterView` route (`#/present`) still exists for external window use if needed, using `localStorage` for sync.

### localStorage Schema
The app uses a multi-key storage strategy to avoid quota limitations from large base64 images:

| Key Pattern | Purpose |
|-------------|---------|
| `presentify_current` | Active session state (no images) for presenter sync |
| `presentify_library` | Array of saved presentation metadata (`id`, `title`, `savedAt`, `slideCount`) |
| `presentify_pres_{id}` | Full presentation data without images |
| `presentify_img_{presId}_{slideId}` | Individual slide images stored separately |

- **Save:** Opens a modal to name the presentation, then stores presentation data and images in separate keys.
- **Open:** Displays a list of saved presentations from the library for selection and loading.
- **Auto-sync:** The current session syncs to `presentify_current` (debounced) for presenter mode, with images stored separately.

### Export Flow
- **UI:** A split-button menu in the header with format options.
- **PDF/PPTX:** Captured via off-screen rendering or programmatic mapping of layouts to PowerPoint objects.

---

# RichTextEditor Synchronization Strategy (CRITICAL)

The `RichTextEditor` uses browser-native `contentEditable` for rich formatting.

## Strict Rules & Solutions
1. **No `dangerouslySetInnerHTML`**: Manage `innerHTML` manually through `editorRef`.
2. **Preventing "Blank Text" on Mount**: Use `useLayoutEffect` to set `innerHTML` synchronously.
3. **Preventing Cursor Jumps during External Sync**: Only update `innerHTML` if the prop `value` differs AND the editor is **NOT** focused.
4. **Toolbar Persistence**: Check `relatedTarget` in `onBlur` to keep toolbar open when clicking its buttons.
