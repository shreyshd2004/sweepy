"use client";

import { useEffect } from 'react';
import { consumeRedirectResult } from '@/lib/auth';
import { Toaster } from '@/components/ui/sonner';

interface ClientRootProps {
  children: React.ReactNode;
}

export default function ClientRoot({ children }: ClientRootProps) {
  useEffect(() => {
    consumeRedirectResult();
  }, []);

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}


