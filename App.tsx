
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Presentation, Slide, SlideLayout, SlideTransition } from './types';
import { generatePresentation, regenerateSlide, generateImage, refineSlide } from './services/geminiService';
import SlideRenderer from './components/SlideRenderer';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import pptxgen from 'pptxgenjs';
import { DEMO_PRESENTATION } from './demo';

const STORAGE_KEY = 'presentify_saved_presentation';

const EditorView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
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
  
  const exportContainerRef = useRef<HTMLDivElement>(null);

  // Close export menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (showExportMenu && !(e.target as Element).closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [showExportMenu]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const { presentation: savedPres, index, savedAt } = JSON.parse(savedData);
        setPresentation(savedPres);
        setCurrentSlideIndex(index || 0);
        setLastSaved(savedAt);
      } catch (e) {
        console.error("Failed to load saved presentation", e);
      }
    }
  }, []);

  // Listen for storage changes from Presenter mode
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const { index } = JSON.parse(e.newValue);
          if (index !== undefined) setCurrentSlideIndex(index);
        } catch (err) {
          console.error("Storage sync failed", err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleSave = () => {
    if (!presentation) return;
    const savedAt = new Date().toLocaleTimeString();
    const dataToSave = {
      presentation,
      index: currentSlideIndex,
      savedAt
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    setLastSaved(savedAt);
  };

  // Auto-save when navigation happens in editor to keep windows in sync
  useEffect(() => {
    if (presentation) handleSave();
  }, [currentSlideIndex]);

  const handleGenerate = async (useHeaderPrompt = true) => {
    const targetPrompt = useHeaderPrompt ? prompt : (presentation?.title || prompt);
    if (!targetPrompt.trim()) return;
    setIsGenerating(true);
    setStatusMessage('Generating presentation structure...');
    
    try {
      const data = await generatePresentation(targetPrompt);
      setStatusMessage('Creating AI-generated visuals for slides...');
      
      const slidesWithIds = await Promise.all(data.slides.map(async (s: any) => {
        const id = Math.random().toString(36).substr(2, 9);
        let imageUrl = `https://picsum.photos/seed/${id}/800/600`;
        
        if (s.imagePrompt) {
          try {
            imageUrl = await generateImage(s.imagePrompt);
          } catch (e) {
            console.error("Visual generation failed for slide", e);
          }
        }
        
        return {
          ...s,
          id,
          imageUrl,
        };
      }));
      
      setPresentation({
        id: Math.random().toString(36).substr(2, 9),
        title: data.title,
        slides: slidesWithIds
      });
      setCurrentSlideIndex(0);
      setLastSaved(null);
    } catch (error) {
      console.error(error);
      alert('Failed to generate presentation. Please try again.');
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const handleLoadDemo = () => {
    setPresentation(DEMO_PRESENTATION);
    setCurrentSlideIndex(0);
    setLastSaved(null);
  };

  const handleExportPDF = async () => {
    if (!presentation || !exportContainerRef.current) return;
    setShowExportMenu(false);
    setIsExporting(true);
    setStatusMessage('Preparing high-resolution PDF...');

    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [1280, 720]
      });

      const slideElements = exportContainerRef.current.children;
      for (let i = 0; i < slideElements.length; i++) {
        setStatusMessage(`Capturing slide ${i + 1} of ${slideElements.length}...`);
        const element = slideElements[i] as HTMLElement;
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 1280, 720);
      }

      pdf.save(`${presentation.title.replace(/<[^>]*>/g, '').substring(0, 30) || 'Presentation'}.pdf`);
    } catch (error) {
      console.error('PDF Export failed:', error);
      alert('Failed to export PDF.');
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

      presentation.slides.forEach((slide) => {
        const pSlide = pptx.addSlide();
        const cleanTitle = slide.title.replace(/<[^>]*>/g, '');
        const cleanSubtitle = slide.subtitle?.replace(/<[^>]*>/g, '');
        const cleanContent = slide.content.map(c => c.replace(/<[^>]*>/g, ''));

        switch (slide.layout) {
          case SlideLayout.TITLE:
            pSlide.addText(cleanTitle, { x: 1, y: 2, w: '80%', fontSize: 44, bold: true, align: 'center', color: '333333' });
            if (cleanSubtitle) pSlide.addText(cleanSubtitle, { x: 1, y: 3.2, w: '80%', fontSize: 24, align: 'center', color: '666666' });
            break;

          case SlideLayout.BULLETS:
            pSlide.addText(cleanTitle, { x: 0.5, y: 0.5, w: '90%', fontSize: 32, bold: true, color: '4F46E5' });
            pSlide.addText(cleanContent.map(text => ({ text, options: { bullet: true, margin: 5 } })), { x: 0.5, y: 1.5, w: '90%', fontSize: 18, color: '444444' });
            break;

          case SlideLayout.IMAGE_LEFT:
            if (slide.imageUrl) {
              const isData = slide.imageUrl.startsWith('data:');
              const imgVal = isData ? slide.imageUrl.split(',')[1] : slide.imageUrl;
              pSlide.addImage({ [isData ? 'data' : 'path']: imgVal, x: 0.5, y: 1, w: 4, h: 3.5 });
            }
            pSlide.addText(cleanTitle, { x: 5, y: 1, w: 4.5, fontSize: 28, bold: true, color: '333333' });
            pSlide.addText(cleanContent.map(text => ({ text, options: { bullet: true } })), { x: 5, y: 2, w: 4.5, fontSize: 16, color: '555555' });
            break;

          case SlideLayout.IMAGE_RIGHT:
            pSlide.addText(cleanTitle, { x: 0.5, y: 1, w: 4.5, fontSize: 28, bold: true, color: '333333' });
            pSlide.addText(cleanContent.map(text => ({ text, options: { bullet: true } })), { x: 0.5, y: 2, w: 4.5, fontSize: 16, color: '555555' });
            if (slide.imageUrl) {
              const isData = slide.imageUrl.startsWith('data:');
              const imgVal = isData ? slide.imageUrl.split(',')[1] : slide.imageUrl;
              pSlide.addImage({ [isData ? 'data' : 'path']: imgVal, x: 5.5, y: 1, w: 4, h: 3.5 });
            }
            break;

          case SlideLayout.QUOTE:
            pSlide.addText(`"${cleanContent[0] || ''}"`, { x: 1, y: 1.5, w: '80%', fontSize: 32, italic: true, align: 'center', color: '444444' });
            pSlide.addText(`— ${cleanTitle}`, { x: 1, y: 3.5, w: '80%', fontSize: 22, bold: true, align: 'center', color: '666666' });
            break;

          case SlideLayout.TWO_COLUMN:
            pSlide.addText(cleanTitle, { x: 0.5, y: 0.5, w: '90%', fontSize: 32, bold: true, color: '333333' });
            const half = Math.ceil(cleanContent.length / 2);
            pSlide.addText(cleanContent.slice(0, half).map(text => ({ text, options: { bullet: true } })), { x: 0.5, y: 1.5, w: 4.25, fontSize: 16, color: '444444' });
            pSlide.addText(cleanContent.slice(half).map(text => ({ text, options: { bullet: true } })), { x: 5.25, y: 1.5, w: 4.25, fontSize: 16, color: '444444' });
            break;
        }
      });

      pptx.writeFile({ fileName: `${presentation.title.replace(/<[^>]*>/g, '').substring(0, 30) || 'Presentation'}.pptx` });
    } catch (error) {
      console.error('PPTX Export failed:', error);
      alert('Failed to export PowerPoint.');
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

  const handleRefineSlideSubmit = async () => {
    if (!presentation) return;
    setIsGenerating(true);
    setStatusMessage('Refining slide and visuals...');
    try {
      const currentSlide = presentation.slides[currentSlideIndex];
      const refinedData = await refineSlide(presentation.title, tempRegenPrompt);
      const newSlide: Slide = {
        ...currentSlide,
        ...refinedData,
        id: currentSlide.id, // Explicitly preserve ID
      };
      updateSlide(newSlide);
      setShowRegenSlideModal(false);
    } catch (error) {
      console.error(error);
      alert('Failed to refine slide.');
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const openRegenSlideModal = () => {
    if (!presentation) return;
    const currentSlide = presentation.slides[currentSlideIndex];
    // Prepopulate with title and content
    const contentText = currentSlide.content.map(c => c.replace(/<[^>]*>/g, '')).join('\n');
    const titleText = currentSlide.title.replace(/<[^>]*>/g, '');
    setTempRegenPrompt(`Refine this slide:\nTitle: ${titleText}\nContent:\n${contentText}`);
    setShowRegenSlideModal(true);
  };

  const handleRegenerateImage = async () => {
    if (!presentation) return;
    setIsImageGenerating(true);
    setStatusMessage('Painting your vision...');
    try {
      const currentSlide = presentation.slides[currentSlideIndex];
      const imageUrl = await generateImage(tempImagePrompt || currentSlide.imagePrompt || currentSlide.title);
      updateSlide({ ...currentSlide, imageUrl, imagePrompt: tempImagePrompt });
      setShowImagePromptModal(false);
    } catch (error) {
      console.error(error);
      alert('Failed to generate image. Please try a different prompt.');
    } finally {
      setIsImageGenerating(false);
      setStatusMessage('');
    }
  };

  const changeLayout = (layout: SlideLayout) => {
    if (!presentation) return;
    const currentSlide = presentation.slides[currentSlideIndex];
    updateSlide({ ...currentSlide, layout });
  };

  const changeTransition = (transitionType: SlideTransition) => {
    if (!presentation) return;
    const currentSlide = presentation.slides[currentSlideIndex];
    updateSlide({ ...currentSlide, transitionType });
  };

  const applyTransitionToAll = () => {
    if (!presentation) return;
    const currentTransition = presentation.slides[currentSlideIndex].transitionType || SlideTransition.FADE;
    const newSlides = presentation.slides.map(s => ({ ...s, transitionType: currentTransition }));
    setPresentation({ ...presentation, slides: newSlides });
  };

  const addSlide = () => {
    if (!presentation) return;
    const newSlide: Slide = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Slide',
      content: ['Add your content here'],
      layout: SlideLayout.BULLETS,
      transitionType: presentation.slides[currentSlideIndex]?.transitionType || SlideTransition.FADE,
      notes: ''
    };
    const newSlides = [...presentation.slides];
    newSlides.splice(currentSlideIndex + 1, 0, newSlide);
    setPresentation({ ...presentation, slides: newSlides });
    setCurrentSlideIndex(currentSlideIndex + 1);
  };

  const duplicateSlide = () => {
    if (!presentation) return;
    const currentSlide = presentation.slides[currentSlideIndex];
    const newSlide: Slide = {
      ...currentSlide,
      id: Math.random().toString(36).substr(2, 9),
      content: [...currentSlide.content]
    };
    const newSlides = [...presentation.slides];
    newSlides.splice(currentSlideIndex + 1, 0, newSlide);
    setPresentation({ ...presentation, slides: newSlides });
    setCurrentSlideIndex(currentSlideIndex + 1);
  };

  const confirmDeleteSlide = () => {
    if (!presentation || presentation.slides.length <= 1) return;
    const newSlides = presentation.slides.filter((_, i) => i !== currentSlideIndex);
    setPresentation({ ...presentation, slides: newSlides });
    setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1));
    setShowDeleteModal(false);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    setPresentation(prev => {
      if (!prev) return null;
      const newSlides = [...prev.slides];
      const draggedSlide = newSlides[draggedIndex];
      newSlides.splice(draggedIndex, 1);
      newSlides.splice(index, 0, draggedSlide);
      return { ...prev, slides: newSlides };
    });
    setDraggedIndex(index);
    if (currentSlideIndex === draggedIndex) {
      setCurrentSlideIndex(index);
    } else if (currentSlideIndex > draggedIndex && currentSlideIndex <= index) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    } else if (currentSlideIndex < draggedIndex && currentSlideIndex >= index) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const openImageModal = () => {
    if (!presentation) return;
    const currentSlide = presentation.slides[currentSlideIndex];
    setTempImagePrompt(currentSlide.imagePrompt || currentSlide.title);
    setShowImagePromptModal(true);
  };

  const openPresenterMode = () => {
    handleSave();
    window.open('#/present', 'PresenterWindow', 'width=1200,height=800');
  };

  const activeSlide = presentation?.slides[currentSlideIndex];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 overflow-hidden h-screen">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            Presentify AI
          </h1>
        </div>

        <div className="flex-1 max-w-2xl px-8 flex items-center space-x-2">
          <div className="relative flex-1 group">
            <input
              type="text"
              placeholder="Enter a new topic for a full slideshow..."
              className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-0 rounded-full py-2 px-6 pr-24 transition-all outline-none"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate(true)}
            />
            <button 
              onClick={() => handleGenerate(true)}
              disabled={isGenerating}
              className="absolute right-2 top-1 bottom-1 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-full text-sm font-medium transition-colors"
            >
              {isGenerating ? '...' : 'Create'}
            </button>
          </div>
          <button 
            onClick={handleLoadDemo}
            className="flex items-center space-x-2 px-4 py-2 border border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 rounded-full text-sm font-semibold transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <span>Demo</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
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

               <button 
                onClick={handleSave}
                className="flex items-center space-x-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm"
               >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                 </svg>
                 <span>Save</span>
               </button>
               
               <div className="relative export-menu-container">
                  <button 
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 transition-colors shadow-sm"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 8l-4-4m0 0l-4 4m4-4v12" />
                    </svg>
                    <span>Export</span>
                  </button>
                  
                  {showExportMenu && (
                    <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] p-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <button 
                        onClick={handleExportPDF}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-indigo-50 rounded-lg transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">Download as PDF</span>
                        </div>
                      </button>
                      
                      <button 
                        onClick={handleExportPPTX}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-orange-50 rounded-lg transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">Download as PPTX</span>
                        </div>
                      </button>
                    </div>
                  )}
               </div>
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
          
          <div className="flex-1 overflow-y-auto outline-none py-2 px-2 custom-scrollbar">
            {!isOutlineCollapsed ? (
              <div className="space-y-1">
                {presentation?.slides.map((slide, index) => (
                  <div
                    key={slide.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`group relative flex items-center p-2 rounded-lg cursor-pointer transition-all ${
                      currentSlideIndex === index 
                        ? 'bg-indigo-50 text-indigo-700' 
                        : 'hover:bg-slate-50 text-slate-600'
                    } ${draggedIndex === index ? 'opacity-40 grayscale scale-95' : ''}`}
                    onClick={() => setCurrentSlideIndex(index)}
                  >
                    <div className="mr-3 text-xs font-mono opacity-30 w-4">{index + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" dangerouslySetInnerHTML={{ __html: slide.title || 'Untitled Slide' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4 pt-2">
                {presentation?.slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlideIndex(index)}
                    className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                      currentSlideIndex === index ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!isOutlineCollapsed && (
            <div className="p-4 border-t bg-slate-50 shrink-0">
              <button 
                onClick={addSlide}
                disabled={!presentation}
                className="w-full flex items-center justify-center space-x-2 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 text-slate-600 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add New Slide</span>
              </button>
            </div>
          )}
        </aside>

        <div className="flex-1 overflow-y-auto p-12 bg-slate-100 flex flex-col items-center custom-scrollbar">
          {(isGenerating || isImageGenerating || isExporting) && statusMessage && (
            <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
               <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
               <p className="text-xl font-medium text-slate-800 animate-pulse">{statusMessage}</p>
            </div>
          )}

          {presentation && activeSlide ? (
            <div className="w-full max-w-5xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Slide {currentSlideIndex + 1}</span>
                  <h2 className="text-2xl font-bold text-slate-800">{presentation.title}</h2>
                </div>
                <div className="flex items-center space-x-2">
                   <button 
                    onClick={duplicateSlide}
                    className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                    title="Duplicate Slide"
                   >
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                     </svg>
                   </button>
                   <button 
                    onClick={() => setShowDeleteModal(true)}
                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Delete Slide"
                   >
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                     </svg>
                   </button>
                </div>
              </div>

              <SlideRenderer 
                key={`${currentSlideIndex}-${activeSlide.transitionType}`}
                slide={activeSlide} 
                onUpdate={updateSlide}
                isActive={true}
                onRegenerateImage={openImageModal}
                isImageLoading={isImageGenerating}
                transitionType={activeSlide.transitionType}
              />

              <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-200 flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-tighter">Layout</span>
                    {Object.values(SlideLayout).map(layout => (
                      <button
                        key={layout}
                        onClick={() => changeLayout(layout)}
                        className={`p-2 rounded-lg transition-all ${
                          activeSlide.layout === layout 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                            : 'hover:bg-slate-100 text-slate-600'
                        }`}
                        title={layout}
                      >
                        <LayoutIcon type={layout} />
                      </button>
                    ))}
                  </div>

                  <div className="h-8 w-px bg-slate-100 mx-4" />

                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-tighter">Transition</span>
                    <select 
                      value={activeSlide.transitionType}
                      onChange={(e) => changeTransition(e.target.value as SlideTransition)}
                      className="bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {Object.values(SlideTransition).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="h-8 w-px bg-slate-100 mx-4" />

                  <div className="flex items-center space-x-3">
                    <button 
                      onClick={openRegenSlideModal}
                      className="flex items-center space-x-2 text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-all font-semibold text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2m15.357 2H15" />
                      </svg>
                      <span>Regenerate Slide</span>
                    </button>

                    <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-xl">
                      <button 
                        onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                        disabled={currentSlideIndex === 0}
                        className="p-1.5 hover:bg-white disabled:opacity-30 rounded-lg transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="text-[10px] font-black text-slate-500 min-w-[2rem] text-center">
                        {currentSlideIndex + 1} / {presentation.slides.length}
                      </span>
                      <button 
                        onClick={() => setCurrentSlideIndex(Math.min(presentation.slides.length - 1, currentSlideIndex + 1))}
                        disabled={currentSlideIndex === presentation.slides.length - 1}
                        className="p-1.5 hover:bg-white disabled:opacity-30 rounded-lg transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Speaker Notes</span>
                  </div>
                  <textarea 
                    value={activeSlide.notes || ''}
                    onChange={(e) => updateSlide({...activeSlide, notes: e.target.value})}
                    placeholder="Add notes for the presenter here..."
                    className="w-full bg-slate-50 border-none focus:ring-1 focus:ring-indigo-100 rounded-xl p-3 text-sm text-slate-600 h-24 resize-none transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mt-20">
              <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-indigo-100/50 animate-bounce">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Create Professional Slides</h2>
              <p className="text-slate-500 mb-10 leading-relaxed text-lg">
                Enter a topic and watch as our AI creates a fully structured presentation with stunning layouts and rich content.
              </p>
            </div>
          )}
        </div>
      </main>

      <div ref={exportContainerRef} className="fixed -left-[10000px] top-0 pointer-events-none" style={{ width: '1280px' }}>
        {presentation?.slides.map(slide => (
          <div key={`export-${slide.id}`} style={{ width: '1280px', height: '720px', overflow: 'hidden' }}>
            <SlideRenderer slide={slide} onUpdate={() => {}} isActive={true} />
          </div>
        ))}
      </div>

      {showRegenSlideModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Regenerate Slide</h3>
            <textarea
              className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl p-3 text-sm outline-none transition-all h-40 resize-none font-medium text-slate-700"
              placeholder="Refine the slide prompt..."
              value={tempRegenPrompt}
              onChange={(e) => setTempRegenPrompt(e.target.value)}
            />
            <div className="flex justify-end mt-6 space-x-3">
              <button onClick={() => setShowRegenSlideModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={handleRefineSlideSubmit} disabled={isGenerating} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all">Regenerate</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6">
            <h3 className="text-xl font-bold text-slate-900 text-center">Delete Slide?</h3>
            <div className="flex flex-col space-y-2 mt-8">
              <button onClick={confirmDeleteSlide} className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all">Delete Slide</button>
              <button onClick={() => setShowDeleteModal(false)} className="w-full py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImagePromptModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Regenerate Image</h3>
            <textarea
              className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl p-3 text-sm outline-none transition-all h-32 resize-none"
              placeholder="e.g., A futuristic workspace..."
              value={tempImagePrompt}
              onChange={(e) => setTempImagePrompt(e.target.value)}
            />
            <div className="flex justify-end mt-6 space-x-3">
              <button onClick={() => setShowImagePromptModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={handleRegenerateImage} disabled={isImageGenerating} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all">Generate Image</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PresenterView: React.FC = () => {
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadFromStorage = useCallback(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const { presentation: savedPres, index } = JSON.parse(savedData);
        setPresentation(savedPres);
        setCurrentSlideIndex(index || 0);
      } catch (e) {
        console.error("Failed to load for presenter", e);
      }
    }
  }, []);

  useEffect(() => {
    loadFromStorage();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) loadFromStorage();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadFromStorage]);

  const updateSlideIndex = (newIndex: number) => {
    if (!presentation) return;
    const index = Math.max(0, Math.min(newIndex, presentation.slides.length - 1));
    setCurrentSlideIndex(index);
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, index }));
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
             <button 
              onClick={() => updateSlideIndex(currentSlideIndex - 1)}
              disabled={currentSlideIndex === 0}
              className="p-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-20 rounded-full transition-all"
             >
               <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
             </button>
             <button 
              onClick={() => updateSlideIndex(currentSlideIndex + 1)}
              disabled={currentSlideIndex === presentation.slides.length - 1}
              className="p-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20 rounded-full transition-all shadow-lg shadow-indigo-900/40"
             >
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
                {currentSlide.notes ? (
                  <p className="text-xl leading-relaxed text-slate-300 whitespace-pre-wrap">{currentSlide.notes}</p>
                ) : (
                  <p className="text-slate-600 italic">No notes for this slide.</p>
                )}
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
    case SlideLayout.TITLE: return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
    );
    case SlideLayout.BULLETS: return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
    );
    case SlideLayout.IMAGE_LEFT: return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v16H4V4zm10 4h6m-6 4h6m-6 4h6" /></svg>
    );
    case SlideLayout.IMAGE_RIGHT: return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 4h7v16h-7V4zM4 8h6m-6 4h6m-6 4h6" /></svg>
    );
    case SlideLayout.QUOTE: return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
    );
    case SlideLayout.TWO_COLUMN: return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v16H4V4zm9 0h7v16h-7V4z" /></svg>
    );
    default: return null;
  }
};

export default App;
