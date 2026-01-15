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
- **Parsing Libraries:** `pdfjs-dist` (PDF extraction), `mammoth` (DOCX extraction)

## 2. File Tree & Roles
- `App.tsx`: The main orchestrator. Includes `HashRouter` and primary views (`EditorView`, `PresenterView`). Features an auto-expanding multiline prompt field in the header and the **Prompt Wizard** with source grounding.
- `EditorView`: Manages presentation state, slide navigation, drag-and-drop reordering, and library management. Features a **dynamically expanding prompt field** and a **Prompt Wizard** for complex structure and source-based generation.
- `PresenterView`: A specialized view for presenters with slide previews and speaker notes.
- `components/SlideRenderer.tsx`: Contains the `SlideRenderer` for visual output and the `RichTextEditor`.
- `services/geminiService.ts`: Abstraction layer for Gemini API. Handles structured JSON generation with multi-modal context support.
- `types.ts`: Schema definitions for the application.

## 3. Architecture & Code Flow

### UI/UX: Prompt Field & Wizard
- **Prompt Field:** Monitors `prompt.length` and focus state via `isPromptFocused`. Expands to `max-w-full` when focused with ≥ 33 chars.
- **Split Button:** The "Create" button features a split dropdown chevron.
- **Prompt Wizard:** A comprehensive modal allowing users to:
  - Input a detailed multiline context.
  - **Slide Count Selection:** Choose between "Exact Count" (3-25 slider) and "Quick Pick" qualitative options (Few=5, Moderate=10, Many=15, Numerous=20).
  - **Source Grounding:** Upload documents (PDF, DOCX, CSV, TXT, **Markdown .md**, Images) or provide web URLs.
  - **Upload Feedback:** Lists supported types and provides inline error messages for unsupported file formats.
  - **Structural Drag-and-Drop:** Rearrange slide topics using native drag-and-drop to define the generation sequence.
  - Sync prompt text between header and wizard automatically.
  - Reset wizard state to clear custom structure and sources.

### Grounded Content Generation
- Files are parsed on the client (PDF, DOCX via libraries; CSV, TXT, MD via native APIs).
- Images are converted to base64 and sent as multi-modal parts to Gemini.
- URL contents are fetched (subject to CORS) and extracted for text context.
- Gemini 3 Flash receives all source material as `parts` in the generation request, prioritizing it for factual accuracy.

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