# Presentify AI - Project Context

> [!NOTE]
> **Approximate Location Cues:** Line references in this documentation (e.g., "near the middle", "top 25%") are intentional to ensure documentation remains resilient to minor code shifts.

## 1. High-Level Overview
Presentify AI is a professional, AI-powered presentation generation tool. It leverages Google’s Gemini API to transform text prompts into structured multi-slide presentations. Users can edit content in real-time, swap layouts, change transitions, regenerate AI-driven imagery, and use a dedicated Presenter Mode with synchronized controls.

### Tech Stack
- **Framework:** React 19 (via ESM imports)
- **Routing:** HashRouter (via `react-router-dom`)
- **Styling:** Tailwind CSS (via CDN in `index.html`)
- **AI Integration:** `@google/genai` (Gemini 3 Flash for text, Gemini 2.5 Flash for images, Gemini 2.5 Flash TTS for narration)
- **Exporting Libraries:** `jspdf` (PDF generation), `html2canvas` (DOM capturing), `pptxgenjs` (PowerPoint generation)
- **Parsing Libraries:** `pdfjs-dist` (PDF extraction), `mammoth` (DOCX extraction)

## 2. File Tree & Roles
- `App.tsx`: The main orchestrator. Includes logic for **Instant Voice Previews**, gender indicators (M/F), and a fixed dependency tracking system in `PresenterView` to ensure slide-level voice overrides are respected. Implements **Global Keyboard Navigation** in `EditorView`.
- `EditorView`: Manages presentation state and editing. Implements a `previewCacheRef` and background pre-fetching logic. Now features arrow key navigation to switch slides when not focused on an input.
- `PresenterView`: A specialized view for presenters. Includes an **Auto-Play** mode that uses TTS to read notes and advance slides. Features improved dependency tracking for the entire `presentation` object to ensure voice overrides are always up-to-date.
- `components/SlideRenderer.tsx`: Contains the `SlideRenderer` for visual output, the `RichTextEditor`, and logic for handling **Floating Elements** and **Image Resizing**.
- `services/geminiService.ts`: Abstraction layer for Gemini API. Handles structured JSON generation, TTS audio generation via `speakText`, and slide refinement.
- `types.ts`: Schema definitions for `FloatingElement`, `Slide`, and `Presentation`.
- `demo/index.ts`: Sample presentation data enhanced with **Speaker Notes**.
- `vite-env.d.ts`: Shorthand module declarations for asset resolution.

## 3. Architecture & Code Flow

### UI/UX: Generation & Refinement
- **Global Refinement Mode:** Users can refine an entire presentation instead of starting over.
- **Voice Editing Modal:** A dedicated modal allows users to manage narration voices.
  - **Global Voice:** Apply a single voice to the entire presentation.
  - **Slide Overrides:** Assign specific voices to individual slides.
  - **Voice Metadata:** Displays gender indicators (M/F) for all available voices.
  - **Instant Preview:** When the modal opens, it pre-fetches sample audio for all voices. Clicking the preview button plays the cached audio instantly.
- **Slide Reordering:** HTML5 Drag and Drop support in the slide outline.
- **Keyboard Navigation:** In `EditorView`, ArrowLeft and ArrowRight keys advance or retreat through slides unless an input, textarea, or contenteditable element is focused.

### Presenter Mode & Auto-Play (High Performance)
- **Mechanism:** Uses the browser's Fullscreen API.
- **Auto-Play Logic:** Narration using Gemini TTS.
  - **Audio Caching & Prefetching:** Implements slide-id based caching that respects both `notes` and `voiceName`.
- **Audio Processing:** Implements a raw PCM decoder for Gemini TTS output.

### Grounded Content Generation
- Files are parsed on the client (PDF, DOCX, CSV, TXT, MD).
- Images are converted to base64 and sent as multi-modal parts to Gemini 3 Flash.

---

# RichTextEditor Synchronization Strategy (CRITICAL)

The `RichTextEditor` uses browser-native `contentEditable` for rich formatting.

## Rules
1. **No `dangerouslySetInnerHTML`**: Manage `innerHTML` manually through `editorRef`.
2. **Sync Control**: Only update `innerHTML` from props if the editor is **NOT** focused.
3. **Selection Recovery**: Save and restore range in between formatting commands.
4. **ReadOnly State**: When `readOnly` is true, formatting is disabled and `contentEditable` is set to false.