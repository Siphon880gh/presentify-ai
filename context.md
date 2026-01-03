
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

### Presenter Mode Synchronization
- **Mechanism:** Leverages `localStorage` combined with the browser's `storage` event.
- **Flow:** When the user navigates or edits in the `EditorView`, the state is saved to `localStorage`. The `PresenterView` listens for these changes and updates its UI in real-time. Navigation in the `PresenterView` also updates `localStorage`.

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
