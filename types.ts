
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

export interface Slide {
  id: string;
  title: string;
  subtitle?: string;
  content: string[];
  layout: SlideLayout;
  imagePrompt?: string;
  imageUrl?: string;
  transitionType?: SlideTransition;
  notes?: string;
}

export interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
  transitionType?: SlideTransition;
}