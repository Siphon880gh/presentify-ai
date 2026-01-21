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
const LS_TOKEN_KEY = 'presentify_token';
const LS_USER_KEY = 'presentify_user';
const LS_SETTINGS_KEY = 'presentify_settings_cache';

const DEFAULT_SETTINGS: UserSettings = {
  defaultAdvancedMode: true,
  autoplayDelay: 2000,
};

// ========== API Helper ==========

const apiCall = async <T extends unknown>(
  action: string,
  method: string = 'GET',
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

  const token = localStorage.getItem(LS_TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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
      const user: User = {
        id: result.user._id,
        email: result.user.email,
        passwordHash: '',
        displayName: result.user.displayName,
        createdAt: result.user.createdAt,
      };
      localStorage.setItem(LS_TOKEN_KEY, result.token);
      localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
      return { success: true, user };
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
      const user: User = {
        id: result.user._id,
        email: result.user.email,
        passwordHash: '',
        displayName: result.user.displayName,
        createdAt: result.user.createdAt,
      };
      localStorage.setItem(LS_TOKEN_KEY, result.token);
      localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
      return { success: true, user };
    }
    return { success: false, error: result.error || 'Login failed' };
  } catch (err) {
    return { success: false, error: 'Network error' };
  }
};

export const logout = () => {
  localStorage.removeItem(LS_TOKEN_KEY);
  localStorage.removeItem(LS_USER_KEY);
  localStorage.removeItem(LS_SETTINGS_KEY);
};

export const getCurrentUser = (): User | null => {
  const saved = localStorage.getItem(LS_USER_KEY);
  return saved ? JSON.parse(saved) : null;
};

export const getCurrentUserId = (): string | null => {
  return getCurrentUser()?.id || null;
};

// ========== Initialization & Settings ==========

export const initializeStorage = async () => {
  if (localStorage.getItem(LS_TOKEN_KEY)) {
    try {
      const result = await apiCall<{ success: boolean; settings: UserSettings }>('settings', 'GET');
      if (result.success && result.settings) {
        localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(result.settings));
      }
    } catch (err) {
      console.error('API not reachable or session expired');
    }
  }
};

export const getSettings = (): UserSettings => {
  const saved = localStorage.getItem(LS_SETTINGS_KEY);
  return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
};

export const updateSettings = (settings: Partial<UserSettings>) => {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(updated));
  
  // Fire and forget API update
  apiCall('settings', 'PUT', settings).catch(err => console.error('Failed to sync settings', err));
};

// ========== Presentations Repository ==========

export const listPresentations = async (): Promise<PresentationMeta[]> => {
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
  try {
    // MongoDB ObjectIds are 24 chars. generateId produces 9 chars. 
    const isNew = !presentation.id || presentation.id.length < 20;

    const payload = {
      title: presentation.title,
      slides: presentation.slides,
      transitionType: presentation.transitionType,
      defaultVoiceName: presentation.defaultVoiceName,
    };

    if (isNew) {
      const result = await apiCall<{
        success: boolean;
        presentation: { _id: string };
      }>('presentation', 'POST', payload);
      if (result.success && result.presentation) {
        presentation.id = result.presentation._id;
      }
    } else {
      await apiCall('presentation', 'PUT', payload, { id: presentation.id });
    }
  } catch (err) {
    console.error('Failed to save presentation');
  }
};

export const deletePresentation = async (id: string) => {
  try {
    await apiCall('presentation', 'DELETE', undefined, { id });
  } catch (err) {
    console.error('Failed to delete presentation');
  }
};

// ========== Session Repository ==========

export const saveCurrentSession = async (presentation: Presentation, slideIndex: number) => {
  try {
    await apiCall('session', 'PUT', { presentation, slideIndex });
    return true;
  } catch (err) {
    console.error('Failed to save session');
    return false;
  }
};

export const loadCurrentSession = async () => {
  try {
    const result = await apiCall<{
      success: boolean;
      session: { presentation: Presentation | null; slideIndex: number };
    }>('session', 'GET');

    if (result.success && result.session) {
      // Map _id to id if necessary
      if (result.session.presentation && (result.session.presentation as any)._id) {
        result.session.presentation.id = (result.session.presentation as any)._id;
      }
      return result.session;
    }
  } catch (err) {
    console.error('Failed to load session');
  }
  return { presentation: null, slideIndex: 0 };
};

export const clearCurrentSession = async () => {
  try {
    await apiCall('session', 'DELETE');
  } catch (err) {
    console.error('Failed to clear session');
  }
};

// ========== Utility ==========

export const generateId = () => Math.random().toString(36).substring(2, 11);

export const saveSlideImage = (slideId: string, imageData: string) => {
  return true; // Images are embedded in presentation slides
};
