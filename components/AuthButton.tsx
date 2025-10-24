'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { signInWithGoogle, signOutUser } from '@/lib/auth';
import { User } from 'firebase/auth';
import { toast } from 'sonner';

interface AuthButtonProps {
  user: User | null;
  onAuthChange: (user: User | null) => void;
}

export function AuthButton({ user, onAuthChange }: AuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      toast.success('Signed in successfully!');
    } catch (error) {
      toast.error('Failed to sign in. Please try again.');
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOutUser();
      onAuthChange(null);
      toast.success('Signed out successfully!');
    } catch (error) {
      toast.error('Failed to sign out. Please try again.');
      console.error('Sign out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <img 
            src={user.photoURL || ''} 
            alt={user.displayName || 'User'} 
            className="w-8 h-8 rounded-full"
          />
          <span className="text-sm font-medium">{user.displayName}</span>
        </div>
        <Button 
          variant="outline" 
          onClick={handleSignOut}
          disabled={isLoading}
        >
          {isLoading ? 'Signing out...' : 'Sign out'}
        </Button>
      </div>
    );
  }

  return (
    <Button 
      onClick={handleSignIn}
      disabled={isLoading}
      className="w-full sm:w-auto"
    >
      {isLoading ? 'Signing in...' : 'Continue with Google'}
    </Button>
  );
}
