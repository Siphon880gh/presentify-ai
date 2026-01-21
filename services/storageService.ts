/**
 * Storage Service - Repository Layer
 * 
 * This module re-exports all storage functions from the online storage service,
 * providing a unified interface for the application. The UI interacts with this
 * layer and never calls the API directly.
 */

export {
  // Types
  type PresentationMeta,
  type UserSettings,
  
  // Auth Repository
  signup,
  login,
  logout,
  getCurrentUser,
  getCurrentUserId,
  
  // Initialization
  initializeStorage,
  
  // Settings Repository
  getSettings,
  updateSettings,
  
  // Presentations Repository
  listPresentations,
  getPresentation,
  savePresentation,
  deletePresentation,
  
  // Session Repository
  saveCurrentSession,
  loadCurrentSession,
  clearCurrentSession,
  
  // Utility
  generateId,
} from './onlineStorageService';

/**
 * Placeholder for specifically saving/caching slide images if needed separately.
 * Images are stored as data URLs directly inside the presentation object.
 */
export const saveSlideImage = (slideId: string, imageData: string) => {
  // Images are stored as data URLs directly inside the presentation object.
  return true;
};
