export enum SlideLayout {
  TITLE = 'TITLE',
  BULLETS = 'BULLETS',
  IMAGE_LEFT = 'IMAGE_LEFT',
  IMAGE_RIGHT = 'IMAGE_RIGHT',
  QUOTE = 'QUOTE',
  TWO_COLUMN = 'TWO_COLUMN'
}

export enum SlideTransition {
  FADE = 'FADE',
  SLIDE = 'SLIDE',
  ZOOM = 'ZOOM'
}

export interface FloatingElement {
  id: string;
  type: 'text' | 'image';
  content: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width?: number;
  height?: number;
}

export interface Slide {
  id: string;
  title: string;
  subtitle?: string;
  content: string[];
  layout: SlideLayout;
  imagePrompt?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  transitionType?: SlideTransition;
  notes?: string;
  floatingElements?: FloatingElement[];
}

export interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
  transitionType?: SlideTransition;
}