
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
- `App.tsx`: The main orchestrator. Includes `HashRouter` and primary views (`EditorView`, `PresenterView`). Features an auto-expanding multiline prompt field in the header.
- `EditorView`: Manages presentation state, slide navigation, drag-and-drop reordering, and library management. Features a **dynamically expanding prompt field** that smoothly grows to `max-w-4xl` when input length ≥ 33 characters and focused.
- `PresenterView`: A specialized view for presenters with slide previews and speaker notes.
- `components/SlideRenderer.tsx`: Contains the `SlideRenderer` for visual output and the `RichTextEditor`.
- `services/geminiService.ts`: Abstraction layer for Gemini API. Handles structured JSON generation.
- `types.ts`: Schema definitions for the application.

## 3. Architecture & Code Flow

### UI/UX: Prompt Field Expansion
- **Mechanism:** Monitors `prompt.length` and focus state via `isPromptFocused`.
- **Expansion Logic:** If `length >= 33` and field is focused, the prompt container expands from `max-w-2xl` to `max-w-4xl`.
- **Animation:** Uses Tailwind's `transition-all duration-300 ease-out` for a smooth, fast animated transition.

### Presenter Mode (Fullscreen)
- **Mechanism:** Uses the browser's Fullscreen API. Controls appear on hover at the bottom.
- **State Sync:** Uses `localStorage` and `storage` events to keep current slide and notes synchronized between editor and presenter windows.

### localStorage Schema
- `presentify_current`: Active session (no images).
- `presentify_library`: Metadata for all saved presentations.
- `presentify_pres_{id}`: Presentation content (no images).
- `presentify_img_{presId}_{slideId}`: Individual slide images.

---

# RichTextEditor Synchronization Strategy (CRITICAL)

The `RichTextEditor` uses browser-native `contentEditable` for rich formatting.

## Rules
1. **No `dangerouslySetInnerHTML`**: Manage `innerHTML` manually through `editorRef`.
2. **Sync Control**: Only update `innerHTML` from props if the editor is **NOT** focused.
3. **Selection Recovery**: Save and restore range in between formatting commands.
