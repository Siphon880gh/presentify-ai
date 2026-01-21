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

const API_BASE = 'https://wengindustries.com/backend/presentify/api.php';

// In-memory state for current session
let currentToken: string | null = null;
let currentUser: User | null = null;

// ========== API Helper ==========

// Fixed generic syntax for .tsx files by using <T extends unknown> to prevent JSX ambiguity.
const apiCall = async <T extends unknown>(
  action: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  queryParams?: Record<string, string>
): Promise<T> => {
  const url = new URL(API_BASE);
  url.searchParams.set('action', action);
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  return data as T;
};

// ========== User/Auth Repository ==========

export const signup = async (
  email: string,
  password: string,
  displayName: string
): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    const result = await apiCall<{
      success: boolean;
      error?: string;
      user?: { _id: string; email: string; displayName: string; createdAt: string };
      token?: string;
    }>('signup', 'POST', { email, password, displayName });

    if (result.success && result.user && result.token) {
      currentToken = result.token;
      currentUser = {
        id: result.user._id,
        email: result.user.email,
        passwordHash: '', // Not returned from API
        displayName: result.user.displayName,
        createdAt: result.user.createdAt,
      };
      return { success: true, user: currentUser };
    }
    return { success: false, error: result.error || 'Signup failed' };
  } catch (err) {
    return { success: false, error: 'Network error' };
  }
};

export const login = async (
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    const result = await apiCall<{
      success: boolean;
      error?: string;
      user?: { _id: string; email: string; displayName: string; createdAt: string };
      token?: string;
    }>('login', 'POST', { email, password });

    if (result.success && result.user && result.token) {
      currentToken = result.token;
      currentUser = {
        id: result.user._id,
        email: result.user.email,
        passwordHash: '',
        displayName: result.user.displayName,
        createdAt: result.user.createdAt,
      };
      return { success: true, user: currentUser };
    }
    return { success: false, error: result.error || 'Login failed' };
  } catch (err) {
    return { success: false, error: 'Network error' };
  }
};

export const logout = () => {
  currentToken = null;
  currentUser = null;
};

export const getCurrentUser = (): User | null => {
  return currentUser;
};

export const getCurrentUserId = (): string | null => {
  return currentUser?.id || null;
};

// ========== Initialization ==========

export const initializeStorage = async () => {
  // For online mode, just verify API is reachable
  try {
    await apiCall<{ success: boolean }>('status', 'GET');
  } catch (err) {
    console.error('API not reachable');
  }
};

// ========== Settings Repository ==========

const DEFAULT_SETTINGS: UserSettings = {
  defaultAdvancedMode: true,
  autoplayDelay: 2000,
};

export const getSettings = async (): Promise<UserSettings> => {
  if (!currentToken) return DEFAULT_SETTINGS;

  try {
    const result = await apiCall<{ success: boolean; settings: UserSettings }>('settings', 'GET');
    if (result.success && result.settings) {
      return result.settings;
    }
  } catch (err) {
    console.error('Failed to get settings');
  }
  return DEFAULT_SETTINGS;
};

export const updateSettings = async (settings: Partial<UserSettings>) => {
  if (!currentToken) return;

  try {
    await apiCall('settings', 'PUT', settings);
  } catch (err) {
    console.error('Failed to update settings');
  }
};

// ========== Presentations Repository ==========

export const listPresentations = async (): Promise<PresentationMeta[]> => {
  if (!currentToken) return [];

  try {
    const result = await apiCall<{
      success: boolean;
      presentations: { _id: string; title: string; updatedAt: string; slideCount: number }[];
    }>('presentations', 'GET');

    if (result.success && result.presentations) {
      return result.presentations.map((p) => ({
        id: p._id,
        title: p.title,
        updatedAt: p.updatedAt,
        slideCount: p.slideCount,
      }));
    }
  } catch (err) {
    console.error('Failed to list presentations');
  }
  return [];
};

export const getPresentation = async (id: string): Promise<Presentation | null> => {
  if (!currentToken) return null;

  try {
    const result = await apiCall<{
      success: boolean;
      presentation: Presentation & { _id: string };
    }>('presentation', 'GET', undefined, { id });

    if (result.success && result.presentation) {
      return {
        ...result.presentation,
        id: result.presentation._id,
      };
    }
  } catch (err) {
    console.error('Failed to get presentation');
  }
  return null;
};

export const savePresentation = async (presentation: Presentation) => {
  if (!currentToken) return;

  try {
    // Check if presentation exists (has a valid MongoDB ObjectId format)
    const isNew = !presentation.id || presentation.id.length < 20;

    if (isNew) {
      const result = await apiCall<{
        success: boolean;
        presentation: { _id: string };
      }>('presentation', 'POST', {
        title: presentation.title,
        slides: presentation.slides,
        transitionType: presentation.transitionType,
        defaultVoiceName: presentation.defaultVoiceName,
      });
      if (result.success && result.presentation) {
        presentation.id = result.presentation._id;
      }
    } else {
      await apiCall('presentation', 'PUT', {
        title: presentation.title,
        slides: presentation.slides,
        transitionType: presentation.transitionType,
        defaultVoiceName: presentation.defaultVoiceName,
      }, { id: presentation.id });
    }
  } catch (err) {
    console.error('Failed to save presentation');
  }
};

export const deletePresentation = async (id: string) => {
  if (!currentToken) return;

  try {
    await apiCall('presentation', 'DELETE', undefined, { id });
  } catch (err) {
    console.error('Failed to delete presentation');
  }
};

// ========== Session Repository ==========

export const saveCurrentSession = async (presentation: Presentation, slideIndex: number) => {
  if (!currentToken) return false;

  try {
    await apiCall('session', 'PUT', { presentation, slideIndex });
    return true;
  } catch (err) {
    console.error('Failed to save session');
    return false;
  }
};

export const loadCurrentSession = async () => {
  if (!currentToken) return { presentation: null, slideIndex: 0 };

  try {
    const result = await apiCall<{
      success: boolean;
      session: { presentation: Presentation | null; slideIndex: number };
    }>('session', 'GET');

    if (result.success && result.session) {
      return result.session;
    }
  } catch (err) {
    console.error('Failed to load session');
  }
  return { presentation: null, slideIndex: 0 };
};

export const clearCurrentSession = async () => {
  if (!currentToken) return;

  try {
    await apiCall('session', 'DELETE');
  } catch (err) {
    console.error('Failed to clear session');
  }
};

// ========== Utility ==========

export const generateId = () => Math.random().toString(36).substring(2, 11);