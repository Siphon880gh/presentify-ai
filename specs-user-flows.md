# Presentify AI - User Flows Specification

## Target Audience

### Primary User Types

| User Type | Description | Primary Goals | Key Pain Points Solved |
|-----------|-------------|---------------|------------------------|
| **Business Professional** | Managers, consultants, analysts who frequently create decks for meetings, pitches, and reports | Fast, professional presentations with minimal design effort | Time spent on slide design and layout |
| **Educator/Trainer** | Teachers, corporate trainers, workshop facilitators | Engaging educational content with clear structure | Transforming content into digestible slides |
| **Student** | Undergraduate/graduate students, researchers | Academic presentations, thesis defenses, project reports | Creating polished slides without design skills |
| **Content Creator/Marketer** | Marketing professionals, social media managers | Visually appealing decks for campaigns and strategies | Generating on-brand visuals and messaging |
| **Executive/Leader** | C-suite, team leads needing keynote-quality decks | High-impact presentations with expert-level content | Communicating complex strategies clearly |

### Secondary Users

| User Type | Description | Use Case |
|-----------|-------------|----------|
| **Sales Representative** | Product demos and pitch decks | Quick generation of customized client presentations |
| **Event Organizer** | Conference and webinar hosts | Speaker support decks and event overviews |
| **Freelancer/Consultant** | Independent professionals | Client deliverables and proposal presentations |

---

## User Journey Maps

### Journey 1: Quick Creation Flow

**Persona:** Business professional with a meeting in 30 minutes  
**Goal:** Generate a professional presentation from a topic instantly

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          QUICK CREATION FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────┐    ┌──────────────┐    ┌─────────────┐    ┌────────────────┐  │
│  │ Landing │───►│ Enter Topic  │───►│ AI Generates│───►│ Review Slides  │  │
│  │  State  │    │ in Header    │    │ Presentation│    │ in Editor      │  │
│  └─────────┘    └──────────────┘    └─────────────┘    └────────────────┘  │
│                                            │                    │          │
│                                            │                    ▼          │
│                                            │           ┌────────────────┐  │
│                                            │           │ Present / Export│  │
│                                            │           └────────────────┘  │
│                                            │                               │
│                                     ┌──────┴──────┐                        │
│                                     │ Mode Toggle │                        │
│                                     ├─────────────┤                        │
│                                     │ • Simple    │                        │
│                                     │ • Advanced  │                        │
│                                     └─────────────┘                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Step-by-Step:**

1. **Entry Point:** User lands on empty editor with prominent topic input
2. **Topic Input:** Types topic (e.g., "Q4 Marketing Strategy")
3. **Mode Selection:** Chooses Simple (standard) or Advanced (expert-level with data points)
4. **Generation:** Clicks "Create" → Full-screen loader appears
5. **Review:** Slides populate in outline panel; first slide shown in preview
6. **Navigation:** Uses arrow keys or outline to browse slides
7. **Exit:** Presents immediately or exports

**Key Interactions:**
- Popover appears on input focus showing mode selector
- Enter key triggers generation
- Arrow keys navigate slides when not in text field

---

### Journey 2: Document-Grounded Creation Flow

**Persona:** Consultant preparing client presentation from research documents  
**Goal:** Create a presentation grounded in uploaded source materials

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DOCUMENT-GROUNDED CREATION FLOW                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────┐    ┌──────────────┐    ┌─────────────────────────────────────┐│
│  │ Landing │───►│ Open Prompt  │───►│        PROMPT WIZARD MODAL          ││
│  │  State  │    │   Wizard     │    │  ┌───────────────────────────────┐  ││
│  └─────────┘    └──────────────┘    │  │ 1. Master Topic               │  ││
│                                      │  ├───────────────────────────────┤  ││
│                                      │  │ 2. Upload Documents           │  ││
│                                      │  │    • PDF, DOCX, TXT, CSV, MD  │  ││
│                                      │  │    • Images (PNG, JPG)        │  ││
│                                      │  │    • URL References           │  ││
│                                      │  ├───────────────────────────────┤  ││
│                                      │  │ 3. Structure Settings         │  ││
│                                      │  │    • Simple / Advanced Mode   │  ││
│                                      │  │    • Slide Count (3-25)       │  ││
│                                      │  │    • Refine Existing Option   │  ││
│                                      │  ├───────────────────────────────┤  ││
│                                      │  │ 4. Slide Focus (Optional)     │  ││
│                                      │  │    • Custom slide topics      │  ││
│                                      │  │    • Drag to reorder          │  ││
│                                      │  └───────────────────────────────┘  ││
│                                      └──────────────────┬──────────────────┘│
│                                                         │                   │
│                                                         ▼                   │
│                                      ┌─────────────────────────────────────┐│
│                                      │     AI Generates Grounded Deck     ││
│                                      └─────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Step-by-Step:**

1. **Open Wizard:** Click dropdown arrow next to "Create" → Select "Prompt Wizard"
2. **Define Topic:** Enter master topic in large textarea
3. **Upload Sources:**
   - Click "Upload" → Select PDF, DOCX, TXT, CSV, MD, or images
   - Files are parsed client-side (PDF.js for PDFs, Mammoth for DOCX)
   - Optionally add URL references for web content
4. **Configure Structure:**
   - Toggle Simple/Advanced content quality mode
   - Set slide count (exact number or qualitative: Few/Moderate/Many/Numerous)
   - If presentation exists, enable "Refine Existing Deck" to update rather than replace
5. **Define Focus (Optional):**
   - Add specific slide topics with details
   - Drag items to reorder structure
6. **Generate:** Click "Create Presentation" → AI processes sources and generates grounded content
7. **Review:** Each slide references source material; images generated via AI

**Supported File Types:**
| Format | Parser | Notes |
|--------|--------|-------|
| PDF | pdfjs-dist | Text extraction per page |
| DOCX | mammoth | Raw text extraction |
| TXT/MD/CSV | Native | Direct text read |
| PNG/JPG/JPEG | Base64 | Sent as multi-modal input to Gemini |

---

### Journey 3: Edit & Customize Flow

**Persona:** User who wants to refine AI-generated content  
**Goal:** Customize slides with rich text editing, layout changes, and visual elements

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EDIT & CUSTOMIZE FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────┐                                                         │
│  │ Enable Edit    │◄─── Click "Edit Mode" button in header                  │
│  │ Mode (Toggle)  │                                                         │
│  └───────┬────────┘                                                         │
│          │                                                                  │
│          ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      EDIT MODE CAPABILITIES                             ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                         ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ ││
│  │  │ Rich Text   │  │ Change      │  │ Add Floating│  │ Regenerate     │ ││
│  │  │ Editing     │  │ Layout      │  │ Elements    │  │ with AI        │ ││
│  │  ├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────────┤ ││
│  │  │ • Bold/Ital │  │ • TITLE     │  │ • Text Box  │  │ • Regenerate   │ ││
│  │  │ • Underline │  │ • BULLETS   │  │ • Image     │  │   Slide        │ ││
│  │  │ • Font Size │  │ • IMG_LEFT  │  │   (URL/AI)  │  │ • Regenerate   │ ││
│  │  │ • Bullets   │  │ • IMG_RIGHT │  │ • Drag/Drop │  │   Image        │ ││
│  │  │ • Alignment │  │ • QUOTE     │  │ • Resize    │  │ • Refine with  │ ││
│  │  │ • Undo/Redo │  │ • TWO_COL   │  │ • Delete    │  │   Prompt       │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │                    SLIDE OUTLINE (Left Panel)                       │││
│  │  ├─────────────────────────────────────────────────────────────────────┤││
│  │  │ • Drag slides to reorder                                           │││
│  │  │ • Click to navigate                                                │││
│  │  │ • Visual indicator for drag position                               │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Edit Mode Features:**

| Feature | Location | Description |
|---------|----------|-------------|
| **Rich Text Toolbar** | Appears on text focus | Bold, Italic, Underline, Font Size, Bullets, Alignment |
| **Layout Selector** | Floating dock (bottom) | Switch between 6 layout types |
| **Add Text Element** | Floating dock | Creates draggable text box |
| **Add Image Element** | Floating dock | URL input or AI-generated image |
| **Regenerate Slide** | Floating dock | AI rewrites slide with optional prompt |
| **Regenerate Image** | Hover on image | Regenerates AI image with same/new prompt |
| **Slide Reorder** | Outline panel | Drag-and-drop with position indicator |
| **Speaker Notes** | Below slide preview | Editable textarea for presenter notes |

**Floating Element Interactions:**
- **Drag:** Move handle on element to reposition
- **Snap:** Elements snap to center guidelines (50% horizontal/vertical)
- **Resize:** Corner handle for proportional resizing
- **Delete:** Trash icon on hover

---

### Journey 4: Presentation Delivery Flow

**Persona:** Presenter ready to deliver their presentation  
**Goal:** Present with AI voice narration and smooth navigation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PRESENTATION DELIVERY FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────────────────────┐│
│  │ Configure    │───►│ Click        │───►│      PRESENTER VIEW            ││
│  │ Voice (Opt)  │    │ "Present"    │    │  (Fullscreen Mode)             ││
│  └──────────────┘    └──────────────┘    │                                ││
│         │                                │  ┌────────────────────────────┐││
│         ▼                                │  │    SLIDE DISPLAY           │││
│  ┌──────────────────────────────────┐   │  │    (Full viewport)         │││
│  │     VOICE SETTINGS MODAL         │   │  └────────────────────────────┘││
│  ├──────────────────────────────────┤   │                                ││
│  │ Default Voice:                    │   │  ┌────────────────────────────┐││
│  │  • Puck (M)  • Kore (F)          │   │  │    HUD (Bottom Bar)        │││
│  │  • Charon (M) • Zephyr (F)       │   │  ├────────────────────────────┤││
│  │  • Fenrir (M)                    │   │  │ • Slide Counter            │││
│  │                                   │   │  │ • Speaker Notes (scroll)  │││
│  │ Slide Override:                   │   │  │ • Auto-Play Toggle        │││
│  │  [Per-slide voice selection]     │   │  │ • Exit Button              │││
│  │                                   │   │  └────────────────────────────┘││
│  │ Autoplay Delay: [0-5000ms]       │   │                                ││
│  └──────────────────────────────────┘   └────────────────────────────────┘│
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        AUTO-PLAY BEHAVIOR                               ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                         ││
│  │  1. User enables Auto-Play                                              ││
│  │  2. System fetches TTS audio for current slide notes                    ││
│  │  3. Audio plays; speaker notes scroll in sync                           ││
│  │  4. After audio ends, waits [autoplayDelay] ms                          ││
│  │  5. Advances to next slide automatically                                ││
│  │  6. Prefetches next slide's audio in parallel                           ││
│  │  7. Repeats until last slide or user interrupts                         ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Keyboard Controls in Presenter View:**

| Key | Action |
|-----|--------|
| `→` or `Space` | Next slide (stops auto-play) |
| `←` | Previous slide (stops auto-play) |
| `Escape` | Exit presentation mode |

**Voice Features:**
- **5 Available Voices:** Puck, Charon, Kore, Fenrir, Zephyr
- **Gender Indicators:** (M) or (F) displayed next to each voice
- **Preview:** Click play button to hear voice sample
- **Per-Slide Override:** Assign different voice to specific slides
- **Instant Playback:** Voices pre-fetched when modal opens

---

### Journey 5: Export & Share Flow

**Persona:** User who needs to share presentation outside the app  
**Goal:** Export to standard formats (PDF, PowerPoint)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXPORT & SHARE FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────────────────────────────────────────┐  │
│  │ Click Export │───►│              EXPORT MENU                         │  │
│  │   Button     │    │  ┌────────────────────────────────────────────┐  │  │
│  └──────────────┘    │  │ Export as PDF                              │  │  │
│                      │  │ • Renders each slide at 1280x720           │  │  │
│                      │  │ • Uses html2canvas for capture             │  │  │
│                      │  │ • Compiles with jsPDF                      │  │  │
│                      │  ├────────────────────────────────────────────┤  │  │
│                      │  │ Export as PPTX                             │  │  │
│                      │  │ • Uses pptxgenjs library                   │  │  │
│                      │  │ • Preserves layouts and images             │  │  │
│                      │  │ • Includes speaker notes                   │  │  │
│                      │  └────────────────────────────────────────────┘  │  │
│                      └──────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        EXPORT SPECIFICATIONS                            ││
│  ├──────────────┬────────────────────┬─────────────────────────────────────┤│
│  │ Format       │ Resolution         │ Features Preserved                  ││
│  ├──────────────┼────────────────────┼─────────────────────────────────────┤│
│  │ PDF          │ 1280x720 @ 1.5x    │ Visual fidelity, images, text       ││
│  │ PPTX         │ 16:9 aspect        │ Layouts, images, notes, bullets     ││
│  └──────────────┴────────────────────┴─────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Journey 6: Save & Continue Flow

**Persona:** User working on presentation over multiple sessions  
**Goal:** Save progress and resume later

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SAVE & CONTINUE FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                       AUTOMATIC SESSION SYNC                            ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │ • Current presentation auto-saved to localStorage every second          ││
│  │ • Images stored separately to avoid quota limits                        ││
│  │ • On reload, automatically restores last session                        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌───────────────────┐    ┌───────────────────────────────────────────────┐│
│  │ Click "Save"      │───►│            SAVE MODAL                         ││
│  │ Button            │    │  • Enter presentation title                   ││
│  └───────────────────┘    │  • Saves to Library (localStorage)            ││
│                           │  • Updates presentation title                 ││
│                           └───────────────────────────────────────────────┘│
│                                                                             │
│  ┌───────────────────┐    ┌───────────────────────────────────────────────┐│
│  │ Click "Open"      │───►│            LIBRARY MODAL                      ││
│  │ Button            │    │  ┌───────────────────────────────────────┐    ││
│  └───────────────────┘    │  │ Saved Presentation 1                  │    ││
│                           │  │ 10 Slides • Saved Jan 15, 2026       │    ││
│                           │  │                          [Open]      │    ││
│                           │  ├───────────────────────────────────────┤    ││
│                           │  │ Saved Presentation 2                  │    ││
│                           │  │ 8 Slides • Saved Jan 10, 2026        │    ││
│                           │  │                          [Open]      │    ││
│                           │  └───────────────────────────────────────┘    ││
│                           └───────────────────────────────────────────────┘│
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                       STORAGE ARCHITECTURE                              ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │ Key                           │ Content                                 ││
│  ├───────────────────────────────┼─────────────────────────────────────────┤│
│  │ presentify_current            │ Active session (presentation + index)  ││
│  │ presentify_library            │ Array of saved presentation metadata   ││
│  │ presentify_pres_{id}          │ Full presentation JSON (minus images)  ││
│  │ presentify_img_{presId}_{sid} │ Individual slide images (base64)       ││
│  └───────────────────────────────┴─────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Feature Reference Matrix

| Feature | Quick Create | Wizard | Edit Mode | Presenter | Export |
|---------|:------------:|:------:|:---------:|:---------:|:------:|
| Topic Input | ✓ | ✓ | — | — | — |
| File Upload | — | ✓ | — | — | — |
| Mode Selection (Simple/Advanced) | ✓ | ✓ | — | — | — |
| Slide Count Control | — | ✓ | — | — | — |
| Custom Slide Focus | — | ✓ | — | — | — |
| Rich Text Editing | — | — | ✓ | — | — |
| Layout Switching | — | — | ✓ | — | — |
| Floating Elements | — | — | ✓ | — | — |
| AI Slide Regeneration | — | — | ✓ | — | — |
| AI Image Generation | ✓ | ✓ | ✓ | — | — |
| Slide Reordering | — | — | ✓ | — | — |
| Voice Configuration | — | — | ✓ | ✓ | — |
| Auto-Play Narration | — | — | — | ✓ | — |
| Keyboard Navigation | ✓ | — | ✓ | ✓ | — |
| PDF Export | — | — | — | — | ✓ |
| PPTX Export | — | — | — | — | ✓ |

---

## UI State Transitions

```
                                    ┌─────────────┐
                                    │   EMPTY     │
                                    │   STATE     │
                                    └──────┬──────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
            ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
            │ Quick Create  │      │ Prompt Wizard │      │ Load Demo     │
            └───────┬───────┘      └───────┬───────┘      └───────┬───────┘
                    │                      │                      │
                    └──────────────────────┼──────────────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  GENERATING │
                                    │   (Loader)  │
                                    └──────┬──────┘
                                           │
                                           ▼
                              ┌────────────────────────┐
                              │                        │
                              │     EDITOR VIEW        │
                              │  (Presentation Loaded) │
                              │                        │
                              └───────────┬────────────┘
                                          │
           ┌──────────────────────────────┼──────────────────────────────┐
           │                              │                              │
           ▼                              ▼                              ▼
    ┌─────────────┐               ┌─────────────┐                ┌─────────────┐
    │ EDIT MODE   │               │ PRESENTER   │                │  EXPORT     │
    │ (Toggle)    │               │    VIEW     │                │  (Menu)     │
    └─────────────┘               │ (Fullscreen)│                └─────────────┘
                                  └─────────────┘
```

---

## Error States & Recovery

| Scenario | User Feedback | Recovery Action |
|----------|---------------|-----------------|
| Generation fails | Alert: "Generation failed" | Retry with different prompt |
| Image generation fails | Silent fail, placeholder shown | Click to regenerate image |
| TTS generation fails | Toast: "Failed to generate narration" | Auto-advance after 10s |
| File parse error | Upload error message displayed | Remove file, try different format |
| Session storage full | Console warning | Images may not persist |

---

## Accessibility Considerations

- **Keyboard Navigation:** Full arrow key support in editor and presenter views
- **Focus Management:** Text inputs block slide navigation when focused
- **Loading States:** Full-screen loaders with descriptive text
- **Tooltips:** Expandable button labels on hover

---

## Performance Optimizations

1. **Audio Pre-fetching:** Voice previews loaded when settings modal opens
2. **Parallel Audio Cache:** Next slide audio fetched during current playback
3. **Lazy Parsing:** PDF.js and Mammoth loaded dynamically on first use
4. **Image Storage:** Base64 images stored separately to manage localStorage quota
5. **Debounced Saves:** Session sync debounced to 1 second intervals
