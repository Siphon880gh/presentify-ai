
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
- `App.tsx`: The main orchestrator. Includes `HashRouter` and primary views (`EditorView`, `PresenterView`). Features an auto-expanding multiline prompt field in the header, the **Prompt Wizard** with source grounding, and **Edit Mode** for canvas-style customization.
- `EditorView`: Manages presentation state, slide navigation, library management, and **Advanced Edit Mode** toggling. Features a **dynamically expanding prompt field** and a **Prompt Wizard** for complex structure and source-based generation.
- `PresenterView`: A specialized view for presenters with slide previews and speaker notes. Now includes an **Auto-Play** mode that uses TTS to read notes and advance slides.
- `components/SlideRenderer.tsx`: Contains the `SlideRenderer` for visual output, the `RichTextEditor`, and logic for handling **Floating Elements** (draggable text and images).
- `services/geminiService.ts`: Abstraction layer for Gemini API. Handles structured JSON generation, TTS audio generation via `speakText`, and slide refinement via `refineSlide`.
- `types.ts`: Schema definitions, now including `FloatingElement` and updated `Slide` schema.
- `demo/index.ts`: Sample presentation data.

## 3. Architecture & Code Flow

### UI/UX: Edit Mode & Canvas Editing
- **Toggle Mechanism:** An "Edit Mode" button in the header activates specialized editing tools.
- **Slide Reordering:** When in Edit Mode, the slide outline in the `Aside` becomes draggable (HTML5 Drag and Drop API), allowing users to re-sequence slides instantly. A **blue horizontal insert indicator** appears during drag-over to show exactly where the slide will land.
- **Single Slide Regeneration:** A floating toolbar in the editor allows users to regenerate the active slide with a custom AI prompt, leveraging the `refineSlide` service for targeted updates.
- **Floating Elements:** Users can add independent text and image elements to any slide. 
  - **Text:** Uses the `RichTextEditor` for consistent styling.
  - **Images:** Can be added via direct URL or generated on-the-fly via AI prompts.
  - **Draggable:** Elements use percentage-based positioning (`x`, `y`) to remain responsive and can be repositioned within the slide bounds during Edit Mode.
  - **Snapping & Guides:** Dragging floating elements includes a **snap-to-center** feature (threshold of 1.5%) with visible horizontal/vertical alignment guides for professional layout precision.
- **Improved Workflow:** To maximize focus, "Add Image" and "Regeneration" modals close immediately upon action confirmation (e.g., clicking "Add" or "Generate"). AI-driven actions then show a global "Generating..." status overlay.

### UI/UX: Prompt Field & Wizard
- **Layout Stability:** The header uses fixed-width side containers for the logo (left) and button group (right) to prevent the center prompt from shifting horizontally when buttons animate their inline labels.
- **Prompt Field:** Monitors `prompt.length` and focus state via `isPromptFocused`. Expands to `max-w-full` when focused with ≥ 33 chars using a smooth **500ms ease-in-out** transition. The height is constrained between **34px and 60px** to stabilize the layout, with **useLayoutEffect** ensuring flicker-free auto-resizing.
- **Split Button:** The "Create" button features a split dropdown chevron.
- **Inline Button Labels:** Header icon buttons use a custom `TooltipButton` that expands horizontally on hover to reveal descriptive text labels with a smooth animation.
- **Prompt Wizard:** A comprehensive modal allowing users to choose between exact/approximate counts, grounding files, and custom slide structures.

### Presenter Mode & Auto-Play (High Performance)
- **Mechanism:** Uses the browser's Fullscreen API.
- **Auto-Play Logic:** A toggle in the HUD activates an automated narration sequence.
  - **With Notes:** Uses `gemini-2.5-flash-preview-tts` to generate narration.
  - **Audio Caching:** Implements a slide-id-based caching mechanism (`audioCacheRef`). Entries are invalidated if the corresponding notes are edited.
  - **Prefetching:** Automatically generates and caches the audio for the *next* slide while the *current* slide is playing, ensuring instant transitions.
  - **Notes Sync:** The HUD's speaker notes container auto-scrolls in real-time based on the current audio playback percentage (`progress = currentTime / duration`).
  - **Without Notes:** Slides advance automatically after a **10-second** fallback pause.
  - **Error Handling:** Displays an auto-dismissing toast if audio generation fails, falling back to a standard 10-second timer.
  - **Manual Intervention:** Arrow keys or manual navigation buttons automatically disable Auto-Play mode to return control to the user.
- **Audio Processing:** Implements a raw PCM decoder for Gemini TTS output, ensuring high-fidelity voice playback within an `AudioContext`.
- **Loading State:** The HUD button displays a "Preloading..." state while awaiting the TTS API response. The button remains clickable to allow users to toggle off Auto-Play even while a generation is pending.

### Grounded Content Generation
- Files are parsed on the client (PDF, DOCX via libraries; CSV, TXT, MD via native APIs).
- Images are converted to base64 and sent as multi-modal parts to Gemini.
- Gemini 3 Flash receives all source material as `parts` in the generation request.

---

# RichTextEditor Synchronization Strategy (CRITICAL)

The `RichTextEditor` uses browser-native `contentEditable` for rich formatting.

## Rules
1. **No `dangerouslySetInnerHTML`**: Manage `innerHTML` manually through `editorRef`.
2. **Sync Control**: Only update `innerHTML` from props if the editor is **NOT** focused.
3. **Selection Recovery**: Save and restore range in between formatting commands.
