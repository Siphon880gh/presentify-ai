
import React from 'react';
import { Slide, SlideLayout } from '../types';

interface SlideRendererProps {
  slide: Slide;
  onUpdate: (updatedSlide: Slide) => void;
  isActive: boolean;
}

const SlideRenderer: React.FC<SlideRendererProps> = ({ slide, onUpdate, isActive }) => {
  const handleTextChange = (field: keyof Slide, value: string | string[], index?: number) => {
    if (Array.isArray(value) && typeof index === 'number') {
      const newContent = [...slide.content];
      newContent[index] = value[index];
      onUpdate({ ...slide, content: newContent });
    } else {
      onUpdate({ ...slide, [field]: value });
    }
  };

  const renderContent = () => {
    switch (slide.layout) {
      case SlideLayout.TITLE:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <h1 
              contentEditable 
              suppressContentEditableWarning
              onBlur={(e) => handleTextChange('title', e.currentTarget.innerText)}
              className="text-6xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-2"
            >
              {slide.title}
            </h1>
            <p 
              contentEditable 
              suppressContentEditableWarning
              onBlur={(e) => handleTextChange('subtitle', e.currentTarget.innerText)}
              className="text-2xl text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-2"
            >
              {slide.subtitle}
            </p>
          </div>
        );

      case SlideLayout.IMAGE_LEFT:
        return (
          <div className="grid grid-cols-2 h-full gap-8">
            <div className="bg-gray-200 rounded-xl overflow-hidden flex items-center justify-center relative group">
              <img 
                src={slide.imageUrl || `https://picsum.photos/seed/${slide.id}/800/600`} 
                alt={slide.title} 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col justify-center space-y-4">
              <h2 
                contentEditable 
                suppressContentEditableWarning
                onBlur={(e) => handleTextChange('title', e.currentTarget.innerText)}
                className="text-4xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-1"
              >
                {slide.title}
              </h2>
              <ul className="space-y-3">
                {slide.content.map((item, i) => (
                  <li 
                    key={i} 
                    contentEditable 
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const newContent = [...slide.content];
                      newContent[i] = e.currentTarget.innerText;
                      handleTextChange('content', newContent);
                    }}
                    className="text-lg text-gray-600 flex items-start focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-1"
                  >
                    <span className="mr-2 mt-2 w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );

      case SlideLayout.IMAGE_RIGHT:
        return (
          <div className="grid grid-cols-2 h-full gap-8">
            <div className="flex flex-col justify-center space-y-4">
              <h2 
                contentEditable 
                suppressContentEditableWarning
                onBlur={(e) => handleTextChange('title', e.currentTarget.innerText)}
                className="text-4xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-1"
              >
                {slide.title}
              </h2>
              <ul className="space-y-3">
                {slide.content.map((item, i) => (
                  <li 
                    key={i} 
                    contentEditable 
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const newContent = [...slide.content];
                      newContent[i] = e.currentTarget.innerText;
                      handleTextChange('content', newContent);
                    }}
                    className="text-lg text-gray-600 flex items-start focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-1"
                  >
                    <span className="mr-2 mt-2 w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-200 rounded-xl overflow-hidden flex items-center justify-center">
              <img 
                src={slide.imageUrl || `https://picsum.photos/seed/${slide.id}/800/600`} 
                alt={slide.title} 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        );

      case SlideLayout.QUOTE:
        return (
          <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto space-y-8 italic">
             <div className="text-6xl text-indigo-300">"</div>
             <p 
                contentEditable 
                suppressContentEditableWarning
                onBlur={(e) => {
                    const newContent = [e.currentTarget.innerText];
                    handleTextChange('content', newContent);
                }}
                className="text-4xl font-medium text-gray-700 text-center leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-2"
             >
                {slide.content[0]}
             </p>
             <div className="h-1 w-20 bg-indigo-500"></div>
             <h3 
                contentEditable 
                suppressContentEditableWarning
                onBlur={(e) => handleTextChange('title', e.currentTarget.innerText)}
                className="text-2xl font-bold text-gray-900 not-italic focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-1"
             >
                — {slide.title}
             </h3>
          </div>
        );

      default: // BULLETS and others
        return (
          <div className="flex flex-col h-full space-y-8">
            <h2 
              contentEditable 
              suppressContentEditableWarning
              onBlur={(e) => handleTextChange('title', e.currentTarget.innerText)}
              className="text-5xl font-bold text-gray-900 border-b-2 border-indigo-100 pb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-1"
            >
              {slide.title}
            </h2>
            <div className="grid grid-cols-1 gap-6">
              <ul className="space-y-4">
                {slide.content.map((item, i) => (
                  <li 
                    key={i} 
                    contentEditable 
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const newContent = [...slide.content];
                      newContent[i] = e.currentTarget.innerText;
                      handleTextChange('content', newContent);
                    }}
                    className="text-xl text-gray-700 flex items-start focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-2 hover:bg-gray-50 transition-colors"
                  >
                    <span className="mr-3 mt-2 w-3 h-3 bg-indigo-500 rounded-full flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`slide-aspect w-full bg-white shadow-2xl rounded-2xl p-12 transition-all duration-300 ${isActive ? 'scale-100 opacity-100' : 'scale-95 opacity-50 blur-sm pointer-events-none'}`}>
      {renderContent()}
    </div>
  );
};

export default SlideRenderer;
