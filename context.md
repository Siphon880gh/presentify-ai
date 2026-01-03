
# Presentify AI - Project Context

> [!NOTE]
> **Approximate Location Cues:** Line references in this documentation (e.g., "near the middle", "top 25%") are intentional to ensure documentation remains resilient to minor code shifts.

## 1. High-Level Overview
Presentify AI is a professional, AI-powered presentation generation tool. It leverages Google’s Gemini API to transform text prompts into structured multi-slide presentations. Users can edit content in real-time, swap layouts, change transitions, and regenerate AI-driven imagery.

### Tech Stack
- **Framework:** React 19 (via ESM imports)
- **Styling:** Tailwind CSS (via CDN in `index.html`)
- **AI Integration:** `@google/genai` (Gemini 3 Flash for text, Gemini 2.5 Flash for images)
- **Exporting Libraries:** `jspdf` (PDF generation), `html2canvas` (DOM capturing), `pptxgenjs` (PowerPoint generation)
- **Build Tool:** Vite (with custom define for API keys)

## 2. File Tree & Roles
- `App.tsx`: The main orchestrator. Manages presentation state, slide navigation, drag-and-drop reordering, export logic, and modal states.
- `demo/index.ts`: Contains the `DEMO_PRESENTATION` constant for quick loading of a professional example slideshow.
- `components/SlideRenderer.tsx`: Contains the `SlideRenderer` for visual output and the `RichTextEditor` (a complex `contentEditable` wrapper).
- `services/geminiService.ts`: Abstraction layer for Gemini API calls. Handles structured JSON generation for slides and Base64 image generation via `gemini-2.5-flash-image`.
- `types.ts`: Defines `SlideLayout`, `SlideTransition`, and the `Presentation` schema.
- `metadata.json`: App metadata and browser permissions.

## 3. Architecture & Code Flow

### Slide Management (CRITICAL)
- **Reordering:** (Implemented in `App.tsx` sidebar) Uses native HTML5 Drag and Drop. `handleDragStart` sets the source index, `handleDragOver` (near middle of `App.tsx`) performs a live preview swap in the state array and updates the current selection index to follow the dragged slide. `handleDragEnd` cleans up the ghost state.
- **Deletion:** (Implemented in `App.tsx`) Triggered via a trash icon. Uses a confirmation modal (`showDeleteModal`) to prevent accidental data loss. It filters the slides array and safely updates `currentSlideIndex` to the nearest valid neighbor.

### Export Flow (CRITICAL)
- **UI:** A split-button menu in the header with a down chevron providing format options.
- **PDF Format:** Uses a hidden container (`exportContainerRef` at bottom of `App.tsx`) that renders the entire presentation at 1280x720px off-screen. `html2canvas` captures these frames with `useCORS: true` for AI images, and `jsPDF` bundles them into a multi-page landscape document.
- **PPTX Format:** Uses `pptxgenjs` to programmatically build an editable Office file. It maps specific `SlideLayout` enums to corresponding PowerPoint shape and text object configurations (e.g., placing images at specific X/Y coordinates for `IMAGE_LEFT`).

### AI Generation & Demo
- **Generation Flow:** User enters a prompt -> Calls `generatePresentation` -> Model returns JSON -> `App` initiates parallel image generation for all slides using `generateImage` -> State updates with complete content.
- **Demo Flow:** `handleLoadDemo` in `App.tsx` instantly loads the predefined demo presentation from `demo/index.ts` using a static prerendered image (`demo/car.png`) for slides requiring visuals.

### Persistence
- **LocalStorage:** Present at the top of `App.tsx` via `useEffect` and `handleSave`. Saves the entire presentation object and the user's current slide position.

---

# RichTextEditor Synchronization Strategy (CRITICAL)

The `RichTextEditor` uses browser-native `contentEditable` for rich formatting. This requires a specific architectural approach to avoid standard React/DOM synchronization bugs.

> [!IMPORTANT]
> **CRITICAL IMPLEMENTATION GUARDRAIL:** The solutions provided below are strictly mandatory. Any deviation—even for "optimization" or "cleanup"—will immediately re-introduce severe bugs like cursor jumping or focus loss.

## Strict Rules & Solutions

### 1. No `dangerouslySetInnerHTML`
**Problem:** Using `dangerouslySetInnerHTML` on a `contentEditable` element causes React to re-apply the HTML string on every re-render, resetting the cursor to the start.
**Solution:** (Found in `RichTextEditor` near the start of `components/SlideRenderer.tsx`)
- Return an empty `div` (no children) from the component JSX.
- Manage the element's children manually through `editorRef`.

### 2. Preventing "Blank Text" on Mount
**Problem:** Because JSX is empty, the editor appears blank until effects run.
**Solution:**
- Use `useLayoutEffect` (around the middle of the editor component) to set `innerHTML` synchronously.
- Assign a unique `key` to each editor in `SlideRenderer` (e.g., `${slide.id}-title`) to force a full remount when the slide changes.

### 3. Preventing Cursor Jumps during External Sync
**Problem:** If the AI updates content while a user is typing, overwriting the DOM loses the cursor position.
**Solution:**
- Maintain an `internalValueRef` tracking `innerHTML`.
- **SYNC GUARD:** Only update `editorRef.current.innerHTML` in `useEffect` if the prop `value` differs from `internalValueRef` AND the editor is **NOT** focused.

### 4. Toolbar Persistence
**Problem:** Clicking toolbar buttons triggers a `blur` event, closing the toolbar.
**Solution:**
- Wrap editor and toolbar in a container.
- Use `relatedTarget` in `onBlur` (middle of the component) to check if focus stayed within the container.

### 5. History & Undo/Redo
- `RichTextEditor` maintains an internal `historyRef` and `historyIndexRef` to support custom Undo/Redo (Ctrl+Z / Ctrl+Y), bypassing inconsistent browser implementations.
