
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Slide, SlideLayout, SlideTransition, FloatingElement } from '../types';

interface SlideRendererProps {
  slide: Slide;
  onUpdate: (updatedSlide: Slide) => void;
  isActive: boolean;
  onRegenerateImage?: () => void;
  isImageLoading?: boolean;
  transitionType?: SlideTransition;
  disableTransitions?: boolean;
  isEditMode?: boolean;
}

const RichTextEditor: React.FC<{
  value: string;
  onUpdate: (val: string) => void;
  className: string;
  placeholder?: string;
  isFloating?: boolean;
}> = ({ value, onUpdate, className, placeholder, isFloating }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [activeStyles, setActiveStyles] = useState<{ [key: string]: any }>({});
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  
  const internalValueRef = useRef(value);
  const savedSelectionRef = useRef<Range | null>(null);
  
  const historyRef = useRef<string[]>([value]);
  const historyIndexRef = useRef<number>(0);
  
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current?.contains(selection.anchorNode)) {
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (savedSelectionRef.current && editorRef.current) {
      editorRef.current.focus();
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedSelectionRef.current);
      }
    }
  };

  const saveToHistory = (content: string) => {
    if (content === historyRef.current[historyIndexRef.current]) return;
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(content);
    if (newHistory.length > 50) newHistory.shift();
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
  };

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const val = historyRef.current[historyIndexRef.current];
      if (editorRef.current) {
        editorRef.current.innerHTML = val;
        internalValueRef.current = val;
      }
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const val = historyRef.current[historyIndexRef.current];
      if (editorRef.current) {
        editorRef.current.innerHTML = val;
        internalValueRef.current = val;
      }
    }
  };

  useLayoutEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || '';
      internalValueRef.current = value || '';
      historyRef.current = [value || ''];
      historyIndexRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;
    if (value !== internalValueRef.current) {
      if (!isFocused) {
        editorRef.current.innerHTML = value || '';
        internalValueRef.current = value || '';
        historyRef.current = [value || ''];
        historyIndexRef.current = 0;
      }
    }
  }, [value, isFocused]);

  const checkStyles = () => {
    let hasBullets = false;
    let hasNumbers = false;
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      const bulletPattern = /^[•·\-\*]\s/m;
      const numberPattern = /^\d+\.\s/m;
      hasBullets = bulletPattern.test(text);
      hasNumbers = numberPattern.test(text);
    }

    setActiveStyles({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikethrough: document.queryCommandState('strikethrough'),
      list: hasBullets,
      orderedList: hasNumbers,
      fontSize: document.queryCommandValue('fontSize'),
      alignLeft: document.queryCommandState('justifyLeft'),
      alignCenter: document.queryCommandState('justifyCenter'),
      alignRight: document.queryCommandState('justifyRight'),
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    });
  };

  const applyList = (listType: 'ul' | 'ol') => {
    if (!editorRef.current) return;
    let html = editorRef.current.innerHTML;
    const BREAK_MARKER = '{{BR}}';
    html = html
      .replace(/<br\s*\/?>/gi, BREAK_MARKER)
      .replace(/<\/div>/gi, BREAK_MARKER)
      .replace(/<\/p>/gi, BREAK_MARKER);
    const textWithMarkers = html.replace(/<[^>]*>/g, '');
    const lines = textWithMarkers.split(BREAK_MARKER);
    const bulletPattern = /^[•·\-\*]\s*/;
    const numberPattern = /^\d+\.\s*/;
    const hasBullets = lines.some(line => bulletPattern.test(line.trim()));
    const hasNumbers = lines.some(line => numberPattern.test(line.trim()));
    let newLines: string[];
    if (listType === 'ul') {
      if (hasBullets) {
        newLines = lines.map(line => line.replace(bulletPattern, ''));
      } else {
        newLines = lines.map(line => {
          const cleaned = line.replace(numberPattern, '').replace(bulletPattern, '');
          return cleaned.trim() ? '• ' + cleaned : cleaned;
        });
      }
    } else {
      if (hasNumbers) {
        newLines = lines.map(line => line.replace(numberPattern, ''));
      } else {
        let num = 1;
        newLines = lines.map(line => {
          const cleaned = line.replace(bulletPattern, '').replace(numberPattern, '');
          if (cleaned.trim()) return `${num++}. ${cleaned}`;
          return cleaned;
        });
      }
    }
    const newHtml = newLines.join('<br>');
    editorRef.current.innerHTML = newHtml;
    internalValueRef.current = newHtml;
    saveToHistory(newHtml);
    checkStyles();
  };

  const applyFormat = (command: string, arg?: string) => {
    if (command === 'insertUnorderedList') { applyList('ul'); return; }
    if (command === 'insertOrderedList') { applyList('ol'); return; }
    restoreSelection();
    document.execCommand(command, false, arg);
    checkStyles();
    if (editorRef.current) {
      internalValueRef.current = editorRef.current.innerHTML;
      saveToHistory(internalValueRef.current);
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    let content = target.innerHTML;
    if (target.innerText.toLowerCase().includes('::img')) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const placeholderHtml = `
        <div contenteditable="false" class="inline-block w-full h-32 my-4 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-xl flex flex-col items-center justify-center text-indigo-400 group/img">
          <svg class="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <span class="text-xs font-bold uppercase tracking-widest">Inline Image Block</span>
        </div>
      `;
      content = content.replace(/::img/gi, placeholderHtml);
      target.innerHTML = content;
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    internalValueRef.current = content;
    checkStyles();
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveToHistory(internalValueRef.current);
      checkStyles();
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) handleRedo(); else handleUndo();
      checkStyles();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      handleRedo();
      checkStyles();
    }
  };

  const handleFocus = () => { setIsFocused(true); checkStyles(); };

  const handleBlur = (e: React.FocusEvent) => {
    if (containerRef.current && containerRef.current.contains(e.relatedTarget as Node)) return;
    setIsFocused(false);
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      internalValueRef.current = currentHtml;
      saveToHistory(currentHtml);
      if (currentHtml !== value) onUpdate(currentHtml);
    }
  };

  const fontSizes = [
    { label: 'Tiny', value: '1' }, { label: 'Small', value: '2' }, { label: 'Normal', value: '3' }, 
    { label: 'Large', value: '4' }, { label: 'X-Large', value: '5' }, { label: 'XX-Large', value: '6' }, { label: 'Huge', value: '7' },
  ];

  return (
    <div 
      ref={containerRef}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`relative w-full group ${isFloating ? 'cursor-text' : ''}`}
    >
      {isFocused && (
        <div className={`absolute ${isFloating ? '-top-14' : '-top-12'} left-0 flex items-center bg-white shadow-xl border border-slate-200 rounded-lg p-1 z-[100] space-x-1 animate-in fade-in slide-in-from-bottom-2 duration-200`}>
          <button onMouseDown={(e) => { e.preventDefault(); handleUndo(); checkStyles(); }} disabled={!activeStyles.canUndo} className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${activeStyles.canUndo ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-300 opacity-50 cursor-not-allowed'}`} title="Undo"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" strokeWidth={2}/></svg></button>
          <button onMouseDown={(e) => { e.preventDefault(); handleRedo(); checkStyles(); }} disabled={!activeStyles.canRedo} className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${activeStyles.canRedo ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-300 opacity-50 cursor-not-allowed'}`} title="Redo"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" strokeWidth={2}/></svg></button>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }} className={`w-8 h-8 flex items-center justify-center rounded font-bold transition-colors ${activeStyles.bold ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-700'}`}>B</button>
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }} className={`w-8 h-8 flex items-center justify-center rounded italic transition-colors ${activeStyles.italic ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-700'}`}>I</button>
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }} className={`w-8 h-8 flex items-center justify-center rounded underline transition-colors ${activeStyles.underline ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-700'}`}>U</button>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <select className="text-[10px] font-bold h-8 px-2 rounded bg-slate-50 border-transparent outline-none cursor-pointer text-slate-600" value={activeStyles.fontSize || '3'} onChange={(e) => applyFormat('fontSize', e.target.value)}>{fontSizes.map(size => (<option key={size.value} value={size.value}>{size.label}</option>))}</select>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('insertUnorderedList'); }} className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${activeStyles.list ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-700'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="4" cy="6" r="2" /><circle cx="4" cy="12" r="2" /><circle cx="4" cy="18" r="2" /><rect x="9" y="5" width="12" height="2" rx="1" /><rect x="9" y="11" width="12" height="2" rx="1" /><rect x="9" y="17" width="12" height="2" rx="1" /></svg></button>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button onMouseDown={(e) => { e.preventDefault(); applyFormat('justifyCenter'); }} className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${activeStyles.alignCenter ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-700'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 6h16M7 12h10M4 18h16" strokeWidth={2}/></svg></button>
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={() => { checkStyles(); saveSelection(); }}
        onMouseUp={() => { checkStyles(); saveSelection(); }}
        className={`${className} focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded transition-all min-h-[1em]`}
      />
      {!value && !isFocused && placeholder && (
        <div className="absolute inset-0 pointer-events-none text-slate-300 px-1 py-1 italic">
          {placeholder}
        </div>
      )}
    </div>
  );
};

const SlideRenderer: React.FC<SlideRendererProps> = ({ slide, onUpdate, isActive, onRegenerateImage, isImageLoading, transitionType = SlideTransition.FADE, disableTransitions = false, isEditMode = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartOffset = useRef({ x: 0, y: 0 });

  const handleFieldChange = (field: keyof Slide, value: any) => {
    onUpdate({ ...slide, [field]: value });
  };

  const handleContentChange = (index: number, newValue: string) => {
    const newContent = [...slide.content];
    newContent[index] = newValue;
    handleFieldChange('content', newContent);
  };

  const addContentItem = () => handleFieldChange('content', [...slide.content, "New point..."]);

  const removeContentItem = (index: number) => {
    if (slide.content.length <= 1) return;
    const newContent = slide.content.filter((_, i) => i !== index);
    handleFieldChange('content', newContent);
  };

  // Dragging logic for floating elements
  const onFloatingMouseDown = (e: React.MouseEvent, elId: string) => {
    if (!isEditMode) return;
    e.stopPropagation();
    const el = slide.floatingElements?.find(f => f.id === elId);
    if (!el || !containerRef.current) return;
    
    setDraggingId(elId);
    const rect = containerRef.current.getBoundingClientRect();
    dragStartOffset.current = {
      x: e.clientX - (rect.left + (el.x * rect.width) / 100),
      y: e.clientY - (rect.top + (el.y * rect.height) / 100),
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingId || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newX = ((e.clientX - rect.left - dragStartOffset.current.x) / rect.width) * 100;
      const newY = ((e.clientY - rect.top - dragStartOffset.current.y) / rect.height) * 100;
      
      const updatedElements = slide.floatingElements?.map(el => 
        el.id === draggingId ? { ...el, x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) } : el
      );
      handleFieldChange('floatingElements', updatedElements);
    };

    const handleMouseUp = () => setDraggingId(null);

    if (draggingId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, slide.floatingElements]);

  const removeFloatingElement = (id: string) => {
    const updated = slide.floatingElements?.filter(f => f.id !== id);
    handleFieldChange('floatingElements', updated);
  };

  const ImageComponent = () => (
    <div className="bg-gray-100 rounded-xl overflow-hidden flex flex-col relative shadow-inner group h-full">
      <div className="relative flex-1 min-h-0 bg-slate-200 flex items-center justify-center">
        {isImageLoading ? (
          <div className="absolute inset-0 bg-slate-100/80 flex items-center justify-center z-10">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <button onClick={onRegenerateImage} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-semibold z-20"><div className="flex flex-col items-center"><svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span>Regenerate Image</span></div></button>
        )}
        {slide.imageUrl ? (<img src={slide.imageUrl} alt={slide.title} className="w-full h-full object-cover" />) : (<div className="flex flex-col items-center text-slate-400"><svg className="w-12 h-12 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Loading AI Visual...</span></div>)}
      </div>
      <div className="bg-white border-t p-3 shrink-0"><div className="flex items-center space-x-1 mb-1"><svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Prompt</span></div><div contentEditable suppressContentEditableWarning onBlur={(e) => handleFieldChange('imagePrompt', e.currentTarget.innerText)} className="text-[11px] text-slate-500 italic focus:outline-none focus:ring-1 focus:ring-indigo-500/30 rounded p-1.5 bg-slate-50 border border-transparent hover:border-slate-200 transition-all cursor-text min-h-[3em]">{slide.imagePrompt || ''}</div></div>
    </div>
  );

  const AddButton = () => (<button onClick={addContentItem} className="flex items-center space-x-2 text-sm text-indigo-500 hover:text-indigo-600 font-medium p-2 rounded-lg hover:bg-indigo-50 transition-all mt-2 group"><svg className="w-4 h-4 transform group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg><span>Add Item</span></button>);

  const RemoveButton = ({ index }: { index: number }) => (<button onClick={() => removeContentItem(index)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-400 transition-all rounded"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>);

  const renderContent = () => {
    switch (slide.layout) {
      case SlideLayout.TITLE:
        return (<div className="flex flex-col items-center justify-center h-full text-center space-y-6"><RichTextEditor key={`${slide.id}-title`} value={slide.title} onUpdate={(val) => handleFieldChange('title', val)} className="text-6xl font-bold text-gray-900" placeholder="Title" /><RichTextEditor key={`${slide.id}-subtitle`} value={slide.subtitle || ''} onUpdate={(val) => handleFieldChange('subtitle', val)} className="text-2xl text-gray-500" placeholder="Subtitle" /></div>);
      case SlideLayout.IMAGE_LEFT:
        return (<div className="grid grid-cols-2 h-full gap-8"><ImageComponent /><div className="flex flex-col justify-center space-y-4 overflow-hidden"><RichTextEditor key={`${slide.id}-title`} value={slide.title} onUpdate={(val) => handleFieldChange('title', val)} className="text-4xl font-bold text-gray-800" /><div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">{slide.content.map((item, i) => (<div key={`${slide.id}-item-${i}`} className="flex items-start group"><span className="mr-2 mt-2 w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" /><RichTextEditor key={`${slide.id}-content-${i}`} value={item} onUpdate={(val) => handleContentChange(i, val)} className="text-lg text-gray-600 flex-1" /><RemoveButton index={i} /></div>))}<AddButton /></div></div></div>);
      case SlideLayout.IMAGE_RIGHT:
        return (<div className="grid grid-cols-2 h-full gap-8"><div className="flex flex-col justify-center space-y-4 overflow-hidden"><RichTextEditor key={`${slide.id}-title`} value={slide.title} onUpdate={(val) => handleFieldChange('title', val)} className="text-4xl font-bold text-gray-800" /><div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">{slide.content.map((item, i) => (<div key={`${slide.id}-item-${i}`} className="flex items-start group"><span className="mr-2 mt-2 w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" /><RichTextEditor key={`${slide.id}-content-${i}`} value={item} onUpdate={(val) => handleContentChange(i, val)} className="text-lg text-gray-600 flex-1" /><RemoveButton index={i} /></div>))}<AddButton /></div></div><ImageComponent /></div>);
      case SlideLayout.QUOTE:
        return (<div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto space-y-8 italic"><div className="text-6xl text-indigo-300 select-none">"</div><RichTextEditor key={`${slide.id}-content-0`} value={slide.content[0] || ''} onUpdate={(val) => handleContentChange(0, val)} className="text-4xl font-medium text-gray-700 text-center leading-relaxed" placeholder="Write your quote here..." /><div className="h-1 w-20 bg-indigo-500"></div><RichTextEditor key={`${slide.id}-title`} value={slide.title} onUpdate={(val) => handleFieldChange('title', val)} className="text-2xl font-bold text-gray-900 not-italic text-center" placeholder="Author" /></div>);
      case SlideLayout.TWO_COLUMN:
        return (<div className="flex flex-col h-full space-y-6"><RichTextEditor key={`${slide.id}-title`} value={slide.title} onUpdate={(val) => handleFieldChange('title', val)} className="text-4xl font-bold text-gray-900 border-b pb-2" /><div className="grid grid-cols-2 gap-8 flex-1 overflow-hidden"><div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">{slide.content.slice(0, Math.ceil(slide.content.length / 2)).map((item, i) => (<div key={`${slide.id}-item-${i}`} className="flex items-start group"><span className="mr-2 mt-2 w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" /><RichTextEditor key={`${slide.id}-content-${i}`} value={item} onUpdate={(val) => handleContentChange(i, val)} className="text-lg text-gray-600 flex-1" /><RemoveButton index={i} /></div>))}{slide.content.length === 0 && <AddButton />}</div><div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">{slide.content.slice(Math.ceil(slide.content.length / 2)).map((item, i) => { const idx = i + Math.ceil(slide.content.length / 2); return (<div key={`${slide.id}-item-${idx}`} className="flex items-start group"><span className="mr-2 mt-2 w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" /><RichTextEditor key={`${slide.id}-content-${idx}`} value={item} onUpdate={(val) => handleContentChange(idx, val)} className="text-lg text-gray-600 flex-1" /><RemoveButton index={idx} /></div>); })}<AddButton /></div></div></div>);
      default:
        return (<div className="flex flex-col h-full space-y-8 overflow-hidden"><RichTextEditor key={`${slide.id}-title`} value={slide.title} onUpdate={(val) => handleFieldChange('title', val)} className="text-5xl font-bold text-gray-900 border-b-2 border-indigo-100 pb-4" /><div className="flex-1 overflow-y-auto pr-2 custom-scrollbar"><div className="space-y-4">{slide.content.map((item, i) => (<div key={`${slide.id}-item-${i}`} className="flex items-start p-2 hover:bg-gray-50 transition-colors rounded group"><span className="mr-3 mt-2 w-3 h-3 bg-indigo-500 rounded-full flex-shrink-0" /><RichTextEditor key={`${slide.id}-content-${i}`} value={item} onUpdate={(val) => handleContentChange(i, val)} className="text-xl text-gray-700 flex-1" /><RemoveButton index={i} /></div>))}</div><div className="mt-4"><AddButton /></div></div></div>);
    }
  };

  const currentTransition = slide.transitionType || transitionType || SlideTransition.FADE;
  const transitionClass = disableTransitions ? '' : (currentTransition === SlideTransition.SLIDE ? 'transition-slide-enter' : currentTransition === SlideTransition.ZOOM ? 'transition-zoom-enter' : 'transition-fade-enter');

  return (
    <div 
      ref={containerRef}
      className={`slide-aspect w-full bg-white shadow-2xl rounded-2xl p-12 relative ${isActive ? 'scale-100 opacity-100' : 'scale-95 opacity-50 blur-sm pointer-events-none'} ${isActive && !disableTransitions ? transitionClass : ''} overflow-hidden`}
    >
      {renderContent()}
      
      {/* Floating Elements Rendering */}
      {slide.floatingElements?.map((el) => (
        <div 
          key={el.id}
          style={{
            position: 'absolute',
            left: `${el.x}%`,
            top: `${el.y}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 40,
          }}
          className={`group/floating ${isEditMode ? 'hover:ring-2 hover:ring-indigo-400 p-2 rounded' : ''}`}
        >
          {isEditMode && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center space-x-1 opacity-0 group-hover/floating:opacity-100 transition-opacity bg-white shadow-lg border rounded-lg p-1 z-[110]">
              <div 
                className="cursor-move p-1 text-slate-400 hover:text-indigo-600" 
                onMouseDown={(e) => onFloatingMouseDown(e, el.id)}
              >
                 <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/></svg>
              </div>
              <button 
                onClick={() => removeFloatingElement(el.id)} 
                className="p-1 text-slate-300 hover:text-red-400"
              >
                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg>
              </button>
            </div>
          )}
          
          {el.type === 'text' ? (
            <RichTextEditor 
              value={el.content} 
              onUpdate={(val) => {
                const updated = slide.floatingElements?.map(f => f.id === el.id ? { ...f, content: val } : f);
                handleFieldChange('floatingElements', updated);
              }}
              className="min-w-[100px] text-lg text-slate-800 bg-white/50 backdrop-blur-sm px-2 rounded"
              isFloating={true}
            />
          ) : (
            <img src={el.content} alt="floating" className="max-w-[300px] max-h-[300px] object-contain shadow-xl rounded-lg" />
          )}
        </div>
      ))}
    </div>
  );
};

export default SlideRenderer;
