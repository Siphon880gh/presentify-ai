import { Presentation } from '../types';

export interface PresentationMeta {
  id: string;
  title: string;
  updatedAt: string;
  slideCount: number;
}

export interface UserSettings {
  defaultAdvancedMode: boolean;
  autoplayDelay: number;
}

const DB_NAME = 'PresentifyDB';
const DB_VERSION = 1;
const STORES = {
  PRESENTATIONS: 'presentations',
  SESSION: 'session',
};

const KEYS = {
  SETTINGS: 'presentify_settings_v1',
};

/**
 * Lightweight IndexedDB wrapper
 */
const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.PRESENTATIONS)) {
        db.createObjectStore(STORES.PRESENTATIONS);
      }
      if (!db.objectStoreNames.contains(STORES.SESSION)) {
        db.createObjectStore(STORES.SESSION);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const dbOp = async <T>(storeName: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<T> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Generates a simple random ID for presentations and slides.
 */
export const generateId = () => Math.random().toString(36).substring(2, 11);

/**
 * Initializes the storage.
 */
export const initializeStorage = async () => {
  // Ensure DB is created
  await getDB();
  
  if (!localStorage.getItem(KEYS.SETTINGS)) {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify({
      defaultAdvancedMode: true,
      autoplayDelay: 2000,
    }));
  }
};

/**
 * Retrieves user preferences (Synchronous via localStorage).
 */
export const getSettings = (): UserSettings => {
  const s = localStorage.getItem(KEYS.SETTINGS);
  return s ? JSON.parse(s) : { defaultAdvancedMode: true, autoplayDelay: 2000 };
};

/**
 * Updates user preferences in local storage.
 */
export const updateSettings = (settings: Partial<UserSettings>) => {
  const current = getSettings();
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify({ ...current, ...settings }));
};

/**
 * Returns a list of presentation metadata for library views.
 */
export const listPresentations = async (): Promise<PresentationMeta[]> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PRESENTATIONS, 'readonly');
    const store = transaction.objectStore(STORES.PRESENTATIONS);
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result as Presentation[];
      resolve(all.map(p => ({
        id: p.id,
        title: p.title,
        updatedAt: (p as any).updatedAt || new Date().toISOString(),
        slideCount: p.slides?.length || 0,
      })));
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Fetches a full presentation object by its ID.
 */
export const getPresentation = async (id: string): Promise<Presentation | null> => {
  return dbOp<Presentation | null>(STORES.PRESENTATIONS, 'readonly', (store) => store.get(id));
};

/**
 * Saves or updates a presentation in the library.
 */
export const savePresentation = async (presentation: Presentation) => {
  const updated = {
    ...presentation,
    updatedAt: new Date().toISOString(),
  };
  await dbOp(STORES.PRESENTATIONS, 'readwrite', (store) => store.put(updated, presentation.id));
};

/**
 * Deletes a presentation from the library.
 */
export const deletePresentation = async (id: string) => {
  await dbOp(STORES.PRESENTATIONS, 'readwrite', (store) => store.delete(id));
};

/**
 * Persists the current active presentation and slide index.
 */
export const saveCurrentSession = async (presentation: Presentation, slideIndex: number) => {
  await dbOp(STORES.SESSION, 'readwrite', (store) => store.put({ presentation, slideIndex }, 'current'));
  return true;
};

/**
 * Loads the last active presentation and slide index.
 */
export const loadCurrentSession = async () => {
  const data = await dbOp<{ presentation: Presentation | null; slideIndex: number } | null>(
    STORES.SESSION, 
    'readonly', 
    (store) => store.get('current')
  );
  return data || { presentation: null, slideIndex: 0 };
};

/**
 * Placeholder for specifically saving/caching slide images if needed separately.
 */
export const saveSlideImage = (slideId: string, imageData: string) => {
  // Images are stored as data URLs directly inside the presentation object.
  return true;
};
