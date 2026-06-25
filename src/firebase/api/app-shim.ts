export interface FirebaseApp {
  name: string;
}

export function initializeApp(_config?: unknown): FirebaseApp {
  return { name: '[DEFAULT]' };
}

export function getApps(): FirebaseApp[] {
  return [{ name: '[DEFAULT]' }];
}

export function getApp(): FirebaseApp {
  return { name: '[DEFAULT]' };
}
