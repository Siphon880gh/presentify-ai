# RichTextEditor Synchronization Strategy

The `RichTextEditor` uses browser-native `contentEditable` for rich formatting. This requires a specific architectural approach to avoid standard React/DOM synchronization bugs.

> [!IMPORTANT]
> **CRITICAL IMPLEMENTATION GUARDRAIL:** The solutions provided below are strictly mandatory. Any deviation—even for "optimization" or "cleanup"—will immediately re-introduce the severe bugs described in the **Problem** sections (e.g., cursor jumping to start, lost focus, or component flickering).

## Strict Rules & Solutions

### 1. No `dangerouslySetInnerHTML`
**Problem:** Using `dangerouslySetInnerHTML` on a `contentEditable` element causes React to re-apply the HTML string on every re-render of the parent. This resets the browser's selection state and moves the cursor/caret to the start of the element.
**Solution:**
- **NEVER** use `dangerouslySetInnerHTML` in the `RichTextEditor`'s JSX.
- Return an empty `div` (no children) from the component.
- Manage the element's children manually through the `editorRef`.

### 2. Preventing "Blank Text" on Mount
**Problem:** Because React's JSX is empty, the editor appears blank until the first `useEffect` runs.
**Solution:**
- Use `useLayoutEffect` with an empty dependency array to set `innerHTML` synchronously before the browser paints.
- Assign a unique `key` to each editor in `SlideRenderer` (e.g., `${slide.id}-title`). This forces a full remount when the slide changes, triggering `useLayoutEffect` for the new content.

### 3. Preventing Cursor Jumps during External Sync
**Problem:** When the AI updates slide content, we need the UI to reflect it, but we must not overwrite the user's current typing. If overwritten, the cursor position is lost.
**Solution:**
- Maintain an `internalValueRef` that tracks the current `innerHTML`.
- Use a `useEffect` that monitors the `value` prop.
- **SYNC GUARD:** Only update the `editorRef.current.innerHTML` if:
  1. The prop `value` differs from `internalValueRef.current`.
  2. The editor is **NOT** focused (`!isFocused`).
- This ensures that while the user is typing, the DOM is left alone. When the user blurs or a different slide is selected, synchronization resumes safely.

### 4. Toolbar Persistence During Interaction
**Problem:** Clicking a dropdown (like font size) or a button in the formatting toolbar can trigger a `blur` event on the `contentEditable` div, closing the toolbar prematurely and breaking the user's workflow.
**Solution:**
- Wrap the editor and toolbar in a common container `div`.
- Track focus at the container level.
- Use the `relatedTarget` property in the `onBlur` event to check if the new focus target is still within the container. If it is, do not set `isFocused` to false.
- This allows users to interact with toolbar controls without the popover disappearing.

### 5. Event Handling
- Use `onInput` to update `internalValueRef` in real-time.
- Use `onBlur` (at the container level) to trigger the parent's `onUpdate` state change. This keeps parent re-renders to a minimum and prevents "bounce-back" loops where typing triggers a state update that triggers a re-render.