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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Add Material</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/materials')}
              >
                <Database className="w-4 h-4 mr-2" />
                View Database
              </Button>
              <AuthButton user={user} onAuthChange={handleAuthChange} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border p-8">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Scan & Add Material
              </h2>
              <p className="text-gray-600">
                Upload an image or manually enter details about a recyclable material.
              </p>
            </div>

            <MaterialForm
              onSubmit={handleSubmit}
              isLoading={isSubmitting}
            />

            {/* OCR Note */}
            <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">Future Enhancement</h3>
              <p className="text-sm text-blue-800">
                OCR text extraction from images will be available soon. For now, 
                you can manually enter material information after uploading an image.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
