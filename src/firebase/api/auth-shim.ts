/**
 * Firebase Auth compatibility shim — redirects auth to REST API + JWT.
 */

import { api, setAuthToken, getAuthToken } from '@/lib/api-client';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface Auth {
  _type: 'api-auth';
  currentUser: User | null;
}

type AuthCallback = (user: User | null) => void;
const listeners: AuthCallback[] = [];
let currentUser: User | null = null;

function notifyListeners() {
  listeners.forEach((cb) => cb(currentUser));
}

export function getAuth(_app?: unknown): Auth {
  return { _type: 'api-auth', currentUser };
}

export function onAuthStateChanged(_auth: Auth, callback: AuthCallback): () => void {
  listeners.push(callback);

  // Initial check
  const token = getAuthToken();
  if (token && !currentUser) {
    api.me()
      .then((res) => {
        currentUser = { uid: res.user.uid, email: res.user.email, displayName: null };
        callback(currentUser);
      })
      .catch(() => {
        setAuthToken(null);
        currentUser = null;
        callback(null);
      });
  } else {
    callback(currentUser);
  }

  return () => {
    const idx = listeners.indexOf(callback);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export async function signInWithEmailAndPassword(
  _auth: Auth,
  email: string,
  password: string
) {
  const result = await api.login({ email, password });
  setAuthToken(result.token);
  currentUser = {
    uid: result.user.uid,
    email: result.user.email,
    displayName: result.user.displayName || null,
  };
  notifyListeners();
  return { user: currentUser };
}

export async function createUserWithEmailAndPassword(
  _auth: Auth,
  _email: string,
  _password: string
) {
  throw new Error('Use o fluxo de primeiro acesso com QRA');
}

export async function updateProfile(user: User, profile: { displayName?: string }) {
  if (profile.displayName) {
    currentUser = { ...user, displayName: profile.displayName };
    notifyListeners();
  }
}

export async function sendPasswordResetEmail(_auth: Auth, _email: string) {
  await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: _email }),
  });
}

export async function updatePassword(_user: User, _newPassword: string) {
  throw new Error('Alteração de senha via API em desenvolvimento');
}

export async function signOut(_auth: Auth) {
  setAuthToken(null);
  currentUser = null;
  notifyListeners();
}

// Helper used by login page for QRA-based login
export async function signInWithQra(_auth: Auth, qra: string, password: string) {
  const result = await api.login({ qra, password });
  setAuthToken(result.token);
  currentUser = {
    uid: result.user.uid,
    email: result.user.email,
    displayName: result.user.displayName || null,
  };
  notifyListeners();
  return { user: currentUser, employee: result.employee };
}

export async function registerWithQra(
  qra: string,
  validationCode: string,
  password: string,
  name?: string
) {
  const result = await api.register({ qra, validationCode, password, name });
  setAuthToken(result.token);
  currentUser = {
    uid: result.user.uid,
    email: result.user.email,
    displayName: name || null,
  };
  notifyListeners();
  return { user: currentUser, employee: result.employee };
}
