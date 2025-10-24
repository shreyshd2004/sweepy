'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { onAuthStateChange } from '@/lib/auth';
import { BottomNavigation } from '@/components/BottomNavigation';

export default function LeaderboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
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
        <h1 className="text-lg font-semibold text-gray-900">Leaderboard</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-green-600 mb-2">You are 5th place!</h2>
          </div>

          {/* Leaderboard List */}
          <div className="space-y-3">
            {/* Your Entry */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-green-600 font-semibold">You</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">Your Name</p>
              </div>
              <div className="text-right">
                <p className="text-green-600 font-semibold">XXX</p>
                <p className="text-xs text-gray-500">points</p>
              </div>
            </div>

            {/* Ranked Entries */}
            {[1, 2, 3, 4].map((rank) => (
              <div key={rank} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-gray-600 font-semibold">{rank}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Name</p>
                </div>
                <div className="text-right">
                  <p className="text-green-600 font-semibold">XXX</p>
                  <p className="text-xs text-gray-500">points</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
