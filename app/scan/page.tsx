'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { onAuthStateChange, getCurrentUser } from '@/lib/auth';
import { createMaterial } from '@/lib/firestore';
import { MaterialForm } from '@/components/MaterialForm';
import { AuthButton } from '@/components/AuthButton';
import { Button } from '@/components/ui/button';
import { MaterialInput } from '@/lib/zodSchemas';
import { toast } from 'sonner';
import { ArrowLeft, Database } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';

export default function ScanPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
      
      // Redirect unauthenticated users to landing page
      if (!user) {
        router.push('/');
      }
    });

    return unsubscribe;
  }, [router]);

  const handleAuthChange = (user: User | null) => {
    setUser(user);
    if (!user) {
      router.push('/');
    }
  };

  const handleSubmit = async (data: MaterialInput) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      await createMaterial(user.uid, data);
      toast.success('Material saved successfully!');
      
      // Show success message with option to view in database
      setTimeout(() => {
        router.push('/materials');
      }, 1500);
    } catch (error) {
      console.error('Error creating material:', error);
      toast.error('Failed to save material. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/materials')}
            className="text-green-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold text-gray-900">Scanning Page</h1>
          <div className="w-16"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-green-600 mb-4">How to Scan</h2>
            <p className="text-gray-700 mb-4">
              Point your device's speaker towards the object you want to scan and push 'Start Scan'.
            </p>
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white mb-2">
              Start Scan
            </Button>
            <button className="text-sm text-green-600 underline">
              Where's my speaker?
            </button>
            <p className="text-sm text-gray-600 mt-2">
              Push and listen to where your speaker is.
            </p>
          </div>

          <MaterialForm
            onSubmit={handleSubmit}
            isLoading={isSubmitting}
          />
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
