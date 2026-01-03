
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Presentation, Slide, SlideLayout, SlideTransition } from './types';
import { generatePresentation, regenerateSlide, generateImage, refineSlide } from './services/geminiService';
import SlideRenderer from './components/SlideRenderer';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import pptxgen from 'pptxgenjs';

const STORAGE_KEY = 'presentify_saved_presentation';

const DEMO_PRESENTATION: Presentation = {
  id: 'demo-123',
  title: 'The Future of Urban Mobility',
  slides: [
    {
      id: 's1',
      title: 'The Future of Urban Mobility',
      subtitle: 'Sustainable, Smart, and Seamless Transportation',
      content: [],
      layout: SlideLayout.TITLE,
      imagePrompt: 'Futuristic city with flying taxis and electric pods, sunset, hyper-realistic',
      transitionType: SlideTransition.ZOOM
    },
    {
      id: 's2',
      title: 'Current Challenges',
      content: [
        'Urban congestion costs cities billions annually',
        'Rising CO2 emissions from traditional combustion engines',
        'Lack of first-mile and last-mile connectivity',
        'Infrastructure aging and inefficiency'
      ],
      layout: SlideLayout.BULLETS,
      imagePrompt: 'Busy city traffic jam, moody lighting',
      transitionType: SlideTransition.FADE
    },
    {
      id: 's3',
      title: 'Electrification & Zero Emissions',
      content: [
        'Electric vehicles (EVs) are now reaching price parity with gas cars.',
        'Battery technology is doubling in efficiency every 5 years.',
        'Cities like Oslo and Paris are banning fossil fuel cars by 2030.'
      ],
      layout: SlideLayout.IMAGE_LEFT,
      imagePrompt: 'Sleek electric car charging at a high-tech station',
      transitionType: SlideTransition.SLIDE
    },
    {
      id: 's4',
      title: 'A Visionary Perspective',
      content: ['"The city of the future is a city built for people, not for cars. Mobility is the bridge between isolation and community."'],
      layout: SlideLayout.QUOTE,
      transitionType: SlideTransition.FADE
    },
    {
      id: 's5',
      title: 'Key Strategic Pillars',
      content: [
        'Autonomous Public Transit',
        'Micromobility (E-bikes & Scooters)',
        'Urban Air Mobility (eVTOL)',
        'Smart Traffic Management'
      ],
      layout: SlideLayout.TWO_COLUMN,
      imagePrompt: 'A futuristic floating transit pod over a park',
      transitionType: SlideTransition.ZOOM
    }
  ]
};

const App: React.FC = () => {
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

  const handleLoadDemo = async () => {
    setIsImageGenerating(true);
    setStatusMessage('Generating high-quality visuals for demo...');
    try {
      const slidesWithImages = await Promise.all(DEMO_PRESENTATION.slides.map(async (s) => {
        let imageUrl = `https://picsum.photos/seed/${s.id}/800/600`;
        if (s.imagePrompt) {
          try {
            imageUrl = await generateImage(s.imagePrompt);
          } catch (e) {
            console.error("Failed to generate demo image", e);
            imageUrl = `https://picsum.photos/seed/${encodeURIComponent(s.imagePrompt)}/800/600`;
          }
        }
        return { ...s, imageUrl };
      }));

      setPresentation({
        ...DEMO_PRESENTATION,
        slides: slidesWithImages
      });
      setCurrentSlideIndex(0);
      setLastSaved(null);
    } catch (error) {
      console.error(error);
      alert('Failed to load demo visuals.');
    } finally {
      setIsImageGenerating(false);
      setStatusMessage('');
    }
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
            if (slide.imageUrl) pSlide.addImage({ data: slide.imageUrl, x: 0.5, y: 1, w: 4, h: 3.5 });
            pSlide.addText(cleanTitle, { x: 5, y: 1, w: 4.5, fontSize: 28, bold: true, color: '333333' });
            pSlide.addText(cleanContent.map(text => ({ text, options: { bullet: true } })), { x: 5, y: 2, w: 4.5, fontSize: 16, color: '555555' });
            break;

          case SlideLayout.IMAGE_RIGHT:
            pSlide.addText(cleanTitle, { x: 0.5, y: 1, w: 4.5, fontSize: 28, bold: true, color: '333333' });
            pSlide.addText(cleanContent.map(text => ({ text, options: { bullet: true } })), { x: 0.5, y: 2, w: 4.5, fontSize: 16, color: '555555' });
            if (slide.imageUrl) pSlide.addImage({ data: slide.imageUrl, x: 5.5, y: 1, w: 4, h: 3.5 });
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
      transitionType: presentation.slides[currentSlideIndex]?.transitionType || SlideTransition.FADE
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

        <div className="flex-1 max-w-3xl px-8 flex items-center space-x-2">
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
               <div className="flex flex-col items-end mr-2">
                 {lastSaved && (
                   <span className="text-[10px] text-slate-400 font-medium">Last saved: {lastSaved}</span>
                 )}
               </div>
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
                    <svg className={`ml-2 w-4 h-4 transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
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
                          <span className="text-[10px] text-slate-400">High-fidelity slide capture</span>
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
                          <span className="text-[10px] text-slate-400">Editable PowerPoint file</span>
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
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 text-slate-300">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>
                  </div>
                ))}
                {!presentation && (
                  <div className="text-center py-10 px-4">
                    <p className="text-slate-400 text-xs">Enter a topic or try the demo</p>
                  </div>
                )}
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
            <div className="w-full max-w-5xl space-y-8">
              <div className="flex items-center justify-between mb-2">
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

              <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-200 flex items-center justify-between sticky bottom-0 z-40">
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
                      title={layout.replace('_', ' ')}
                    >
                      <LayoutIcon type={layout} />
                    </button>
                  ))}
                </div>

                <div className="h-8 w-px bg-slate-100 mx-4" />

                <div className="flex items-center space-x-1">
                  <span className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-tighter">Transition</span>
                  <div className="relative group/trans-drop">
                    <button className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-widest transition-all">
                      <span>{activeSlide.transitionType || 'FADE'}</span>
                      <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {/* Hover Bridge and Dropdown */}
                    <div className="absolute bottom-full left-0 hidden group-hover/trans-drop:block z-50 animate-in fade-in slide-in-from-bottom-2">
                       <div className="pb-2 w-40 h-2 bg-transparent"></div> {/* Bridge to prevent hover flicker */}
                       <div className="bg-white shadow-2xl border border-slate-100 rounded-xl p-1 w-40">
                         {Object.values(SlideTransition).map(t => (
                          <button
                            key={t}
                            onClick={() => changeTransition(t)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors ${activeSlide.transitionType === t ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}
                          >
                            {t}
                          </button>
                        ))}
                        <div className="h-px bg-slate-100 my-1 mx-1" />
                        <button 
                          onClick={applyTransitionToAll}
                          className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-indigo-500 hover:bg-indigo-50 transition-colors"
                        >
                          Apply to all
                        </button>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-100 mx-4" />

                <div className="flex items-center">
                  <div className="flex items-center bg-indigo-50 rounded-xl p-0.5 group/regen-split relative">
                    <button 
                      onClick={openRegenSlideModal}
                      className="flex items-center space-x-2 text-indigo-600 hover:bg-white px-4 py-2 rounded-lg transition-all font-semibold"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2m15.357 2H15" />
                      </svg>
                      <span className="text-sm">Regenerate</span>
                    </button>
                    
                    <div className="relative group/regen-drop h-full flex items-center">
                      <button className="h-full px-2 border-l border-indigo-200/50 hover:bg-white text-indigo-400 transition-colors rounded-r-lg">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {/* Hover Bridge and Dropdown */}
                      <div className="absolute bottom-full right-0 hidden group-hover/regen-drop:block z-[60] animate-in fade-in slide-in-from-bottom-2">
                        <div className="pb-2 w-56 h-2 bg-transparent"></div> {/* Bridge to prevent hover flicker */}
                        <div className="bg-white shadow-2xl border border-slate-100 rounded-xl p-1 w-56">
                          <button 
                            onClick={openRegenSlideModal}
                            className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-slate-50 rounded-lg transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800">Regenerate Slide</span>
                              <span className="text-[10px] text-slate-400 text-wrap">Refine only this current slide</span>
                            </div>
                          </button>
                          <button 
                            onClick={() => handleGenerate(false)}
                            className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-slate-50 rounded-lg transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800">Regenerate All</span>
                              <span className="text-[10px] text-slate-400 text-wrap">Rebuild the whole slideshow</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 bg-slate-50 p-1.5 rounded-xl ml-4">
                    <button 
                      onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                      disabled={currentSlideIndex === 0}
                      className="p-2 hover:bg-white disabled:opacity-30 rounded-lg shadow-sm transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-xs font-black text-slate-500 min-w-[3rem] text-center">
                      {currentSlideIndex + 1} / {presentation.slides.length}
                    </span>
                    <button 
                      onClick={() => setCurrentSlideIndex(Math.min(presentation.slides.length - 1, currentSlideIndex + 1))}
                      disabled={currentSlideIndex === presentation.slides.length - 1}
                      className="p-2 hover:bg-white disabled:opacity-30 rounded-lg shadow-sm transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
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
              <div className="flex flex-wrap justify-center gap-3">
                 {['The Future of Web 3.0', 'Climate Change Strategies', 'Startup Pitch Deck', 'Quantum Computing 101'].map(tag => (
                   <button 
                    key={tag}
                    onClick={() => setPrompt(tag)}
                    className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-md transition-all"
                   >
                     {tag}
                   </button>
                 ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Hidden container for full presentation export rendering */}
      <div 
        ref={exportContainerRef}
        className="fixed -left-[10000px] top-0 pointer-events-none"
        style={{ width: '1280px' }}
      >
        {presentation?.slides.map(slide => (
          <div key={`export-${slide.id}`} style={{ width: '1280px', height: '720px', overflow: 'hidden' }}>
            <SlideRenderer 
              slide={slide} 
              onUpdate={() => {}} 
              isActive={true} 
            />
          </div>
        ))}
      </div>

      {/* Regen Slide Modal */}
      {showRegenSlideModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">Regenerate Slide</h3>
              <button 
                onClick={() => setShowRegenSlideModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Refine this slide by modifying its prompt. You can change the focus or ask for specific details.
            </p>
            <textarea
              className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl p-3 text-sm outline-none transition-all h-40 resize-none font-medium text-slate-700"
              placeholder="Refine the slide prompt..."
              value={tempRegenPrompt}
              onChange={(e) => setTempRegenPrompt(e.target.value)}
            />
            <div className="flex justify-end mt-6 space-x-3">
              <button 
                onClick={() => setShowRegenSlideModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleRefineSlideSubmit}
                disabled={isGenerating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : 'Regenerate Slide'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Delete Slide?</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  Are you sure you want to delete this slide? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex flex-col space-y-2 mt-8">
              <button 
                onClick={confirmDeleteSlide}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-100"
              >
                Delete Slide
              </button>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="w-full py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showImagePromptModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">Regenerate Image</h3>
              <button 
                onClick={() => setShowImagePromptModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Describe the image you want for this slide. Our AI will generate it in seconds.
            </p>
            <textarea
              className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl p-3 text-sm outline-none transition-all h-32 resize-none"
              placeholder="e.g., A futuristic workspace with holographic screens, soft blue lighting..."
              value={tempImagePrompt}
              onChange={(e) => setTempImagePrompt(e.target.value)}
            />
            <div className="flex justify-end mt-6 space-x-3">
              <button 
                onClick={() => setShowImagePromptModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleRegenerateImage}
                disabled={isImageGenerating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                {isImageGenerating ? 'Generating...' : 'Generate Image'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-white border-t py-3 px-6 flex justify-between items-center text-[10px] text-slate-400 shrink-0 font-medium">
        <p>© 2024 Presentify AI. All content AI-generated.</p>
        <div className="flex items-center space-x-6 uppercase tracking-widest">
          <span>Editable Slides</span>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>AI Online</span>
          </div>
        </div>
      </footer>
    </div>
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
