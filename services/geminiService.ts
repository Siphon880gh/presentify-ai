import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SlideLayout, Slide, SlideTransition, Presentation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateImage = async (prompt: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: prompt,
        },
      ],
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image data returned from API");
};

export const generatePresentation = async (
  prompt: string, 
  context?: { text: string[], images: {data: string, mimeType: string}[] },
  existingPresentation?: Presentation,
  isAdvancedMode: boolean = true
): Promise<any> => {
  const contextParts: any[] = [];
  
  let userPrompt: string;
  
  if (isAdvancedMode) {
    // Advanced mode: Expert-level content with specific data points and nuanced perspectives
    userPrompt = `Create an expert-level presentation about: ${prompt}.

CONTENT QUALITY REQUIREMENTS:
- Write as a subject matter expert with deep domain knowledge
- Include specific data points, statistics, research findings, or concrete examples where relevant
- Avoid vague generalities—each bullet point should convey a distinct, substantive insight
- Present nuanced perspectives, including tradeoffs, counterarguments, or edge cases when appropriate
- Use precise terminology and industry-standard frameworks
- Ensure logical flow: each slide should build on previous concepts
- Speaker notes should provide additional depth, context, and talking points beyond the slide content

STRUCTURE REQUIREMENTS:
- Each slide should have a distinct layout and an appropriate transition type (FADE, SLIDE, or ZOOM)
- Content should progress from foundational concepts to advanced insights
- Include actionable takeaways or implications where applicable`;
  } else {
    // Simple mode: Standard professional presentation
    userPrompt = `Create a professional presentation about: ${prompt}. Each slide should have a distinct layout, an appropriate transition type (FADE, SLIDE, or ZOOM), and detailed speaker notes to help the presenter.`;
  }

  if (existingPresentation) {
    userPrompt += `\n\nREFINEMENT MODE: You are refining an EXISTING presentation titled "${existingPresentation.title}". 
    The current structure of the presentation is:
    ${existingPresentation.slides.map((s, i) => `Slide ${i + 1}: "${s.title}" (Content: ${s.content.join('; ')})`).join('\n')}
    
    INSTRUCTION: Update, reorder, or expand this presentation based on the new prompt: "${prompt}". You can add new slides, reorder them, or update existing content while preserving valuable information from the original.`;
  }

  if (context && (context.text.length > 0 || context.images.length > 0)) {
    userPrompt += `\n\nCRITICAL: Use the provided primary source material (attached text and images) as the basis for this presentation. Ensure the content is grounded in these facts and visuals.`;
    
    // Add text context as a part
    if (context.text.length > 0) {
      contextParts.push({ text: `PRIMARY SOURCE DOCUMENTS AND WEB CONTENT:\n${context.text.join('\n\n---\n\n')}` });
    }

    // Add image context as parts
    if (context.images.length > 0) {
      context.images.forEach(img => {
        contextParts.push({
          inlineData: {
            data: img.data.split(',')[1],
            mimeType: img.mimeType
          }
        });
      });
    }
  }

  contextParts.push({ text: userPrompt });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: contextParts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          slides: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                content: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                layout: {
                  type: Type.STRING,
                  enum: Object.values(SlideLayout)
                },
                transitionType: {
                  type: Type.STRING,
                  enum: Object.values(SlideTransition)
                },
                imagePrompt: { type: Type.STRING },
                notes: { type: Type.STRING, description: "Detailed speaker notes for this slide" }
              },
              required: ["title", "content", "layout", "transitionType", "notes"]
            }
          }
        },
        required: ["title", "slides"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const refineSlide = async (
  topic: string, 
  refinementPrompt: string, 
  currentSlide?: Slide, 
  isRefinementMode?: boolean,
  isAdvancedMode: boolean = true
): Promise<Partial<Slide>> => {
  let sysPrompt = `You are a professional presentation designer. Refine this slide for a presentation about "${topic}". 
    User Refinement Request: "${refinementPrompt}"`;

  if (isRefinementMode && currentSlide) {
    sysPrompt += `
    
    EXISTING SLIDE CONTENT TO BUILD UPON:
    - Title: ${currentSlide.title}
    - Subtitle: ${currentSlide.subtitle || 'None'}
    - Content: ${JSON.stringify(currentSlide.content)}
    
    CRITICAL INSTRUCTION: BUILD ON THE EXISTING CONTENT. Extend points or add new ones. DO NOT remove or reword existing content unless the user's prompt clearly requires a specific replacement or correction. Maintain the existing context while expanding.`;
  }

  if (isAdvancedMode) {
    sysPrompt += `
    
    QUALITY STANDARDS:
    - Content should be specific and substantive, not generic or vague
    - Include concrete examples, data, or evidence where relevant
    - Speaker notes should provide additional depth and context
    
    Ensure the layout is appropriate for the content. Return a JSON object with title, subtitle, content (array), layout, transitionType, imagePrompt, and notes.`;
  } else {
    sysPrompt += `
    
    Ensure the layout is appropriate for the content and include updated speaker notes. Return a JSON object with title, subtitle, content (array), layout, transitionType, imagePrompt, and notes.`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: sysPrompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subtitle: { type: Type.STRING },
          content: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          layout: {
            type: Type.STRING,
            enum: Object.values(SlideLayout)
          },
          transitionType: {
            type: Type.STRING,
            enum: Object.values(SlideTransition)
          },
          imagePrompt: { type: Type.STRING },
          notes: { type: Type.STRING }
        },
        required: ["title", "content", "layout", "transitionType", "notes"]
      }
    }
  });

  const slideData = JSON.parse(response.text || "{}");
  let imageUrl = undefined;
  if (slideData.imagePrompt) {
    try {
      imageUrl = await generateImage(slideData.imagePrompt);
    } catch (e) {
      console.error("Failed to generate refined slide image", e);
    }
  }
  
  return {
    ...slideData,
    imageUrl
  };
};

export const regenerateSlide = async (topic: string, slideContext: string, isAdvancedMode: boolean = true): Promise<Partial<Slide>> => {
  let contentPrompt: string;
  
  if (isAdvancedMode) {
    contentPrompt = `Regenerate a single slide for a presentation about ${topic}. The slide focus is: ${slideContext}.

Generate expert-level content with:
- Specific data, examples, or evidence rather than vague generalities
- Nuanced insights that demonstrate deep subject matter expertise
- Precise, actionable bullet points (not generic platitudes)
- Speaker notes that add depth beyond the visible content

Include an appropriate transition type. Return a JSON object with title, subtitle, content (array), layout, transitionType, imagePrompt, and notes.`;
  } else {
    contentPrompt = `Regenerate a single slide for a presentation about ${topic}. The slide focus is: ${slideContext}. Include an appropriate transition type and speaker notes. Return a JSON object with title, subtitle, content (array), layout, transitionType, imagePrompt, and notes.`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contentPrompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subtitle: { type: Type.STRING },
          content: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          layout: {
            type: Type.STRING,
            enum: Object.values(SlideLayout)
          },
          transitionType: {
            type: Type.STRING,
            enum: Object.values(SlideTransition)
          },
          imagePrompt: { type: Type.STRING },
          notes: { type: Type.STRING }
        },
        required: ["title", "content", "layout", "transitionType", "notes"]
      }
    }
  });

  const slideData = JSON.parse(response.text || "{}");
  let imageUrl = undefined;
  if (slideData.imagePrompt) {
    try {
      imageUrl = await generateImage(slideData.imagePrompt);
    } catch (e) {
      console.error("Failed to generate regenerated slide image", e);
    }
  }

  return {
    ...slideData,
    imageUrl
  };
};

export const speakText = async (text: string, voiceName: string = 'Zephyr'): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say clearly: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });
  const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64) throw new Error("No audio data");
  return base64;
};