import { Presentation, User } from '../types';

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
const DB_VERSION = 2;
const STORES = {
  PRESENTATIONS: 'presentations',
  SESSION: 'session',
};

// LocalStorage keys organized as "tables" for easy debugging
const LS_TABLES = {
  USERS: 'presentify_users',           // User[] - all user accounts
  AUTH_SESSION: 'presentify_auth',     // { userId: string } - current logged-in user
  SETTINGS: 'presentify_settings',     // { [userId]: UserSettings } - per-user settings
};

// Simple hash function for passwords (local-only, not cryptographically secure)
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

// ========== User/Auth Repository ==========

const getUsers = (): User[] => {
  const data = localStorage.getItem(LS_TABLES.USERS);
  return data ? JSON.parse(data) : [];
};

const saveUsers = (users: User[]) => {
  localStorage.setItem(LS_TABLES.USERS, JSON.stringify(users));
};

export const signup = (email: string, password: string, displayName: string): { success: boolean; error?: string; user?: User } => {
  const users = getUsers();
  const normalizedEmail = email.toLowerCase().trim();
  
  if (users.find(u => u.email === normalizedEmail)) {
    return { success: false, error: 'Email already registered' };
  }
  
  const newUser: User = {
    id: generateId(),
    email: normalizedEmail,
    passwordHash: simpleHash(password),
    displayName: displayName.trim(),
    createdAt: new Date().toISOString(),
  };
  
  users.push(newUser);
  saveUsers(users);
  
  // Auto-login after signup
  localStorage.setItem(LS_TABLES.AUTH_SESSION, JSON.stringify({ userId: newUser.id }));
  
  return { success: true, user: newUser };
};

export const login = (email: string, password: string): { success: boolean; error?: string; user?: User } => {
  const users = getUsers();
  const normalizedEmail = email.toLowerCase().trim();
  const user = users.find(u => u.email === normalizedEmail);
  
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  if (user.passwordHash !== simpleHash(password)) {
    return { success: false, error: 'Incorrect password' };
  }
  
  localStorage.setItem(LS_TABLES.AUTH_SESSION, JSON.stringify({ userId: user.id }));
  return { success: true, user };
};

export const logout = () => {
  localStorage.removeItem(LS_TABLES.AUTH_SESSION);
};

export const getCurrentUser = (): User | null => {
  const session = localStorage.getItem(LS_TABLES.AUTH_SESSION);
  if (!session) return null;
  
  const { userId } = JSON.parse(session);
  const users = getUsers();
  return users.find(u => u.id === userId) || null;
};

export const getCurrentUserId = (): string | null => {
  const session = localStorage.getItem(LS_TABLES.AUTH_SESSION);
  if (!session) return null;
  return JSON.parse(session).userId;
};

/**
 * Lightweight IndexedDB wrapper
 */
const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      // Create presentations store with userId index for multi-user queries
      if (!db.objectStoreNames.contains(STORES.PRESENTATIONS)) {
        const presStore = db.createObjectStore(STORES.PRESENTATIONS, { keyPath: 'id' });
        presStore.createIndex('userId', 'userId', { unique: false });
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
  
  // Initialize settings table if not exists
  if (!localStorage.getItem(LS_TABLES.SETTINGS)) {
    localStorage.setItem(LS_TABLES.SETTINGS, JSON.stringify({}));
  }
};

const DEFAULT_SETTINGS: UserSettings = {
  defaultAdvancedMode: true,
  autoplayDelay: 2000,
};

/**
 * Retrieves user preferences for the current user (Synchronous via localStorage).
 */
export const getSettings = (): UserSettings => {
  const userId = getCurrentUserId();
  if (!userId) return DEFAULT_SETTINGS;
  
  const allSettings = JSON.parse(localStorage.getItem(LS_TABLES.SETTINGS) || '{}');
  return allSettings[userId] || DEFAULT_SETTINGS;
};

/**
 * Updates user preferences in local storage for the current user.
 */
export const updateSettings = (settings: Partial<UserSettings>) => {
  const userId = getCurrentUserId();
  if (!userId) return;
  
  const allSettings = JSON.parse(localStorage.getItem(LS_TABLES.SETTINGS) || '{}');
  const current = allSettings[userId] || DEFAULT_SETTINGS;
  allSettings[userId] = { ...current, ...settings };
  localStorage.setItem(LS_TABLES.SETTINGS, JSON.stringify(allSettings));
};

/**
 * Returns a list of presentation metadata for the current user.
 */
export const listPresentations = async (): Promise<PresentationMeta[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];
  
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PRESENTATIONS, 'readonly');
    const store = transaction.objectStore(STORES.PRESENTATIONS);
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result as Presentation[];
      // Filter by current user
      const userPresentations = all.filter(p => p.userId === userId);
      resolve(userPresentations.map(p => ({
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
 * Fetches a full presentation object by its ID (only if owned by current user).
 */
export const getPresentation = async (id: string): Promise<Presentation | null> => {
  const userId = getCurrentUserId();
  if (!userId) return null;
  
  const presentation = await dbOp<Presentation | null>(STORES.PRESENTATIONS, 'readonly', (store) => store.get(id));
  // Only return if owned by current user
  if (presentation && presentation.userId === userId) {
    return presentation;
  }
  return null;
};

/**
 * Saves or updates a presentation in the library for the current user.
 */
export const savePresentation = async (presentation: Presentation) => {
  const userId = getCurrentUserId();
  if (!userId) return;
  
  const updated = {
    ...presentation,
    userId,
    updatedAt: new Date().toISOString(),
  };
  await dbOp(STORES.PRESENTATIONS, 'readwrite', (store) => store.put(updated));
};

/**
 * Deletes a presentation from the library (only if owned by current user).
 */
export const deletePresentation = async (id: string) => {
  const userId = getCurrentUserId();
  if (!userId) return;
  
  // Verify ownership before deleting
  const presentation = await getPresentation(id);
  if (presentation && presentation.userId === userId) {
    await dbOp(STORES.PRESENTATIONS, 'readwrite', (store) => store.delete(id));
  }
};

/**
 * Persists the current active presentation and slide index for the current user.
 */
export const saveCurrentSession = async (presentation: Presentation, slideIndex: number) => {
  const userId = getCurrentUserId();
  if (!userId) return false;
  
  const sessionKey = `user_${userId}_current`;
  await dbOp(STORES.SESSION, 'readwrite', (store) => store.put({ presentation, slideIndex }, sessionKey));
  return true;
};

/**
 * Loads the last active presentation and slide index for the current user.
 */
export const loadCurrentSession = async () => {
  const userId = getCurrentUserId();
  if (!userId) return { presentation: null, slideIndex: 0 };
  
  const sessionKey = `user_${userId}_current`;
  const data = await dbOp<{ presentation: Presentation | null; slideIndex: number } | null>(
    STORES.SESSION, 
    'readonly', 
    (store) => store.get(sessionKey)
  );
  return data || { presentation: null, slideIndex: 0 };
};

/**
 * Clears the current session for the user (used on logout).
 */
export const clearCurrentSession = async () => {
  const userId = getCurrentUserId();
  if (!userId) return;
  
  const sessionKey = `user_${userId}_current`;
  await dbOp(STORES.SESSION, 'readwrite', (store) => store.delete(sessionKey));
};

/**
 * Placeholder for specifically saving/caching slide images if needed separately.
 */
export const saveSlideImage = (slideId: string, imageData: string) => {
  // Images are stored as data URLs directly inside the presentation object.
  return true;
};
