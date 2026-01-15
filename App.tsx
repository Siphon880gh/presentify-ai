import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Presentation, Slide, SlideLayout, SlideTransition } from './types';
import { generatePresentation, generateImage, refineSlide } from './services/geminiService';
import SlideRenderer from './components/SlideRenderer';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import pptxgen from 'pptxgenjs';
import { DEMO_PRESENTATION } from './demo';

// Dynamic imports for heavy parsing libs
const getPdfLib = async () => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
  return pdfjs;
};
const getMammoth = () => import('mammoth');

// Storage keys
const STORAGE_CURRENT = 'presentify_current';
const STORAGE_LIBRARY = 'presentify_library';
const STORAGE_PRES_PREFIX = 'presentify_pres_';
const STORAGE_IMG_PREFIX = 'presentify_img_';

// Wizard Topic Interface
interface WizardTopic {
  id: string;
  title: string;
  detail: string;
}

interface WizardFile {
  id: string;
  name: string;
  type: string;
  content: string; // text content or base64
  isImage: boolean;
  mimeType: string;
}

// Storage helpers
interface SavedPresentationMeta {
  id: string;
  title: string;
  savedAt: string;
  slideCount: number;
}

const stripImagesFromPresentation = (pres: Presentation): { presentation: Presentation; images: Record<string, string> } => {
  const images: Record<string, string> = {};
  const slides = pres.slides.map(slide => {
    if (slide.imageUrl) {
      images[slide.id] = slide.imageUrl;
    }
    return { ...slide, imageUrl: '' };
  });
  return { presentation: { ...pres, slides }, images };
};

const saveImagesToStorage = (presId: string, images: Record<string, string>) => {
  Object.entries(images).forEach(([slideId, imageUrl]) => {
    if (imageUrl) {
      try {
        localStorage.setItem(`${STORAGE_IMG_PREFIX}${presId}_${slideId}`, imageUrl);
      } catch (e) {
        console.warn(`Failed to save image for slide ${slideId}`, e);
      }
    }
  });
};

const loadImagesFromStorage = (presId: string, slides: Slide[]): Slide[] => {
  return slides.map(slide => {
    const storedImage = localStorage.getItem(`${STORAGE_IMG_PREFIX}${presId}_${slide.id}`);
    return storedImage ? { ...slide, imageUrl: storedImage } : slide;
  });
};

const deleteImagesFromStorage = (presId: string, slideIds: string[]) => {
  slideIds.forEach(slideId => {
    localStorage.removeItem(`${STORAGE_IMG_PREFIX}${presId}_${slideId}`);
  });
};

const getLibrary = (): SavedPresentationMeta[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_LIBRARY) || '[]');
  } catch {
    return [];
  }
};

const saveToLibrary = (meta: SavedPresentationMeta) => {
  const library = getLibrary().filter(p => p.id !== meta.id);
  library.unshift(meta);
  localStorage.setItem(STORAGE_LIBRARY, JSON.stringify(library));
};

const EditorView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImageGenerating, setIsImageGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isOutlineCollapsed, setIsOutlineCollapsed] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showImagePromptModal, setShowImagePromptModal] = useState(false);
  const [showRegenSlideModal, setShowRegenSlideModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [tempImagePrompt, setTempImagePrompt] = useState('');
  const [tempRegenPrompt, setTempRegenPrompt] = useState('');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedLibrary, setSavedLibrary] = useState<SavedPresentationMeta[]>([]);
  const [isFullscreenPresenting, setIsFullscreenPresenting] = useState(false);

  // Wizard state
  const [showWizardDropdown, setShowWizardDropdown] = useState(false);
  const [showPromptWizard, setShowPromptWizard] = useState(false);
  const [wizardPrompt, setWizardPrompt] = useState('');
  const [wizardSlideCount, setWizardSlideCount] = useState(8);
  const [wizardTopics, setWizardTopics] = useState<WizardTopic[]>([]);
  const [wizardFiles, setWizardFiles] = useState<WizardFile[]>([]);
  const [wizardUrls, setWizardUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  
  const isExpanded = isPromptFocused && prompt.length >= 33;
  const exportContainerRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize prompt textarea
  useEffect(() => {
    if (promptRef.current) {
      promptRef.current.style.height = 'auto';
      promptRef.current.style.height = `${promptRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (showExportMenu && !target.closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
      if (showWizardDropdown && !target.closest('.wizard-dropdown-container')) {
        setShowWizardDropdown(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [showExportMenu, showWizardDropdown]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_CURRENT);
    if (savedData) {
      try {
        const { presentation: savedPres, index, savedAt } = JSON.parse(savedData);
        if (savedPres && Array.isArray(savedPres.slides)) {
          const slidesWithImages = loadImagesFromStorage(savedPres.id, savedPres.slides);
          setPresentation({ ...savedPres, slides: slidesWithImages });
          const validIndex = Math.min(index || 0, savedPres.slides.length - 1);
          setCurrentSlideIndex(Math.max(0, validIndex));
          setLastSaved(savedAt);
        }
      } catch (e) {
        console.error("Failed to load saved presentation", e);
      }
    }
  }, []);

  // Listen for storage changes from Presenter mode
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_CURRENT && e.newValue) {
        try {
          const { index } = JSON.parse(e.newValue);
          if (index !== undefined) {
            setPresentation(prev => {
              if (!prev) return prev;
              const validIndex = Math.min(index, prev.slides.length - 1);
              setCurrentSlideIndex(Math.max(0, validIndex));
              return prev;
            });
          }
        } catch (err) {
          console.error("Storage sync failed", err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Sync current session to localStorage
  const syncToCurrentStorage = useCallback(() => {
    if (!presentation) return;
    try {
      const { presentation: presWithoutImages } = stripImagesFromPresentation(presentation);
      const savedAt = new Date().toLocaleTimeString();
      const dataToSave = {
        presentation: presWithoutImages,
        index: currentSlideIndex,
        savedAt
      };
      localStorage.setItem(STORAGE_CURRENT, JSON.stringify(dataToSave));
      const images: Record<string, string> = {};
      presentation.slides.forEach(slide => {
        if (slide.imageUrl) images[slide.id] = slide.imageUrl;
      });
      saveImagesToStorage(presentation.id, images);
      setLastSaved(savedAt);
    } catch (e) {
      console.warn("Session sync failed", e);
    }
  }, [presentation, currentSlideIndex]);

  useEffect(() => {
    if (presentation) {
      const timeout = setTimeout(syncToCurrentStorage, 1000);
      return () => clearTimeout(timeout);
    }
  }, [presentation, currentSlideIndex, syncToCurrentStorage]);

  // File parsing logic
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsParsingFiles(true);
    const newWizardFiles: WizardFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = Math.random().toString(36).substr(2, 9);
      try {
        if (file.type.startsWith('image/')) {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          newWizardFiles.push({ id, name: file.name, type: file.type, content: base64, isImage: true, mimeType: file.type });
        } else if (file.type === 'application/pdf') {
          const pdfjs = await getPdfLib();
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          let fullText = '';
          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
          }
          newWizardFiles.push({ id, name: file.name, type: file.type, content: fullText, isImage: false, mimeType: file.type });
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const mammoth = await getMammoth();
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          newWizardFiles.push({ id, name: file.name, type: file.type, content: result.value, isImage: false, mimeType: file.type });
        } else if (file.type === 'text/plain' || file.type === 'text/csv' || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
          const text = await file.text();
          newWizardFiles.push({ id, name: file.name, type: file.type, content: text, isImage: false, mimeType: file.type });
        } else {
          alert(`Unsupported file type: ${file.name}`);
        }
      } catch (err) {
        console.error(`Failed to parse ${file.name}`, err);
        alert(`Error parsing ${file.name}. It might be corrupted or protected.`);
      }
    }
    setWizardFiles(prev => [...prev, ...newWizardFiles]);
    setIsParsingFiles(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeWizardFile = (id: string) => {
    setWizardFiles(wizardFiles.filter(f => f.id !== id));
  };

  const addUrl = async () => {
    if (!urlInput.trim()) return;
    const url = urlInput.trim();
    if (!url.startsWith('http')) {
      alert('Please enter a valid URL (starting with http:// or https://)');
      return;
    }
    setWizardUrls(prev => [...prev, url]);
    setUrlInput('');
  };

  const removeUrl = (index: number) => {
    setWizardUrls(wizardUrls.filter((_, i) => i !== index));
  };

  const handleGenerate = async (useHeaderPrompt = true, overridePrompt?: string, context?: { text: string[], images: {data: string, mimeType: string}[] }) => {
    const targetPrompt = overridePrompt || (useHeaderPrompt ? prompt : (presentation?.title || prompt));
    if (!targetPrompt.trim()) return;
    setIsGenerating(true);
    setStatusMessage('Generating grounded presentation...');
    
    try {
      const data = await generatePresentation(targetPrompt, context);
      const slidesWithIds = data.slides.map((s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9),
        imageUrl: '',
      }));
      
      const newPresentation: Presentation = {
        id: Math.random().toString(36).substr(2, 9),
        title: data.title,
        slides: slidesWithIds
      };

      setPresentation(newPresentation);
      setCurrentSlideIndex(0);
      setLastSaved(null);
      setIsGenerating(false);

      for (let i = 0; i < slidesWithIds.length; i++) {
        const slide = slidesWithIds[i];
        if (slide.imagePrompt) {
          try {
            const imageUrl = await generateImage(slide.imagePrompt);
            setPresentation(prev => {
              if (!prev || prev.id !== newPresentation.id) return prev;
              const updatedSlides = [...prev.slides];
              if (updatedSlides[i]) updatedSlides[i] = { ...updatedSlides[i], imageUrl };
              return { ...prev, slides: updatedSlides };
            });
          } catch (e) {
            console.error(`Visual generation failed for slide ${i}`, e);
          }
        }
      }
    } catch (error) {
      console.error(error);
      alert('Failed to generate presentation. Please try again.');
      setIsGenerating(false);
    } finally {
      setStatusMessage('');
    }
  };

  const handleWizardSubmit = async () => {
    let finalPrompt = `Topic: ${wizardPrompt}\nSlide Count: ${wizardSlideCount}\n`;
    if (wizardTopics.length > 0) {
      finalPrompt += `Specific Structure & Order:\n`;
      wizardTopics.forEach((t, i) => {
        finalPrompt += `${i + 1}. ${t.title}: ${t.detail}\n`;
      });
    }

    const contextTexts = wizardFiles.filter(f => !f.isImage).map(f => `FILE: ${f.name}\n${f.content}`);
    
    // Attempt to fetch URL contents (Note: subject to CORS restrictions)
    setStatusMessage('Reading source URLs...');
    for (const url of wizardUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const html = await res.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const bodyText = doc.body.innerText.replace(/\s+/g, ' ').trim().substring(0, 10000); // Sample content
          contextTexts.push(`URL: ${url}\nCONTENT: ${bodyText}`);
        } else {
          contextTexts.push(`URL: ${url} (Fetch failed - treating as reference only)`);
        }
      } catch (e) {
        console.warn(`Could not fetch content for ${url} due to CORS or network error.`, e);
        contextTexts.push(`URL: ${url} (CORS Restricted - treating as known reference)`);
      }
    }

    const contextImages = wizardFiles.filter(f => f.isImage).map(f => ({ data: f.content, mimeType: f.mimeType }));

    handleGenerate(false, finalPrompt, { text: contextTexts, images: contextImages });
    setShowPromptWizard(false);
  };

  // Other UI handlers
  const openSaveModal = useCallback(() => {
    if (!presentation) return;
    setSaveName(presentation.title.replace(/<[^>]*>/g, ''));
    setShowSaveModal(true);
  }, [presentation]);

  const openLoadModal = useCallback(() => {
    setSavedLibrary(getLibrary());
    setShowOpenModal(true);
  }, []);

  const handleSaveToLibrary = useCallback(() => {
    if (!presentation || !saveName.trim()) return;
    try {
      const presId = presentation.id;
      const { presentation: presWithoutImages, images } = stripImagesFromPresentation(presentation);
      const presWithTitle = { ...presWithoutImages, title: saveName.trim() };
      localStorage.setItem(`${STORAGE_PRES_PREFIX}${presId}`, JSON.stringify(presWithTitle));
      saveImagesToStorage(presId, images);
      const meta: SavedPresentationMeta = {
        id: presId,
        title: saveName.trim(),
        savedAt: new Date().toISOString(),
        slideCount: presentation.slides.length
      };
      saveToLibrary(meta);
      setPresentation({ ...presentation, title: saveName.trim() });
      setShowSaveModal(false);
      setSaveName('');
      setLastSaved(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Failed to save", e);
      alert('Failed to save presentation.');
    }
  }, [presentation, saveName]);

  const handleLoadFromLibrary = useCallback((meta: SavedPresentationMeta) => {
    try {
      const savedData = localStorage.getItem(`${STORAGE_PRES_PREFIX}${meta.id}`);
      if (!savedData) return;
      const loadedPres = JSON.parse(savedData) as Presentation;
      const slidesWithImages = loadImagesFromStorage(meta.id, loadedPres.slides);
      setPresentation({ ...loadedPres, slides: slidesWithImages });
      setCurrentSlideIndex(0);
      setShowOpenModal(false);
      setLastSaved(new Date(meta.savedAt).toLocaleTimeString());
    } catch (e) {
      console.error("Load failed", e);
    }
  }, []);

  const handleDeleteFromLibrary = useCallback((meta: SavedPresentationMeta) => {
    const library = getLibrary().filter(p => p.id !== meta.id);
    localStorage.setItem(STORAGE_LIBRARY, JSON.stringify(library));
    setSavedLibrary(library);
    localStorage.removeItem(`${STORAGE_PRES_PREFIX}${meta.id}`);
  }, []);

  const openWizard = () => {
    setWizardPrompt(prompt);
    setShowPromptWizard(true);
    setShowWizardDropdown(false);
  };

  const resetWizard = () => {
    setWizardPrompt('');
    setWizardSlideCount(8);
    setWizardTopics([]);
    setWizardFiles([]);
    setWizardUrls([]);
  };

  const addWizardTopic = () => {
    setWizardTopics([...wizardTopics, { id: Math.random().toString(36).substr(2, 9), title: '', detail: '' }]);
  };

  const updateWizardTopic = (id: string, field: keyof WizardTopic, value: string) => {
    setWizardTopics(wizardTopics.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const moveWizardTopic = (index: number, direction: 'up' | 'down') => {
    const newTopics = [...wizardTopics];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newTopics.length) return;
    [newTopics[index], newTopics[targetIndex]] = [newTopics[targetIndex], newTopics[index]];
    setWizardTopics(newTopics);
  };

  const handleExportPDF = async () => {
    if (!presentation) return;
    setShowExportMenu(false);
    setIsExporting(true);
    setStatusMessage('Capturing high-resolution PDF...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      if (!exportContainerRef.current) throw new Error("Capture container missing");
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1280, 720] });
      const slideElements = Array.from(exportContainerRef.current.children);
      for (let i = 0; i < slideElements.length; i++) {
        setStatusMessage(`Processing slide ${i + 1} of ${slideElements.length}...`);
        const canvas = await html2canvas(slideElements[i] as HTMLElement, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', width: 1280, height: 720 });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 1280, 720);
      }
      pdf.save(`${presentation.title.replace(/<[^>]*>/g, '').substring(0, 30)}.pdf`);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setStatusMessage('');
    }
  };

  const handleExportPPTX = () => {
    if (!presentation) return;
    setShowExportMenu(false);
    setIsExporting(true);
    setStatusMessage('Creating PowerPoint file...');
    try {
      const pptx = new (pptxgen as any)();
      pptx.title = presentation.title;
      pptx.layout = 'LAYOUT_16x9';
      presentation.slides.forEach((slide) => {
        const pSlide = pptx.addSlide();
        const cleanTitle = slide.title.replace(/<[^>]*>/g, '');
        pSlide.addText(cleanTitle, { x: 0.5, y: 0.5, w: '90%', fontSize: 32, bold: true, color: '4F46E5' });
        const cleanContent = slide.content.map(c => c.replace(/<[^>]*>/g, ''));
        pSlide.addText(cleanContent.map(text => ({ text, options: { bullet: true, margin: 5 } })), { x: 0.5, y: 1.5, w: '90%', fontSize: 18, color: '444444' });
      });
      pptx.writeFile({ fileName: `${presentation.title.replace(/<[^>]*>/g, '').substring(0, 30)}.pptx` });
    } catch (error) {
      console.error('PPTX failed:', error);
    } finally {
      setIsExporting(false);
      setStatusMessage('');
    }
  };

  const updateSlide = useCallback((updatedSlide: Slide) => {
    setPresentation(prev => {
      if (!prev) return null;
      const newSlides = prev.slides.map(s => s.id === updatedSlide.id ? updatedSlide : s);
      return { ...prev, slides: newSlides };
    });
  }, []);

  const openPresenterMode = async () => {
    syncToCurrentStorage();
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreenPresenting(true);
    } catch (e) {
      console.error('Fullscreen failed', e);
    }
  };

  const exitPresenterMode = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    setIsFullscreenPresenting(false);
  };

  const activeSlide = useMemo(() => {
    if (!presentation || !presentation.slides) return null;
    const index = Math.min(currentSlideIndex, presentation.slides.length - 1);
    return presentation.slides[Math.max(0, index)];
  }, [presentation, currentSlideIndex]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 overflow-hidden h-screen">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50 shrink-0">
        <div className={`flex items-center space-x-2 transition-all duration-300 ease-out ${isExpanded ? 'max-w-0 opacity-0 pointer-events-none overflow-hidden' : 'max-w-xs'}`}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            Presentify AI
          </h1>
        </div>

        <div className={`flex-1 px-8 flex items-center space-x-2 transition-all duration-300 ease-out ${isExpanded ? 'max-w-full' : 'max-w-2xl'}`}>
          <div className="relative flex-1 group flex items-end">
            <textarea
              ref={promptRef}
              rows={1}
              placeholder="Enter a new topic for a full slideshow..."
              className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-0 rounded-2xl py-2.5 px-6 pr-32 transition-all outline-none resize-none overflow-hidden"
              style={{ minHeight: '34px', maxHeight: '160px' }}
              value={prompt}
              onFocus={() => setIsPromptFocused(true)}
              onBlur={() => setIsPromptFocused(false)}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate(true);
                }
              }}
            />
            <div className="absolute right-1 bottom-1.5 flex items-center wizard-dropdown-container">
              <button 
                onClick={() => handleGenerate(true)}
                disabled={isGenerating}
                className="h-8 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-l-full text-sm font-medium transition-colors border-r border-indigo-500"
              >
                {isGenerating ? '...' : 'Create'}
              </button>
              <button 
                onClick={() => setShowWizardDropdown(!showWizardDropdown)}
                disabled={isGenerating}
                className="h-8 px-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-r-full text-sm font-medium transition-colors"
              >
                <svg className={`w-4 h-4 transition-transform duration-200 ${showWizardDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showWizardDropdown && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] p-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <button 
                    onClick={openWizard}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-indigo-50 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-slate-800">Prompt Wizard</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`flex items-center space-x-3 transition-all duration-300 ease-out ${isExpanded ? 'max-w-0 opacity-0 pointer-events-none overflow-hidden' : 'max-w-md'}`}>
           <button 
            onClick={openLoadModal}
            className="flex items-center space-x-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm"
           >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
             </svg>
             <span>Open</span>
           </button>

           {presentation && (
             <>
               <button 
                onClick={openPresenterMode}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
               >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                 </svg>
                 <span>Present</span>
               </button>
             </>
           )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className={`${isOutlineCollapsed ? 'w-16' : 'w-72'} bg-white border-r flex flex-col transition-all duration-300 shrink-0`}>
          <div className="p-4 flex items-center justify-between border-b shrink-0">
            {!isOutlineCollapsed && (
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Outline</h3>
            )}
            <button 
              onClick={() => setIsOutlineCollapsed(!isOutlineCollapsed)}
              className="p-1 hover:bg-slate-100 rounded-md text-slate-400"
            >
              <svg className={`w-5 h-5 transform transition-transform ${isOutlineCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto py-2 px-2 custom-scrollbar">
            {!isOutlineCollapsed ? (
              <div className="space-y-1">
                {presentation?.slides.map((slide, index) => (
                  <div
                    key={slide.id}
                    className={`group relative flex items-center p-2 rounded-lg cursor-pointer transition-all ${
                      currentSlideIndex === index ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-600'
                    }`}
                    onClick={() => setCurrentSlideIndex(index)}
                  >
                    <div className="mr-3 text-xs font-mono opacity-30 w-4">{index + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" dangerouslySetInnerHTML={{ __html: slide.title || 'Untitled Slide' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4 pt-2">
                {presentation?.slides.map((_, index) => (
                  <button key={index} onClick={() => setCurrentSlideIndex(index)} className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${currentSlideIndex === index ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                    {index + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1 overflow-y-auto p-12 bg-slate-100 flex flex-col items-center custom-scrollbar">
          {(isGenerating || isExporting || isParsingFiles) && statusMessage && (
            <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
               <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
               <p className="text-xl font-medium text-slate-800 animate-pulse">{statusMessage}</p>
            </div>
          )}

          {presentation && activeSlide ? (
            <div className="w-full max-w-5xl space-y-6">
              <SlideRenderer key={activeSlide.id} slide={activeSlide} onUpdate={updateSlide} isActive={true} />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mt-20">
              <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-indigo-100/50">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Create Professional Slides</h2>
              <p className="text-slate-500 mb-10 leading-relaxed text-lg">Enter a topic and watch as our AI creates a fully structured presentation grounded in your documents and web sources.</p>
            </div>
          )}
        </div>
      </main>

      {/* Prompt Wizard Modal */}
      {showPromptWizard && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl max-h-[95vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in slide-in-from-bottom-4 duration-400">
            <div className="p-6 border-b flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 leading-tight">Prompt Wizard</h3>
                  <p className="text-xs text-slate-500">Fine-tune your presentation structure with source material</p>
                </div>
              </div>
              <button onClick={() => setShowPromptWizard(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              <section className="space-y-3">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-widest">Main Topic / Context</label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl p-4 text-sm outline-none transition-all h-24 resize-none font-medium text-slate-700 shadow-inner"
                  placeholder="What is this presentation about?"
                  value={wizardPrompt}
                  onChange={(e) => setWizardPrompt(e.target.value)}
                />
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Reference Materials Area */}
                <section className="space-y-4">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-widest block">Reference Material</label>
                  
                  {/* Documents */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Documents (PDF, DOCX, CSV, TXT, Images)</span>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold hover:bg-indigo-100"
                      >
                        Upload Files
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        multiple 
                        accept=".pdf,.docx,.txt,.csv,.jpg,.jpeg,.png" 
                        onChange={handleFileUpload}
                      />
                    </div>
                    
                    <div className="min-h-[100px] bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                      {wizardFiles.length === 0 ? (
                        <p className="text-center text-slate-400 text-[11px] py-8">No documents uploaded</p>
                      ) : (
                        wizardFiles.map(file => (
                          <div key={file.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 group">
                            <div className="flex items-center space-x-2 min-w-0">
                              <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center ${file.isImage ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                {file.isImage ? (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                )}
                              </div>
                              <span className="text-[11px] font-bold text-slate-700 truncate">{file.name}</span>
                            </div>
                            <button onClick={() => removeWizardFile(file.id)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* URLs */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-500">Web Links (URLs)</span>
                    <div className="flex space-x-2">
                      <input 
                        type="text" 
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/source"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                        onKeyDown={(e) => e.key === 'Enter' && addUrl()}
                      />
                      <button onClick={addUrl} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Add</button>
                    </div>
                    <div className="min-h-[60px] bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                      {wizardUrls.length === 0 ? (
                        <p className="text-center text-slate-400 text-[11px] py-4">No URLs added</p>
                      ) : (
                        wizardUrls.map((url, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 group">
                            <span className="text-[10px] text-indigo-600 font-bold truncate flex-1">{url}</span>
                            <button onClick={() => removeUrl(idx)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                   <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-widest">Slide Count</label>
                    <div className="flex items-center space-x-4">
                      <input type="range" min="3" max="20" value={wizardSlideCount} onChange={(e) => setWizardSlideCount(parseInt(e.target.value))} className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none accent-indigo-600" />
                      <span className="w-12 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-bold text-lg border border-indigo-100">{wizardSlideCount}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-widest">Custom Structure (Optional)</label>
                      <button onClick={addWizardTopic} className="text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg text-xs font-bold">Add Slide Focus</button>
                    </div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {wizardTopics.map((topic, index) => (
                        <div key={topic.id} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-start space-x-4">
                          <div className="flex flex-col items-center space-y-2 mt-1 shrink-0">
                            <button onClick={() => moveWizardTopic(index, 'up')} disabled={index === 0} className="p-1 hover:bg-slate-100 disabled:opacity-20 text-slate-400">
                               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                            </button>
                            <span className="text-xs font-black text-slate-300 w-5 text-center">{index + 1}</span>
                            <button onClick={() => moveWizardTopic(index, 'down')} disabled={index === wizardTopics.length - 1} className="p-1 hover:bg-slate-100 disabled:opacity-20 text-slate-400">
                               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                          </div>
                          <div className="flex-1 space-y-3">
                            <input type="text" placeholder="Slide Focus Title" className="w-full border-none text-slate-800 font-bold p-0 text-sm focus:ring-0" value={topic.title} onChange={(e) => updateWizardTopic(topic.id, 'title', e.target.value)} />
                            <input type="text" placeholder="Details/Context..." className="w-full bg-slate-50 border-none text-xs text-slate-500 rounded px-2 py-1" value={topic.detail} onChange={(e) => updateWizardTopic(topic.id, 'detail', e.target.value)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 flex items-center justify-between">
              <button onClick={resetWizard} className="flex items-center space-x-2 text-sm font-semibold text-slate-400 hover:text-red-500 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2m15.357 2H15" /></svg>
                <span>Reset Wizard</span>
              </button>
              <div className="flex items-center space-x-3">
                <button onClick={() => setShowPromptWizard(false)} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl">Cancel</button>
                <button onClick={handleWizardSubmit} disabled={!wizardPrompt.trim() || isGenerating || isParsingFiles} className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all disabled:opacity-50">
                  {isGenerating ? 'Generating...' : 'Generate Grounded Slideshow'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stable container for PDF capture */}
      <div ref={exportContainerRef} className="fixed top-0" style={{ left: '-99999px', width: '1280px', pointerEvents: 'none', visibility: isExporting ? 'visible' : 'hidden', background: '#ffffff' }}>
        {presentation?.slides.map(slide => (
          <div key={`export-${slide.id}`} style={{ width: '1280px', height: '720px', overflow: 'hidden', position: 'relative' }}>
            <SlideRenderer slide={slide} onUpdate={() => {}} isActive={true} disableTransitions={true} />
          </div>
        ))}
      </div>
    </div>
  );
};

// ... Rest of the components stay unchanged ...
const PresenterView: React.FC = () => {
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadFromStorage = useCallback(() => {
    const savedData = localStorage.getItem(STORAGE_CURRENT);
    if (savedData) {
      try {
        const { presentation: savedPres, index } = JSON.parse(savedData);
        if (savedPres && Array.isArray(savedPres.slides)) {
          const slidesWithImages = loadImagesFromStorage(savedPres.id, savedPres.slides);
          setPresentation({ ...savedPres, slides: slidesWithImages });
          const validIndex = Math.min(index || 0, savedPres.slides.length - 1);
          setCurrentSlideIndex(Math.max(0, validIndex));
        }
      } catch (e) {
        console.error("Failed to load for presenter", e);
      }
    }
  }, []);

  useEffect(() => {
    loadFromStorage();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_CURRENT) loadFromStorage();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadFromStorage]);

  const updateSlideIndex = (newIndex: number) => {
    if (!presentation) return;
    const index = Math.max(0, Math.min(newIndex, presentation.slides.length - 1));
    setCurrentSlideIndex(index);
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_CURRENT) || '{}');
      localStorage.setItem(STORAGE_CURRENT, JSON.stringify({ ...data, index }));
    } catch (e) {
      console.warn("Storage update failed", e);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!presentation) return <div className="bg-slate-900 h-screen flex items-center justify-center text-white">Loading Presentation...</div>;

  const currentSlide = presentation.slides[currentSlideIndex];
  const nextSlide = presentation.slides[currentSlideIndex + 1];

  if (!currentSlide) return <div className="bg-slate-900 h-screen flex items-center justify-center text-white text-xl">Presentation content missing.</div>;

  return (
    <div className="bg-slate-950 h-screen flex flex-col p-6 text-white font-sans overflow-hidden">
      <header className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-600 px-3 py-1 rounded text-xs font-bold uppercase tracking-widest">Presenter Mode</div>
          <h1 className="text-xl font-bold truncate max-w-md">{presentation.title}</h1>
        </div>
        <div className="flex items-center space-x-8">
          <div className="text-center">
            <div className="text-[10px] text-slate-500 uppercase font-black">Time Elapsed</div>
            <div className="text-2xl font-mono text-indigo-400">{formatTime(timer)}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500 uppercase font-black">Slide</div>
            <div className="text-2xl font-mono">{currentSlideIndex + 1} / {presentation.slides.length}</div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex gap-6 min-h-0">
        <div className="flex-[3] flex flex-col space-y-4">
          <div className="text-[10px] text-slate-500 uppercase font-black">Current Slide</div>
          <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative flex-1">
             <div className="scale-[0.8] origin-top h-full w-full">
                <SlideRenderer slide={currentSlide} onUpdate={() => {}} isActive={true} />
             </div>
          </div>
          <div className="flex items-center justify-center space-x-6 py-4">
             <button onClick={() => updateSlideIndex(currentSlideIndex - 1)} disabled={currentSlideIndex === 0} className="p-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-20 rounded-full transition-all">
               <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
             </button>
             <button onClick={() => updateSlideIndex(currentSlideIndex + 1)} disabled={currentSlideIndex === presentation.slides.length - 1} className="p-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20 rounded-full transition-all shadow-lg shadow-indigo-900/40">
               <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
             </button>
          </div>
        </div>

        <div className="flex-[2] flex flex-col space-y-6">
          <div className="flex flex-col space-y-3">
             <div className="text-[10px] text-slate-500 uppercase font-black">Next Slide</div>
             <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 aspect-video grayscale opacity-50 relative">
                {nextSlide ? (
                   <div className="scale-[0.4] origin-top-left absolute inset-0" style={{ width: '250%', height: '250%' }}>
                      <SlideRenderer slide={nextSlide} onUpdate={() => {}} isActive={true} />
                   </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-700 text-sm font-bold italic">End of presentation</div>
                )}
             </div>
          </div>
          <div className="flex-1 flex flex-col space-y-3 min-h-0">
             <div className="text-[10px] text-slate-500 uppercase font-black">Speaker Notes</div>
             <div className="flex-1 bg-slate-900 rounded-2xl p-6 border border-slate-800 overflow-y-auto custom-scrollbar">
                {currentSlide.notes ? <p className="text-xl leading-relaxed text-slate-300 whitespace-pre-wrap">{currentSlide.notes}</p> : <p className="text-slate-600 italic">No notes.</p>}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<EditorView />} />
        <Route path="/present" element={<PresenterView />} />
      </Routes>
    </HashRouter>
  );
};

const LayoutIcon: React.FC<{ type: SlideLayout }> = ({ type }) => {
  switch (type) {
    case SlideLayout.TITLE: return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>;
    case SlideLayout.BULLETS: return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;
    case SlideLayout.IMAGE_LEFT: return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v16H4V4zm10 4h6m-6 4h6m-6 4h6" /></svg>;
    case SlideLayout.IMAGE_RIGHT: return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 4h7v16h-7V4zM4 8h6m-6 4h6m-6 4h6" /></svg>;
    case SlideLayout.QUOTE: return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>;
    case SlideLayout.TWO_COLUMN: return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v16H4V4zm9 0h7v16h-7V4z" /></svg>;
    default: return null;
  }
};

export default App;