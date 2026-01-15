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
- `App.tsx`: The main orchestrator. Includes `HashRouter` and primary views (`EditorView`, `PresenterView`). Features an auto-expanding multiline prompt field in the header, the **Prompt Wizard** with source grounding, and **Edit Mode** for canvas-style customization. Now includes **Voice Narration Settings** for global and slide-specific voices.
- `EditorView`: Manages presentation state, slide navigation, library management, and **Advanced Edit Mode** toggling. Features a **dynamically expanding prompt field** and a **Prompt Wizard** for complex structure and source-based generation.
- `PresenterView`: A specialized view for presenters with slide previews and speaker notes. Includes an **Auto-Play** mode that uses TTS to read notes and advance slides, now with support for per-slide voice overrides.
- `components/SlideRenderer.tsx`: Contains the `SlideRenderer` for visual output, the `RichTextEditor`, and logic for handling **Floating Elements** (draggable text and images) and **Image Resizing**.
- `services/geminiService.ts`: Abstraction layer for Gemini API. Handles structured JSON generation, TTS audio generation via `speakText` (supporting multiple voices), and slide refinement via `refineSlide`.
- `types.ts`: Schema definitions, now including `FloatingElement` and updated `Slide` and `Presentation` schemas with `voiceName` support.
- `demo/index.ts`: Sample presentation data enhanced with **Speaker Notes**.
- `vite-env.d.ts`: Shorthand module declarations for asset resolution.

## 3. Architecture & Code Flow

### UI/UX: Generation & Refinement
- **Global Refinement Mode:** Users can refine an entire presentation instead of starting over.
- **Toggle Mechanism:** An "Edit Mode" button in the header activates specialized editing tools.
- **Voice Editing Modal:** A dedicated modal allows users to manage narration voices.
  - **Global Voice:** Apply a single voice to the entire presentation.
  - **Slide Overrides:** Assign specific voices (Puck, Charon, Kore, Fenrir, Zephyr) to individual slides.
  - **Cache Invalidation:** Changing a voice (globally or per-slide) invalidates the `audioCacheRef` in `PresenterView`, forcing a fresh TTS generation during playback.
- **Slide Reordering:** HTML5 Drag and Drop support in the slide outline.
- **Floating Elements:** Independent text and image elements with percentage positioning.

### Presenter Mode & Auto-Play (High Performance)
- **Mechanism:** Uses the browser's Fullscreen API.
- **Auto-Play Logic:** Narration using Gemini TTS.
  - **Audio Caching & Prefetching:** Implements slide-id based caching that respects both `notes` and `voiceName`.
  - **Notes Sync:** Auto-scrolls speaker notes in sync with audio playback.
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