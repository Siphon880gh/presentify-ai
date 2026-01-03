
import { GoogleGenAI, Type } from "@google/genai";
import { SlideLayout, Slide } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generatePresentation = async (prompt: string): Promise<any> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Create a professional 7-10 slide presentation about: ${prompt}. Each slide should have a distinct layout.`,
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
                imagePrompt: { type: Type.STRING }
              },
              required: ["title", "content", "layout"]
            }
          }
        },
        required: ["title", "slides"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const regenerateSlide = async (topic: string, slideContext: string): Promise<Slide> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Regenerate a single slide for a presentation about ${topic}. The slide focus is: ${slideContext}.`,
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
          imagePrompt: { type: Type.STRING }
        },
        required: ["title", "content", "layout"]
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
