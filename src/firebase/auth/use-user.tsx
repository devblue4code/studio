'use client';

import { useAuth } from '../provider';

/**
 * Hook customizado para acessar o usuário autenticado.
 * Utiliza o contexto global definido no FirebaseProvider.
 */
export function useUser() {
  const { user, loading } = useAuth();
  return { user, loading };
}
