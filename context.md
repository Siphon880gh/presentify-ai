
# Presentify AI - Project Context

> [!NOTE]
> **Approximate Location Cues:** Line references in this documentation (e.g., "near the middle", "top 25%") are intentional to ensure documentation remains resilient to minor code shifts.

## 1. High-Level Overview
Presentify AI is a professional, AI-powered presentation generation tool. It leverages Google’s Gemini API to transform text prompts into structured multi-slide presentations. Users can edit content in real-time, swap layouts, change transitions, and regenerate AI-driven imagery.

### Tech Stack
- **Framework:** React 19 (via ESM imports)
- **Styling:** Tailwind CSS (via CDN in `index.html`)
- **AI Integration:** `@google/genai` (Gemini 3 Flash for text, Gemini 2.5 Flash for images)
- **Build Tool:** Vite (with custom define for API keys)

## 2. File Tree & Roles
- `App.tsx`: The main orchestrator. Manages presentation state, slide navigation, drag-and-drop reordering, and modal states. Initial generation now uses `Promise.all` to generate real AI images for every slide.
- `components/SlideRenderer.tsx`: Contains the `SlideRenderer` for visual output and the `RichTextEditor` (a complex `contentEditable` wrapper).
- `services/geminiService.ts`: Abstraction layer for Gemini API calls. Handles structured JSON generation for slides and Base64 image generation via `gemini-2.5-flash-image`.
- `types.ts`: Defines `SlideLayout`, `SlideTransition`, and the `Presentation` schema.
- `metadata.json`: App metadata and browser permissions.

## 3. Architecture & Code Flow
1. **Generation Flow:** User enters a prompt in `App.tsx` (top 20%) -> Calls `generatePresentation` in `geminiService.ts` -> Model returns JSON -> `App` initiates parallel image generation for all slides using `generateImage` -> State updates with complete text and visual content.
2. **Editing Flow:** `SlideRenderer` renders the current slide based on `currentSlideIndex`. Title and content items use `RichTextEditor` for formatting.
3. **Persistence:** `localStorage` is used in `App.tsx` (near the top) to save and reload presentations.

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
