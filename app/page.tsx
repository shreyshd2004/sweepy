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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-2">
            <Recycle className="w-8 h-8 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Sweepy</h1>
          </div>
          <AuthButton user={user} onAuthChange={handleAuthChange} />
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Track Your Recycling Journey
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Discover, scan, and manage recyclable materials with ease. 
            Build your personal recycling database and learn how to properly dispose of items.
          </p>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <Camera className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-3">Scan & Capture</h3>
              <p className="text-gray-600">
                Take photos of materials and automatically extract information 
                or manually add details about recyclable items.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <Database className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-3">Smart Database</h3>
              <p className="text-gray-600">
                Organize your materials with search, filtering, and categorization. 
                Track similar materials and recycling instructions.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <Recycle className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-3">Learn & Improve</h3>
              <p className="text-gray-600">
                Get detailed recycling instructions and discover similar materials 
                to make better environmental choices.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-white rounded-2xl p-8 shadow-sm max-w-md mx-auto">
            <h3 className="text-2xl font-semibold mb-4">Get Started Today</h3>
            <p className="text-gray-600 mb-6">
              Sign in with Google to start building your recycling database
            </p>
            <AuthButton user={user} onAuthChange={handleAuthChange} />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 text-gray-500">
          <p>© 2024 Sweepy. Making recycling smarter, one material at a time.</p>
        </div>
      </div>
    </div>
  );
}