import React, { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
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

const TooltipButton: React.FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, title, children }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`flex items-center h-10 px-2 rounded-xl transition-all duration-300 ease-out group ${isHovered ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`}
    >
      <div className="shrink-0 flex items-center justify-center w-6 h-6">
        {children}
      </div>
      <div className={`overflow-hidden transition-all duration-300 ease-out flex items-center ${isHovered ? 'max-w-40 ml-2 opacity-100' : 'max-w-0 ml-0 opacity-0'}`}>
        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
          {title}
        </span>
      </div>
    </button>
  );
};

const EditorView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isOutlineCollapsed, setIsOutlineCollapsed] = useState(false);
  const [showWizardDropdown, setShowWizardDropdown] = useState(false);
  const [showPromptWizard, setShowPromptWizard] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedLibrary, setSavedLibrary] = useState<SavedPresentationMeta[]>([]);
  const [isFullscreenPresenting, setIsFullscreenPresenting] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Wizard state
  const [wizardPrompt, setWizardPrompt] = useState('');
  const [wizardSlideCount, setWizardSlideCount] = useState(8);
  const [wizardTopics, setWizardTopics] = useState<WizardTopic[]>([]);
  const [wizardFiles, setWizardFiles] = useState<WizardFile[]>([]);
  const [wizardUrls, setWizardUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const isExpanded = isPromptFocused && prompt.length >= 33;
  const exportContainerRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize prompt textarea with constraints - using useLayoutEffect to prevent flicker
  useLayoutEffect(() => {
    if (promptRef.current) {
      promptRef.current.style.height = '34px'; // Reset to min to measure correct scrollHeight
      const scrollHeight = promptRef.current.scrollHeight;
      const targetHeight = Math.min(Math.max(scrollHeight, 34), 60);
      promptRef.current.style.height = `${targetHeight}px`;
      promptRef.current.style.overflowY = scrollHeight > 60 ? 'auto' : 'hidden';
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

  // Sync session to storage
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

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_CURRENT);
    if (savedData) {
      try {
        const { presentation: savedPres, index, savedAt } = JSON.parse(savedData);
        if (savedPres && Array.isArray(savedPres.slides)) {
          const slidesWithImages = loadImagesFromStorage(savedPres.id, savedPres.slides);
          setPresentation({ ...savedPres, slides: slidesWithImages });
          setCurrentSlideIndex(Math.min(index || 0, savedPres.slides.length - 1));
          setLastSaved(savedAt);
        }
      } catch (e) {}
    }
  }, []);

  // Listen for fullscreen exits
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreenPresenting(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsParsingFiles(true);
    setUploadError(null);
    const newWizardFiles: WizardFile[] = [];

    const allowedExtensions = ['.pdf', '.docx', '.txt', '.csv', '.md', '.png', '.jpg', '.jpeg'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = Math.random().toString(36).substr(2, 9);
      const fileNameLower = file.name.toLowerCase();
      const hasValidExt = allowedExtensions.some(ext => fileNameLower.endsWith(ext));
      const isImg = file.type.startsWith('image/');

      if (!hasValidExt && !isImg) {
        setUploadError(`Unsupported format: ${file.name}. Only .md, .txt, .pdf, .docx, .csv, and images are accepted.`);
        continue;
      }

      try {
        if (isImg) {
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
        } else if (file.type === 'text/plain' || file.type === 'text/csv' || fileNameLower.endsWith('.md')) {
          const text = await file.text();
          newWizardFiles.push({ id, name: file.name, type: file.type, content: text, isImage: false, mimeType: file.type });
        }
      } catch (err) {
        console.error(`Failed to parse ${file.name}`, err);
      }
    }
    setWizardFiles(prev => [...prev, ...newWizardFiles]);
    setIsParsingFiles(false);
  };

  const handleGenerate = async (useHeaderPrompt = true, overridePrompt?: string, context?: { text: string[], images: {data: string, mimeType: string}[] }) => {
    const targetPrompt = overridePrompt || (useHeaderPrompt ? prompt : (presentation?.title || prompt));
    if (!targetPrompt.trim()) return;
    setIsGenerating(true);
    setStatusMessage('Generating presentation...');
    
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
      setIsGenerating(false);

      for (let i = 0; i < slidesWithIds.length; i++) {
        const slide = slidesWithIds[i];
        if (slide.imagePrompt) {
          try {
            const imageUrl = await generateImage(slide.imagePrompt);
            setPresentation(prev => {
              if (!prev || prev.id !== newPresentation.id) return prev;
              const updatedSlides = [...prev.slides];
              updatedSlides[i] = { ...updatedSlides[i], imageUrl };
              return { ...prev, slides: updatedSlides };
            });
          } catch (e) {}
        }
      }
    } catch (error) {
      alert('Generation failed.');
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const handleLoadDemo = () => {
    setPresentation(DEMO_PRESENTATION);
    setCurrentSlideIndex(0);
  };

  const handleWizardSubmit = async () => {
    let finalPrompt = `Topic: ${wizardPrompt}\nSlide Count: ${wizardSlideCount}\n`;
    if (wizardTopics.length > 0) {
      finalPrompt += `Specific Structure:\n`;
      wizardTopics.forEach((t, i) => finalPrompt += `${i + 1}. ${t.title}: ${t.detail}\n`);
    }
    const contextTexts = wizardFiles.filter(f => !f.isImage).map(f => `FILE: ${f.name}\n${f.content}`);
    const contextImages = wizardFiles.filter(f => f.isImage).map(f => ({ data: f.content, mimeType: f.mimeType }));
    handleGenerate(false, finalPrompt, { text: contextTexts, images: contextImages });
    setShowPromptWizard(false);
  };

  const handleExportPDF = async () => {
    if (!presentation) return;
    setShowExportMenu(false);
    setIsExporting(true);
    setStatusMessage('Exporting PDF...');
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1280, 720] });
      const slideElements = Array.from(exportContainerRef.current?.children || []);
      for (let i = 0; i < slideElements.length; i++) {
        const canvas = await html2canvas(slideElements[i] as HTMLElement, { scale: 1.5, useCORS: true });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 1280, 720);
      }
      pdf.save(`${presentation.title.substring(0, 30)}.pdf`);
    } catch (e) {}
    setIsExporting(false);
    setStatusMessage('');
  };

  const handleExportPPTX = () => {
    if (!presentation) return;
    setShowExportMenu(false);
    const pptx = new (pptxgen as any)();
    pptx.layout = 'LAYOUT_16x9';

    presentation.slides.forEach(slide => {
      const pSlide = pptx.addSlide();
      const cleanTitle = slide.title.replace(/<[^>]*>/g, '');
      const cleanSubtitle = slide.subtitle?.replace(/<[^>]*>/g, '') || '';
      const cleanContent = slide.content.map(c => c.replace(/<[^>]*>/g, '')).join('\n');

      if (slide.layout === SlideLayout.TITLE) {
        pSlide.addText(cleanTitle, { x: 0, y: '35%', w: '100%', align: 'center', fontSize: 44, bold: true });
        if (cleanSubtitle) pSlide.addText(cleanSubtitle, { x: 0, y: '50%', w: '100%', align: 'center', fontSize: 24, color: '666666' });
      } else if (slide.layout === SlideLayout.QUOTE) {
        pSlide.addText(`"${cleanContent}"`, { x: 1, y: '40%', w: '80%', align: 'center', fontSize: 32, italic: true });
        pSlide.addText(`— ${cleanTitle}`, { x: 1, y: '60%', w: '80%', align: 'center', fontSize: 24, bold: true });
      } else {
        pSlide.addText(cleanTitle, { x: 0.5, y: 0.5, w: '90%', fontSize: 32, bold: true });
        
        let contentX = 0.5;
        let contentW = '90%';
        
        if (slide.imageUrl) {
          const isLeft = slide.layout === SlideLayout.IMAGE_LEFT;
          const imgConfig: any = { 
            x: isLeft ? 0.5 : 5.5, 
            y: 1.5, 
            w: 4, 
            h: 3,
            ...(slide.imageUrl.startsWith('data:') ? { data: slide.imageUrl } : { path: slide.imageUrl })
          };
          pSlide.addImage(imgConfig);
          contentX = isLeft ? 5.0 : 0.5;
          contentW = '45%';
        }
        
        pSlide.addText(cleanContent, { x: contentX, y: 1.5, w: contentW, fontSize: 18, color: '444444' });
      }
      
      if (slide.notes) {
        pSlide.addNotes(slide.notes);
      }
    });
    pptx.writeFile({ fileName: `${presentation.title.substring(0, 30)}.pptx` });
  };

  const handleSaveToLibrary = () => {
    if (!presentation || !saveName.trim()) return;
    const { presentation: presWithoutImages, images } = stripImagesFromPresentation(presentation);
    const presWithTitle = { ...presWithoutImages, title: saveName.trim() };
    localStorage.setItem(`${STORAGE_PRES_PREFIX}${presentation.id}`, JSON.stringify(presWithTitle));
    saveImagesToStorage(presentation.id, images);
    saveToLibrary({ id: presentation.id, title: saveName.trim(), savedAt: new Date().toISOString(), slideCount: presentation.slides.length });
    setPresentation({ ...presentation, title: saveName.trim() });
    setShowSaveModal(false);
  };

  const openPresenterMode = async () => {
    syncToCurrentStorage();
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreenPresenting(true);
    } catch (e) {}
  };

  const updateSlide = useCallback((updatedSlide: Slide) => {
    setPresentation(prev => {
      if (!prev) return null;
      return { ...prev, slides: prev.slides.map(s => s.id === updatedSlide.id ? updatedSlide : s) };
    });
  }, []);

  const activeSlide = useMemo(() => {
    if (!presentation) return null;
    return presentation.slides[currentSlideIndex];
  }, [presentation, currentSlideIndex]);

  if (isFullscreenPresenting && presentation) {
    return <PresenterView presentation={presentation} initialIndex={currentSlideIndex} onExit={() => setIsFullscreenPresenting(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 overflow-hidden h-screen">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50 shrink-0 shadow-sm">
        {/* Fixed-width logo container to stabilize center */}
        <div className={`flex items-center space-x-2 transition-all duration-500 ease-in-out shrink-0 ${isExpanded ? 'w-0 opacity-0 overflow-hidden' : 'w-60'}`}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Presentify</h1>
        </div>

        <div className={`flex-1 px-8 flex items-center justify-center transition-all duration-500 ease-in-out ${isExpanded ? 'max-w-full' : 'max-w-2xl'}`}>
          <div className="relative flex-1 group flex items-end">
            <textarea
              ref={promptRef}
              rows={1}
              placeholder="Topic for a new slideshow..."
              className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-0 rounded-2xl py-2 px-6 pr-32 transition-all outline-none resize-none text-sm"
              style={{ minHeight: '34px', maxHeight: '60px' }}
              value={prompt}
              onFocus={() => setIsPromptFocused(true)}
              onBlur={() => setIsPromptFocused(false)}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleGenerate(true))}
            />
            <div className="absolute right-1 flex items-center wizard-dropdown-container"
              style={{ "top":"50%", "transform":"translateY(-50%)"}}
            >
              <button onClick={() => handleGenerate(true)} disabled={isGenerating} className="h-8 px-4 bg-indigo-600 text-white rounded-l-full text-xs font-bold transition-colors">
                {isGenerating ? '...' : 'Create'}
              </button>
              <button onClick={() => setShowWizardDropdown(!showWizardDropdown)} className="h-8 px-2 bg-indigo-600 text-white rounded-r-full border-l border-indigo-500 hover:bg-indigo-700">
                <svg className={`w-4 h-4 transition-transform ${showWizardDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" strokeWidth={2} /></svg>
              </button>
              {showWizardDropdown && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white border rounded-xl shadow-2xl z-[100] p-1.5">
                  <button onClick={() => { setWizardPrompt(prompt); setShowPromptWizard(true); setShowWizardDropdown(false); }} className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-indigo-50 rounded-lg text-left">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth={2}/></svg>
                    <span className="text-xs font-bold">Prompt Wizard</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixed-width button container to prevent layout shifts during inline label animation */}
        <div className="flex items-center justify-end space-x-1 w-[320px] shrink-0">
          <TooltipButton
            onClick={handleLoadDemo}
            title="Load Demo"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </TooltipButton>

          <TooltipButton 
            onClick={() => { setSavedLibrary(getLibrary()); setShowOpenModal(true); }} 
            title="Open"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" strokeWidth={2}/></svg>
          </TooltipButton>
          
          {presentation && (
            <>
              <TooltipButton 
                onClick={() => { setSaveName(presentation.title); setShowSaveModal(true); }} 
                title="Save"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" strokeWidth={2}/></svg>
              </TooltipButton>
              
              <div className="relative export-menu-container flex items-center">
                <TooltipButton onClick={() => setShowExportMenu(!showExportMenu)} title="Export">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth={2}/></svg>
                </TooltipButton>
                {showExportMenu && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white border rounded-xl shadow-2xl z-[100] p-1.5">
                    <button onClick={handleExportPDF} className="w-full p-3 hover:bg-slate-50 rounded-lg text-left text-xs font-bold">Export as PDF</button>
                    <button onClick={handleExportPPTX} className="w-full p-3 hover:bg-slate-50 rounded-lg text-left text-xs font-bold">Export as PPTX</button>
                  </div>
                )}
              </div>

              <button onClick={openPresenterMode} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center space-x-2 ml-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" strokeWidth={2}/></svg>
                <span>Present</span>
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className={`${isOutlineCollapsed ? 'w-16' : 'w-72'} bg-white border-r flex flex-col transition-all duration-300`}>
          <div className="p-4 border-b flex items-center justify-between">
            {!isOutlineCollapsed && <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Outline</h3>}
            <button onClick={() => setIsOutlineCollapsed(!isOutlineCollapsed)} className="p-1 hover:bg-slate-100 rounded text-slate-400">
              <svg className={`w-5 h-5 transition-transform ${isOutlineCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" strokeWidth={2}/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {presentation?.slides.map((s, i) => (
              <button key={s.id} onClick={() => setCurrentSlideIndex(i)} className={`w-full flex items-center p-2 rounded-lg text-left transition-all ${currentSlideIndex === i ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                <span className="w-5 text-xs opacity-30 font-mono">{i + 1}</span>
                <span className="truncate text-xs flex-1">{s.title.replace(/<[^>]*>/g, '') || 'Untitled Slide'}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1 bg-slate-100 overflow-y-auto p-12 flex flex-col items-center">
          {statusMessage && (
            <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
               <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
               <p className="text-lg font-bold text-slate-800 animate-pulse">{statusMessage}</p>
            </div>
          )}
          {presentation && activeSlide ? (
            <div className="w-full max-w-5xl">
              <SlideRenderer slide={activeSlide} onUpdate={updateSlide} isActive={true} />
              <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Speaker Notes</div>
                <textarea 
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:border-indigo-100 rounded-xl p-4 text-sm outline-none resize-none transition-all h-32"
                  value={activeSlide.notes || ''}
                  onChange={(e) => updateSlide({ ...activeSlide, notes: e.target.value })}
                  placeholder="Notes for this slide..."
                />
              </div>
            </div>
          ) : (
            <div className="mt-20 text-center max-w-lg">
              <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18" strokeWidth={2}/></svg></div>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Create Your Masterpiece</h2>
              <p className="text-slate-500 text-lg">Enter a topic above or use the Prompt Wizard to upload documents and build grounded slides.</p>
            </div>
          )}
        </div>
      </main>

      {/* Modals & Overlays */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Save Presentation</h3>
            <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} className="w-full border p-3 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Title..." />
            <div className="flex justify-end space-x-3">
              <button onClick={() => setShowSaveModal(false)} className="px-6 py-2 text-slate-400">Cancel</button>
              <button onClick={handleSaveToLibrary} className="bg-indigo-600 text-white px-8 py-2 rounded-xl font-bold">Save</button>
            </div>
          </div>
        </div>
      )}

      {showOpenModal && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <h3 className="text-xl font-bold mb-6">Library</h3>
            <div className="flex-1 overflow-y-auto space-y-3">
              {savedLibrary.map(meta => (
                <div key={meta.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-indigo-50 transition-colors group">
                  <div>
                    <div className="font-bold text-slate-800">{meta.title}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-black">{meta.slideCount} Slides • Saved {new Date(meta.savedAt).toLocaleDateString()}</div>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => {
                      const data = localStorage.getItem(`${STORAGE_PRES_PREFIX}${meta.id}`);
                      if (data) {
                        const pres = JSON.parse(data);
                        setPresentation({ ...pres, slides: loadImagesFromStorage(meta.id, pres.slides) });
                        setShowOpenModal(false);
                      }
                    }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Open</button>
                  </div>
                </div>
              ))}
              {savedLibrary.length === 0 && <p className="text-center text-slate-400 py-12">No saved presentations yet.</p>}
            </div>
            <button onClick={() => setShowOpenModal(false)} className="mt-6 w-full py-2 text-slate-400 text-sm">Close</button>
          </div>
        </div>
      )}

      {/* Hidden container for capture */}
      <div ref={exportContainerRef} className="fixed top-0 left-[-9999px]" style={{ width: '1280px' }}>
        {presentation?.slides.map(s => (
          <div key={s.id} style={{ width: '1280px', height: '720px', overflow: 'hidden' }}>
            <SlideRenderer slide={s} onUpdate={() => {}} isActive={true} disableTransitions={true} />
          </div>
        ))}
      </div>

      {showPromptWizard && (
        <PromptWizard 
          prompt={wizardPrompt} 
          setPrompt={setWizardPrompt}
          onClose={() => setShowPromptWizard(false)}
          onSubmit={handleWizardSubmit}
          slideCount={wizardSlideCount}
          setSlideCount={setWizardSlideCount}
          topics={wizardTopics}
          setTopics={setWizardTopics}
          files={wizardFiles}
          setFiles={setWizardFiles}
          urls={wizardUrls}
          setUrls={setWizardUrls}
          urlInput={urlInput}
          setUrlInput={setUrlInput}
          isParsing={isParsingFiles}
          onFileUpload={handleFileUpload}
          uploadError={uploadError}
        />
      )}
    </div>
  );
};

// ... Simplified PromptWizard Component ...
const PromptWizard: React.FC<any> = ({ prompt, setPrompt, onClose, onSubmit, slideCount, setSlideCount, topics, setTopics, files, setFiles, urls, setUrls, urlInput, setUrlInput, isParsing, onFileUpload, uploadError }) => {
  const [slideMode, setSlideMode] = useState<'exact' | 'qualitative'>('exact');
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragStart = (index: number) => { dragItem.current = index; };
  const handleDragEnter = (index: number) => { dragOverItem.current = index; };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null) {
      const copy = [...topics];
      const draggedItemContent = copy[dragItem.current];
      copy.splice(dragItem.current, 1);
      copy.splice(dragOverItem.current, 0, draggedItemContent);
      dragItem.current = null;
      dragOverItem.current = null;
      setTopics(copy);
    }
  };

  const qualitativeOptions = [
    { label: 'Few', count: 5 },
    { label: 'Moderate', count: 10 },
    { label: 'Many', count: 15 },
    { label: 'Numerous', count: 20 },
  ];

  const addTopic = () => setTopics([...topics, { id: Math.random().toString(36).substr(2, 9), title: '', detail: '' }]);
  const updateTopic = (id: string, field: string, val: string) => setTopics(topics.map((t: any) => t.id === id ? { ...t, [field]: val } : t));
  const removeTopic = (id: string) => setTopics(topics.filter((t: any) => t.id !== id));

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="p-8 border-b bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth={2}/></svg></div>
            <h3 className="text-2xl font-black text-slate-800">Prompt Wizard</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2}/></svg></button>
        </div>
        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
          <section className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Master Topic</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl p-6 text-lg outline-none focus:ring-2 focus:ring-indigo-100 h-32 resize-none" placeholder="What should this presentation be about?" />
          </section>
          
          <div className="grid grid-cols-2 gap-10">
            <section className="space-y-6">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source Grounding</label>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Documents</span>
                  <input type="file" multiple className="hidden" id="wizard-file" onChange={onFileUpload} accept=".pdf,.docx,.txt,.csv,.md,.png,.jpg,.jpeg" />
                  <label htmlFor="wizard-file" className="cursor-pointer text-indigo-600 text-xs font-black">Upload</label>
                </div>
                <p className="text-[10px] text-slate-400">Supported: .md, .txt, .pdf, .docx, .csv, images</p>
                {uploadError && <p className="text-[10px] text-red-500 font-bold bg-red-50 p-2 rounded-lg border border-red-100">{uploadError}</p>}
                <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200 min-h-[80px]">
                  {files.map((f: any) => <div key={f.id} className="text-[10px] bg-white border rounded-lg px-2 py-1 mb-1 truncate flex items-center justify-between">{f.name} <button onClick={() => setFiles(files.filter((file: any) => file.id !== f.id))} className="text-red-400 ml-2">×</button></div>)}
                  {isParsing && <p className="text-[10px] animate-pulse">Parsing...</p>}
                  {files.length === 0 && !isParsing && <p className="text-[10px] text-slate-300 text-center mt-4">No files uploaded</p>}
                </div>
                
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://..." className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-xs outline-none" />
                    <button onClick={() => { if (urlInput) { setUrls([...urls, urlInput]); setUrlInput(''); } }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold">Add URL</button>
                  </div>
                  {urls.length > 0 && (
                    <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100 space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                      {urls.map((url: string, i: number) => (
                        <div key={i} className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-indigo-50">
                          <span className="text-[10px] text-indigo-600 truncate flex-1 mr-2">{url}</span>
                          <button onClick={() => setUrls(urls.filter((_: any, idx: number) => idx !== i))} className="text-red-400 hover:text-red-600 font-bold text-sm">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
            
            <section className="space-y-6">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Structure</label>
              <div className="space-y-4 mb-4">
                <div className="flex items-center space-x-2 p-1 bg-slate-100 rounded-xl w-fit">
                  <button onClick={() => setSlideMode('exact')} className={`px-4 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${slideMode === 'exact' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Exact Count</button>
                  <button onClick={() => setSlideMode('qualitative')} className={`px-4 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${slideMode === 'qualitative' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Quick Pick</button>
                </div>
                
                {slideMode === 'exact' ? (
                  <div className="flex items-center space-x-4">
                    <input type="range" min="3" max="25" value={slideCount} onChange={(e) => setSlideCount(parseInt(e.target.value))} className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    <span className="w-16 bg-slate-50 rounded-lg p-2 text-center text-xs font-bold border">Slides: {slideCount}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {qualitativeOptions.map(opt => (
                      <button 
                        key={opt.label} 
                        onClick={() => setSlideCount(opt.count)}
                        className={`p-2 rounded-xl text-xs font-bold border transition-all ${slideCount === opt.count ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                      >
                        {opt.label} ({opt.count})
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] font-black text-indigo-500 uppercase">Final slides to generate: {slideCount}</p>
              </div>
            </section>
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Slide Focus (Rearrange with drag)</label>
              <button onClick={addTopic} className="text-indigo-600 text-[10px] font-black uppercase hover:underline">Add New Slide focus</button>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {topics.map((t: any, index: number) => (
                <div 
                  key={t.id} 
                  draggable 
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className="bg-slate-50 p-4 rounded-2xl space-y-2 relative group cursor-move border-2 border-transparent hover:border-indigo-100 hover:bg-indigo-50/30 active:opacity-50 transition-all"
                >
                  <button onClick={() => removeTopic(t.id)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400">×</button>
                  <div className="flex items-center space-x-4">
                    <span className="text-[10px] font-black text-indigo-400 bg-white w-6 h-6 flex items-center justify-center rounded-full shadow-sm shrink-0">{index + 1}</span>
                    <div className="flex-1 space-y-1">
                      <input type="text" value={t.title} onChange={(e) => updateTopic(t.id, 'title', e.target.value)} placeholder="Title Focus" className="w-full bg-transparent border-none text-sm font-bold p-0 outline-none" />
                      <input type="text" value={t.detail} onChange={(e) => updateTopic(t.id, 'detail', e.target.value)} placeholder="Add details or context for this slide..." className="w-full bg-transparent border-none text-xs p-0 outline-none text-slate-500" />
                    </div>
                  </div>
                </div>
              ))}
              {topics.length === 0 && <p className="text-[10px] text-slate-300 text-center py-8 italic border-2 border-dashed border-slate-100 rounded-2xl">No custom slide focus defined. The AI will determine the best structure based on your topic and sources.</p>}
            </div>
          </section>
        </div>
        
        <div className="p-8 border-t bg-slate-50 flex justify-end space-x-4">
          <button onClick={onClose} className="px-6 py-3 text-slate-400 font-bold">Cancel</button>
          <button onClick={onSubmit} className="bg-indigo-600 text-white px-10 py-3 rounded-2xl font-black shadow-xl shadow-indigo-100">Create Presentation</button>
        </div>
      </div>
    </div>
  );
};

const PresenterView: React.FC<{ presentation: Presentation, initialIndex: number, onExit: () => void }> = ({ presentation, initialIndex, onExit }) => {
  const [index, setIndex] = useState(initialIndex);
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === ' ') setIndex(i => Math.min(i + 1, presentation.slides.length - 1));
    if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
    if (e.key === 'Escape') onExit();
  }, [presentation.slides.length, onExit]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const currentSlide = presentation.slides[index];

  return (
    <div className="fixed inset-0 bg-white z-[200] flex flex-col">
      <div className="flex-1 relative bg-slate-100 flex items-center justify-center p-12 overflow-hidden">
        <SlideRenderer slide={currentSlide} onUpdate={() => {}} isActive={true} />
        
        {/* Navigation Overlays */}
        <div className="absolute inset-y-0 left-0 w-24 flex items-center justify-center group">
          <button onClick={() => setIndex(i => Math.max(i - 1, 0))} className="p-4 bg-white/20 hover:bg-white/80 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all">
            <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 19l-7-7 7-7" strokeWidth={3}/></svg>
          </button>
        </div>
        <div className="absolute inset-y-0 right-0 w-24 flex items-center justify-center group">
          <button onClick={() => setIndex(i => Math.min(i + 1, presentation.slides.length - 1))} className="p-4 bg-white/20 hover:bg-white/80 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all">
            <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 5l7 7-7 7" strokeWidth={3}/></svg>
          </button>
        </div>
      </div>
      
      {/* HUD (Heads Up Display) */}
      <div className="h-24 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-10 text-white shrink-0">
        <div className="flex items-center space-x-4">
          <div className="text-[10px] font-black text-slate-500 uppercase">Slide</div>
          <div className="text-xl font-mono">{index + 1} / {presentation.slides.length}</div>
        </div>
        <div className="flex items-center space-x-12 flex-1 justify-center px-12">
          <div className="max-w-xl truncate text-slate-400 italic text-sm">{currentSlide.notes || 'No notes for this slide'}</div>
        </div>
        <button onClick={onExit} className="text-slate-500 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2}/></svg>
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<EditorView />} />
      </Routes>
    </HashRouter>
  );
};

export default App;