
import React, { useState, useRef, useEffect } from 'react';
import { Slide, SlideLayout } from '../types';

interface SlideRendererProps {
  slide: Slide;
  onUpdate: (updatedSlide: Slide) => void;
  isActive: boolean;
  onRegenerateImage?: () => void;
  isImageLoading?: boolean;
}

const RichTextEditor: React.FC<{
  value: string;
  onUpdate: (val: string) => void;
  className: string;
  placeholder?: string;
}> = ({ value, onUpdate, className, placeholder }) => {
  const [isFocused, setIsFocused] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const applyFormat = (command: string) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.innerText;
    // Simple logic to detect ::img and replace with a placeholder block
    // We use innerHTML for the transformation but be careful with cursor positioning
    if (text.toLowerCase().includes('::img')) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      const range = selection.getRangeAt(0);
      const content = e.currentTarget.innerHTML;
      
      // Replace ::img with a styled visual placeholder
      const placeholderHtml = `
        <div contenteditable="false" class="inline-block w-full h-32 my-4 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-xl flex flex-col items-center justify-center text-indigo-400 group/img">
          <svg class="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span class="text-xs font-bold uppercase tracking-widest">Inline Image Block</span>
          <div class="mt-2 text-[10px] text-indigo-300">Click slide image button to populate</div>
        </div>
      `;
      
      const newHtml = content.replace(/::img/gi, placeholderHtml);
      e.currentTarget.innerHTML = newHtml;
      
      // Move cursor after the new element if possible
      const newRange = document.createRange();
      newRange.setStartAfter(e.currentTarget.lastChild!);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  };

  return (
    <div className="relative w-full group">
      {isFocused && (
        <div className="absolute -top-12 left-0 flex items-center bg-white shadow-xl border border-slate-200 rounded-lg p-1 z-30 space-x-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button 
            onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }}
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded font-bold text-slate-700"
            title="Bold (Ctrl+B)"
          >
            B
          </button>
          <button 
            onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }}
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded italic text-slate-700 font-serif"
            title="Italic (Ctrl+I)"
          >
            I
          </button>
          <button 
            onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }}
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded underline text-slate-700"
            title="Underline (Ctrl+U)"
          >
            U
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button 
            onMouseDown={(e) => { e.preventDefault(); applyFormat('insertUnorderedList'); }}
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded text-slate-700"
            title="Bullet List"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <div className="px-2 text-[10px] font-bold text-indigo-400">Type "::img" for image</div>
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => setIsFocused(true)}
        onInput={handleInput}
        onBlur={(e) => {
          setIsFocused(false);
          onUpdate(e.currentTarget.innerHTML);
        }}
        dangerouslySetInnerHTML={{ __html: value || '' }}
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

const SlideRenderer: React.FC<SlideRendererProps> = ({ slide, onUpdate, isActive, onRegenerateImage, isImageLoading }) => {
  const handleFieldChange = (field: keyof Slide, value: any) => {
    onUpdate({ ...slide, [field]: value });
  };

  const handleContentChange = (index: number, newValue: string) => {
    const newContent = [...slide.content];
    newContent[index] = newValue;
    handleFieldChange('content', newContent);
  };

  const addContentItem = () => {
    handleFieldChange('content', [...slide.content, "New point..."]);
  };

  const removeContentItem = (index: number) => {
    if (slide.content.length <= 1) return;
    const newContent = slide.content.filter((_, i) => i !== index);
    handleFieldChange('content', newContent);
  };

  const ImageComponent = () => (
    <div className="bg-gray-100 rounded-xl overflow-hidden flex flex-col relative shadow-inner group h-full">
      <div className="relative flex-1 min-h-0 bg-slate-200">
        {isImageLoading ? (
          <div className="absolute inset-0 bg-slate-100/80 flex items-center justify-center z-10">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <button 
            onClick={onRegenerateImage}
            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-semibold z-20"
          >
            <div className="flex flex-col items-center">
              <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Regenerate Image</span>
            </div>
          </button>
        )}
        <img 
          src={slide.imageUrl || `https://picsum.photos/seed/${slide.id}/800/600`} 
          alt={slide.title} 
          className="w-full h-full object-cover"
        />
      </div>
      <div className="bg-white border-t p-3 shrink-0">
        <div className="flex items-center space-x-1 mb-1">
          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Prompt</span>
        </div>
        <div 
          contentEditable 
          suppressContentEditableWarning
          onBlur={(e) => handleFieldChange('imagePrompt', e.currentTarget.innerText)}
          className="text-[11px] text-slate-500 italic focus:outline-none focus:ring-1 focus:ring-indigo-500/30 rounded p-1.5 bg-slate-50 border border-transparent hover:border-slate-200 transition-all cursor-text min-h-[3em]"
        >
          {slide.imagePrompt || ''}
        </div>
      </div>
    </div>
  );

  const AddButton = () => (
    <button 
      onClick={addContentItem}
      className="flex items-center space-x-2 text-sm text-indigo-500 hover:text-indigo-600 font-medium p-2 rounded-lg hover:bg-indigo-50 transition-all mt-2 group"
    >
      <svg className="w-4 h-4 transform group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      <span>Add Item</span>
    </button>
  );

  const RemoveButton = ({ index }: { index: number }) => (
    <button 
      onClick={() => removeContentItem(index)}
      className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-400 transition-all rounded"
      title="Remove point"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );

  const renderContent = () => {
    switch (slide.layout) {
      case SlideLayout.TITLE:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <RichTextEditor 
              value={slide.title}
              onUpdate={(val) => handleFieldChange('title', val)}
              className="text-6xl font-bold text-gray-900"
              placeholder="Title"
            />
            <RichTextEditor 
              value={slide.subtitle || ''}
              onUpdate={(val) => handleFieldChange('subtitle', val)}
              className="text-2xl text-gray-500"
              placeholder="Subtitle"
            />
          </div>
        );

      case SlideLayout.IMAGE_LEFT:
        return (
          <div className="grid grid-cols-2 h-full gap-8">
            <ImageComponent />
            <div className="flex flex-col justify-center space-y-4 overflow-hidden">
              <RichTextEditor 
                value={slide.title}
                onUpdate={(val) => handleFieldChange('title', val)}
                className="text-4xl font-bold text-gray-800"
              />
              <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                {slide.content.map((item, i) => (
                  <div key={i} className="flex items-start group">
                    <span className="mr-2 mt-2 w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
                    <RichTextEditor 
                      value={item}
                      onUpdate={(val) => handleContentChange(i, val)}
                      className="text-lg text-gray-600 flex-1"
                    />
                    <RemoveButton index={i} />
                  </div>
                ))}
                <AddButton />
              </div>
            </div>
          </div>
        );

      case SlideLayout.IMAGE_RIGHT:
        return (
          <div className="grid grid-cols-2 h-full gap-8">
            <div className="flex flex-col justify-center space-y-4 overflow-hidden">
              <RichTextEditor 
                value={slide.title}
                onUpdate={(val) => handleFieldChange('title', val)}
                className="text-4xl font-bold text-gray-800"
              />
              <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                {slide.content.map((item, i) => (
                  <div key={i} className="flex items-start group">
                    <span className="mr-2 mt-2 w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
                    <RichTextEditor 
                      value={item}
                      onUpdate={(val) => handleContentChange(i, val)}
                      className="text-lg text-gray-600 flex-1"
                    />
                    <RemoveButton index={i} />
                  </div>
                ))}
                <AddButton />
              </div>
            </div>
            <ImageComponent />
          </div>
        );

      case SlideLayout.QUOTE:
        return (
          <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto space-y-8 italic">
             <div className="text-6xl text-indigo-300 select-none">"</div>
             <RichTextEditor 
                value={slide.content[0] || ''}
                onUpdate={(val) => handleContentChange(0, val)}
                className="text-4xl font-medium text-gray-700 text-center leading-relaxed"
                placeholder="Write your quote here..."
             />
             <div className="h-1 w-20 bg-indigo-500"></div>
             <RichTextEditor 
                value={slide.title}
                onUpdate={(val) => handleFieldChange('title', val)}
                className="text-2xl font-bold text-gray-900 not-italic text-center"
                placeholder="Author"
             />
          </div>
        );

      case SlideLayout.TWO_COLUMN:
        return (
          <div className="flex flex-col h-full space-y-6">
            <RichTextEditor 
              value={slide.title}
              onUpdate={(val) => handleFieldChange('title', val)}
              className="text-4xl font-bold text-gray-900 border-b pb-2"
            />
            <div className="grid grid-cols-2 gap-8 flex-1 overflow-hidden">
              <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                 {slide.content.slice(0, Math.ceil(slide.content.length / 2)).map((item, i) => (
                    <div key={i} className="flex items-start group">
                      <span className="mr-2 mt-2 w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
                      <RichTextEditor 
                        value={item}
                        onUpdate={(val) => handleContentChange(i, val)}
                        className="text-lg text-gray-600 flex-1"
                      />
                      <RemoveButton index={i} />
                    </div>
                 ))}
                 {/* Only show add button once in column flow */}
                 {slide.content.length === 0 && <AddButton />}
              </div>
              <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                 {slide.content.slice(Math.ceil(slide.content.length / 2)).map((item, i) => {
                    const idx = i + Math.ceil(slide.content.length / 2);
                    return (
                      <div key={idx} className="flex items-start group">
                        <span className="mr-2 mt-2 w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
                        <RichTextEditor 
                          value={item}
                          onUpdate={(val) => handleContentChange(idx, val)}
                          className="text-lg text-gray-600 flex-1"
                        />
                        <RemoveButton index={idx} />
                      </div>
                    );
                 })}
                 <AddButton />
              </div>
            </div>
          </div>
        );

      default: // BULLETS
        return (
          <div className="flex flex-col h-full space-y-8 overflow-hidden">
            <RichTextEditor 
              value={slide.title}
              onUpdate={(val) => handleFieldChange('title', val)}
              className="text-5xl font-bold text-gray-900 border-b-2 border-indigo-100 pb-4"
            />
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-4">
                {slide.content.map((item, i) => (
                  <div key={i} className="flex items-start p-2 hover:bg-gray-50 transition-colors rounded group">
                    <span className="mr-3 mt-2 w-3 h-3 bg-indigo-500 rounded-full flex-shrink-0" />
                    <RichTextEditor 
                      value={item}
                      onUpdate={(val) => handleContentChange(i, val)}
                      className="text-xl text-gray-700 flex-1"
                    />
                    <RemoveButton index={i} />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <AddButton />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`slide-aspect w-full bg-white shadow-2xl rounded-2xl p-12 transition-all duration-300 relative ${isActive ? 'scale-100 opacity-100' : 'scale-95 opacity-50 blur-sm pointer-events-none'}`}>
      {renderContent()}
    </div>
  );
};

export default SlideRenderer;
