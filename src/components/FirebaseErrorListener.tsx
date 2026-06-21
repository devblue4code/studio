'use client';

import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      toast({
        variant: 'destructive',
        title: 'ERRO DE PERMISSÃO',
        description: `ACESSO NEGADO PARA ${error.context.operation.toUpperCase()} EM ${error.context.path}. VERIFIQUE SUAS REGRAS DE SEGURANÇA.`,
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);
  }, [toast]);

  return null;
}
