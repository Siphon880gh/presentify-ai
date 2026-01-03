
import { GoogleGenAI, Type } from "@google/genai";
import { SlideLayout, Slide, SlideTransition } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generatePresentation = async (prompt: string): Promise<any> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Create a professional 7-10 slide presentation about: ${prompt}. Each slide should have a distinct layout and an appropriate transition type (FADE, SLIDE, or ZOOM).`,
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
                imagePrompt: { type: Type.STRING }
              },
              required: ["title", "content", "layout", "transitionType"]
            }
          }
        },
        required: ["title", "slides"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const refineSlide = async (topic: string, refinementPrompt: string): Promise<Slide> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are a professional presentation designer. Refine this slide for a presentation about "${topic}". 
    User Refinement Request: "${refinementPrompt}"
    
    Ensure the layout is appropriate for the new content.`,
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
          imagePrompt: { type: Type.STRING }
        },
        required: ["title", "content", "layout", "transitionType"]
      }
    }
  });

  const slideData = JSON.parse(response.text || "{}");
  return {
    ...slideData,
    id: Math.random().toString(36).substr(2, 9),
    imageUrl: slideData.imagePrompt ? `https://picsum.photos/seed/${encodeURIComponent(slideData.imagePrompt)}/800/600` : undefined
  };
};

export const regenerateSlide = async (topic: string, slideContext: string): Promise<Slide> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Regenerate a single slide for a presentation about ${topic}. The slide focus is: ${slideContext}. Include an appropriate transition type.`,
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
          imagePrompt: { type: Type.STRING }
        },
        required: ["title", "content", "layout", "transitionType"]
      }
    }
  });

  const slideData = JSON.parse(response.text || "{}");
  return {
    ...slideData,
    id: Math.random().toString(36).substr(2, 9),
    imageUrl: slideData.imagePrompt ? `https://picsum.photos/seed/${encodeURIComponent(slideData.imagePrompt)}/800/600` : undefined
  };
};

export const generateImage = async (prompt: string): Promise<string> => {
  const aiImage = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await aiImage.models.generateContent({
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
