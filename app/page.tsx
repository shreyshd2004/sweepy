'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { onAuthStateChange } from '@/lib/auth';
import { AuthButton } from '@/components/AuthButton';
import { Button } from '@/components/ui/button';
import { Recycle, Camera, Database } from 'lucide-react';

export default function RootPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    console.log('🟡 LandingPage: useEffect running, setting up auth listener');
    const unsubscribe = onAuthStateChange((user) => {
      console.log('🟡 LandingPage: Auth state changed', { 
        hasUser: !!user, 
        userId: user?.uid,
        pathname: window.location.pathname,
        search: window.location.search
      });
      
      setUser(user);
      setLoading(false);
      
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      
      // DON'T redirect if we're on signup or signin pages
      if (currentPath === '/signup' || currentPath === '/signin' || currentPath === '/signup/' || currentPath === '/signin/') {
        console.log('🟡 LandingPage: On signup/signin page - preventing redirect');
        return;
      }
      
      // CRITICAL: Check if we're navigating to form or already have scan data
      const hasScanData = sessionStorage.getItem('scanAudioData');
      const hasNavigationFlag = sessionStorage.getItem('navigatingToForm') === 'true';
      const isOnNewMaterialPage = currentPath === '/materials/new' || currentPath === '/materials/new/';
      
      console.log('🟡 LandingPage: Redirect check', { 
        hasScanData: !!hasScanData, 
        hasNavigationFlag, 
        isOnNewMaterialPage,
        currentPath 
      });
      
      // NEVER redirect if we have scan data, navigation flag, or we're on the new material page
      if (hasScanData || hasNavigationFlag || isOnNewMaterialPage) {
        console.log('🟡 LandingPage: Has scan data/navigation flag or on new material page - redirecting to materials/new');
        if (!isOnNewMaterialPage) {
          router.push('/materials/new?scanned=1');
        }
        return;
      }
      
      // Only redirect authenticated users to scan page if we're actually on the landing page
      if (user && currentPath === '/') {
        console.log('🟡 LandingPage: Authenticated user on landing page, redirecting to /scan');
        router.push('/scan');
      }
    });

    return () => {
      console.log('🟡 LandingPage: Cleaning up auth listener');
      unsubscribe();
    };
  }, [router]);

  const handleAuthChange = (user: User | null) => {
    setUser(user);
    if (user) {
      router.push('/scan');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        {/* Splash Title */}
        <h1 className="text-[48px] font-extrabold text-green-600 mb-10 tracking-tight">Sweepy</h1>

        {/* Sign In Options */}
        <div className="w-full max-w-xs space-y-3">
          <AuthButton user={user} onAuthChange={handleAuthChange} />
          
          {!user && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🟡 LandingPage: Create Account button clicked');
                    if (typeof window !== 'undefined') {
                      window.location.href = '/signup';
                    }
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  type="button"
                >
                  Create Account
                </Button>
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🟡 LandingPage: Sign In button clicked');
                    if (typeof window !== 'undefined') {
                      window.location.href = '/signin';
                    }
                  }}
                  variant="outline"
                  className="w-full border-green-600 text-green-600 hover:bg-green-50"
                  type="button"
                >
                  Sign In
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Bottom Illustration Placeholder (optional per Figma) */}
        <div className="fixed bottom-6 left-0 right-0 flex justify-center text-gray-400 text-xs">
          Make recycling smarter
        </div>
      </div>
    </div>
  );
}