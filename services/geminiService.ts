import { GoogleGenAI, Type } from "@google/genai";
import { SlideLayout, Slide, SlideTransition } from "../types";

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
  context?: { text: string[], images: {data: string, mimeType: string}[] }
): Promise<any> => {
  const contextParts: any[] = [];
  
  let userPrompt = `Create a professional presentation about: ${prompt}. Each slide should have a distinct layout, an appropriate transition type (FADE, SLIDE, or ZOOM), and detailed speaker notes to help the presenter.`;

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

export const refineSlide = async (topic: string, refinementPrompt: string): Promise<Partial<Slide>> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are a professional presentation designer. Refine this slide for a presentation about "${topic}". 
    User Refinement Request: "${refinementPrompt}"
    
    Ensure the layout is appropriate for the new content and include updated speaker notes. Return a JSON object with title, subtitle, content (array), layout, transitionType, imagePrompt, and notes.`,
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

export const regenerateSlide = async (topic: string, slideContext: string): Promise<Partial<Slide>> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Regenerate a single slide for a presentation about ${topic}. The slide focus is: ${slideContext}. Include an appropriate transition type and speaker notes. Return a JSON object with title, subtitle, content (array), layout, transitionType, imagePrompt, and notes.`,
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