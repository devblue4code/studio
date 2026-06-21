'use client';

import './globals.css';
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "@/components/ui/toaster"
import { FirebaseClientProvider, initializeFirebase } from '@/firebase';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { usePathname } from 'next/navigation';

const { firebaseApp, firestore, auth } = initializeFirebase();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background">
        <FirebaseClientProvider firebaseApp={firebaseApp} firestore={firestore} auth={auth}>
          {isLoginPage ? (
            <main className="min-h-screen">
              {children}
            </main>
          ) : (
            <ProtectedRoute>
              <SidebarProvider>
                <div className="flex min-h-screen w-full">
                  <AppSidebar />
                  <SidebarInset className="flex flex-col">
                    <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur sm:px-6 print:hidden">
                      <SidebarTrigger className="mr-4" />
                      <div className="flex-1">
                        <h1 className="font-headline text-lg font-semibold text-primary">Gestão de RH</h1>
                      </div>
                    </header>
                    <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 print:p-0">
                      {children}
                    </main>
                  </SidebarInset>
                </div>
              </SidebarProvider>
            </ProtectedRoute>
          )}
          <Toaster />
          <FirebaseErrorListener />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
