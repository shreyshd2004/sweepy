'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { onAuthStateChange } from '@/lib/auth';
import { AuthButton } from '@/components/AuthButton';
import { Recycle, Camera, Database } from 'lucide-react';

export default function RootPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
      
      // Redirect authenticated users to scan page
      if (user) {
        router.push('/scan');
      }
    });

    return unsubscribe;
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
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-green-600 mb-8">Sweepy</h1>
        </div>

        {/* Sign In Card */}
        <div className="bg-white rounded-2xl border border-green-200 p-8 w-full max-w-sm shadow-sm">
          <AuthButton user={user} onAuthChange={handleAuthChange} />
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Making recycling smarter, one material at a time.</p>
        </div>
      </div>
    </div>
  );
}