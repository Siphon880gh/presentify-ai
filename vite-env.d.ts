// @google/genai Fix: Using shorthand module declarations for assets to resolve "Duplicate identifier 'src'" errors.
// This approach prevents conflicts that arise when internal variable names are reused in multiple 
// module augmentations or when manual declarations merge with other provided type definitions.

declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.gif';
