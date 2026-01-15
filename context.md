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
- `App.tsx`: The main orchestrator. Includes `HashRouter` and primary views (`EditorView`, `PresenterView`). Features an auto-expanding multiline prompt field in the header, the **Prompt Wizard** with source grounding, and **Edit Mode** for canvas-style customization. Now includes **Global Refinement Mode** to iterate on existing slideshows.
- `EditorView`: Manages presentation state, slide navigation, library management, and **Advanced Edit Mode** toggling. Features a **dynamically expanding prompt field** and a **Prompt Wizard** for complex structure and source-based generation.
- `PresenterView`: A specialized view for presenters with slide previews and speaker notes. Now includes an **Auto-Play** mode that uses TTS to read notes and advance slides.
- `components/SlideRenderer.tsx`: Contains the `SlideRenderer` for visual output, the `RichTextEditor`, and logic for handling **Floating Elements** (draggable text and images) and **Image Resizing**. Includes optimized bullet point alignment for high-quality PDF exports via adjusted Tailwind spacing.
- `services/geminiService.ts`: Abstraction layer for Gemini API. Handles structured JSON generation, TTS audio generation via `speakText`, and slide refinement via `refineSlide`. Updated `generatePresentation` to support iterative **Global Refinement Mode**.
- `types.ts`: Schema definitions, now including `FloatingElement` and updated `Slide` schema with dimension support.
- `demo/index.ts`: Sample presentation data, now enhanced with **Speaker Notes** to demonstrate Auto-Play/TTS capabilities.
- `vite-env.d.ts`: Shorthand module declarations for asset resolution.

## 3. Architecture & Code Flow

### UI/UX: Generation & Refinement
- **Global Refinement Mode:** Users can refine an entire presentation instead of starting over. 
  - **Header Dropdown:** A "Refine Slideshow" button appears under the "Create" split button if a deck is already open.
  - **Prompt Wizard Integration:** A "Refine Existing Deck" toggle in the structure section of the wizard allows grounding refinement with new source documents or structural changes.
  - **AI Logic:** The current deck's high-level structure (titles and bullet summaries) is passed back to Gemini as context, allowing it to modify, reorder, or add slides while maintaining continuity.
- **Toggle Mechanism:** An "Edit Mode" button in the header activates specialized editing tools.
- **Clean View Implementation:** `SlideRenderer` strictly respects the `isEditMode` prop. When `false` (default for Presenter mode and PDF export), editor-only UI elements are hidden.
- **Slide Reordering:** When in Edit Mode, the slide outline in the `Aside` becomes draggable (HTML5 Drag and Drop API), allowing users to re-sequence slides instantly.
- **Single Slide Regeneration:** A floating toolbar in the editor allows users to regenerate or refine a single slide. 
  - **Refinement Mode:** A specialized checkbox allows building on existing slide content instead of replacing it entirely.
- **Main Image Regeneration:** In Edit Mode, hovering over the main slide image reveals a "Regenerate Image" overlay. 
- **Floating Elements:** Users can add independent text and image elements with responsive percentage positioning and snap-to-center alignment guides.
- **Image Resizing:** All images feature a bottom-right resize handle in Edit Mode. 

### UI/UX: Prompt Field & Wizard
- **Layout Stability:** The header uses fixed-width side containers to prevent the center prompt from shifting horizontally.
- **Prompt Field:** Monitors `prompt.length` and focus state to dynamically expand. Height is constrained between **34px and 60px** for layout stability.
- **Split Button:** The "Create" button features a split dropdown for the Prompt Wizard and Refinement options.
- **Prompt Wizard:** A comprehensive modal for source grounding, exact slide counts, and custom slide structures.

### Presenter Mode & Auto-Play (High Performance)
- **Mechanism:** Uses the browser's Fullscreen API.
- **Auto-Play Logic:** An automated narration sequence using Gemini TTS.
  - **Audio Caching & Prefetching:** Implements slide-id-based caching and pre-fetches the next slide's audio for zero-latency transitions.
  - **Notes Sync:** Auto-scrolls speaker notes in sync with audio playback percentage.
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