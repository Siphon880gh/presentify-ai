
import React, { useState, useCallback, useEffect } from 'react';
import { Presentation, Slide, SlideLayout } from './types';
import { generatePresentation, regenerateSlide } from './services/geminiService';
import SlideRenderer from './components/SlideRenderer';

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setStatusMessage('Brainstorming topics...');
    
    try {
      const data = await generatePresentation(prompt);
      const slidesWithIds = data.slides.map((s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9),
        imageUrl: s.imagePrompt ? `https://picsum.photos/seed/${encodeURIComponent(s.imagePrompt)}/800/600` : `https://picsum.photos/seed/${Math.random()}/800/600`
      }));
      
      setPresentation({
        id: Math.random().toString(36).substr(2, 9),
        title: data.title,
        slides: slidesWithIds
      });
      setCurrentSlideIndex(0);
    } catch (error) {
      console.error(error);
      alert('Failed to generate presentation. Please try again.');
    } finally {
      setIsGenerating(false);
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

  const handleRegenerateSlide = async () => {
    if (!presentation) return;
    setIsGenerating(true);
    setStatusMessage('Polishing this slide...');
    try {
      const currentSlide = presentation.slides[currentSlideIndex];
      const newSlide = await regenerateSlide(presentation.title, currentSlide.title);
      updateSlide(newSlide);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const changeLayout = (layout: SlideLayout) => {
    if (!presentation) return;
    const currentSlide = presentation.slides[currentSlideIndex];
    updateSlide({ ...currentSlide, layout });
  };

  const addSlide = () => {
    if (!presentation) return;
    const newSlide: Slide = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Slide',
      content: ['Add your content here'],
      layout: SlideLayout.BULLETS,
    };
    const newSlides = [...presentation.slides];
    newSlides.splice(currentSlideIndex + 1, 0, newSlide);
    setPresentation({ ...presentation, slides: newSlides });
    setCurrentSlideIndex(currentSlideIndex + 1);
  };

  const deleteSlide = () => {
    if (!presentation || presentation.slides.length <= 1) return;
    const newSlides = presentation.slides.filter((_, i) => i !== currentSlideIndex);
    setPresentation({ ...presentation, slides: newSlides });
    setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50">
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

        <div className="flex-1 max-w-2xl px-8">
          <div className="relative group">
            <input
              type="text"
              placeholder="What's your presentation about?"
              className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-0 rounded-full py-2 px-6 pr-12 transition-all outline-none"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="absolute right-2 top-1 bottom-1 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-full text-sm font-medium transition-colors"
            >
              {isGenerating ? '...' : 'Create'}
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
           {presentation && (
             <button className="flex items-center space-x-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 transition-colors">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 8l-4-4m0 0l-4 4m4-4v12" />
               </svg>
               <span>Export</span>
             </button>
           )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white border-r flex flex-col">
          <div className="p-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Slides</h3>
            <div className="space-y-2">
              {presentation?.slides.map((slide, index) => (
                <button
                  key={slide.id}
                  onClick={() => setCurrentSlideIndex(index)}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-all flex items-start space-x-3 ${
                    currentSlideIndex === index 
                      ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600 font-medium' 
                      : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="opacity-50 mt-0.5">{index + 1}</span>
                  <span className="truncate">{slide.title || 'Untitled Slide'}</span>
                </button>
              ))}
              {!presentation && (
                <div className="text-center py-10 px-4">
                  <p className="text-slate-400 text-sm">Enter a prompt to generate slides</p>
                </div>
              )}
            </div>
          </div>
          <div className="p-4 border-t">
            <button 
              onClick={addSlide}
              disabled={!presentation}
              className="w-full flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Slide</span>
            </button>
          </div>
        </aside>

        {/* Canvas Area */}
        <div className="flex-1 overflow-y-auto p-12 bg-slate-100 flex flex-col items-center">
          {isGenerating && statusMessage && (
            <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
               <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
               <p className="text-xl font-medium text-slate-800 animate-pulse">{statusMessage}</p>
            </div>
          )}

          {presentation ? (
            <div className="w-full max-w-5xl space-y-8">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-slate-800">{presentation.title}</h2>
                <div className="flex items-center space-x-2">
                   <button 
                    onClick={deleteSlide}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Slide"
                   >
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                     </svg>
                   </button>
                </div>
              </div>

              <SlideRenderer 
                slide={presentation.slides[currentSlideIndex]} 
                onUpdate={updateSlide}
                isActive={true}
              />

              {/* Toolbar */}
              <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <span className="text-xs font-bold text-slate-400 mr-2 uppercase">Layouts:</span>
                  {Object.values(SlideLayout).map(layout => (
                    <button
                      key={layout}
                      onClick={() => changeLayout(layout)}
                      className={`p-2 rounded-lg transition-all ${
                        presentation.slides[currentSlideIndex].layout === layout 
                          ? 'bg-indigo-600 text-white' 
                          : 'hover:bg-slate-100 text-slate-600'
                      }`}
                      title={layout.replace('_', ' ')}
                    >
                      <LayoutIcon type={layout} />
                    </button>
                  ))}
                </div>

                <div className="h-6 w-px bg-slate-200" />

                <div className="flex items-center space-x-4">
                  <button 
                    onClick={handleRegenerateSlide}
                    className="flex items-center space-x-2 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="text-sm font-medium">Magic Fix</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                      disabled={currentSlideIndex === 0}
                      className="p-2 hover:bg-slate-100 disabled:opacity-30 rounded-lg"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm font-medium text-slate-600">
                      {currentSlideIndex + 1} / {presentation.slides.length}
                    </span>
                    <button 
                      onClick={() => setCurrentSlideIndex(Math.min(presentation.slides.length - 1, currentSlideIndex + 1))}
                      disabled={currentSlideIndex === presentation.slides.length - 1}
                      className="p-2 hover:bg-slate-100 disabled:opacity-30 rounded-lg"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg">
              <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mb-6 animate-bounce">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-4">Start your story</h2>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Describe the presentation you want to create. Our AI will research, structure, and design your slides in seconds.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                 {['Future of AI', 'Sustainability 2025', 'Company Offsite', 'Space Exploration'].map(tag => (
                   <button 
                    key={tag}
                    onClick={() => setPrompt(tag)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm"
                   >
                     {tag}
                   </button>
                 ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-2 px-6 flex justify-between items-center text-xs text-slate-400">
        <p>© 2024 Presentify AI. All content AI-generated.</p>
        <div className="flex items-center space-x-4">
          <span>Press <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border">Enter</kbd> to edit any slide</span>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span>AI Ready</span>
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
