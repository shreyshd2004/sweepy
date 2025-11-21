'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { onAuthStateChange, signOutUser, updateDisplayName } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { BottomNavigation } from '@/components/BottomNavigation';
import { getUserStats, UserStats } from '@/lib/firestore';

export default function UserPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChange(async (u) => {
      setUser(u);
      setNameInput(u?.displayName || '');
      if (u) {
        try {
          const s = await getUserStats(u.uid);
          setStats(s);
        } catch {
          setStats(null);
        }
      }
      setLoading(false);
      if (!u) router.push('/');
    });
    return unsub;
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  if (!user) return null;

  const initials = (user.displayName || 'You')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Your Profile</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6 max-w-md mx-auto">
        {/* Profile Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'User'} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
                {initials}
              </div>
            )}
            <div className="flex-1">
              {editing ? (
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-base"
                  placeholder="Display name"
                  maxLength={50}
                />
              ) : (
                <p className="text-base font-semibold text-gray-900">{user.displayName || 'Anonymous'}</p>
              )}
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={async () => { await signOutUser(); router.push('/'); }}
          >
            Sign out
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-green-600">{stats ? stats.totalDiscovered : '—'}</p>
            <p className="text-xs text-gray-500">Discovered</p>
          </div>
          <div className="text-center bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-green-600">{stats ? stats.discoveredThisWeek : '—'}</p>
            <p className="text-xs text-gray-500">This Week</p>
          </div>
          <div className="text-center bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-green-600">{stats ? stats.points : '—'}</p>
            <p className="text-xs text-gray-500">Points</p>
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-3">
          {!editing ? (
            <button
              className="w-full text-left bg-white border border-gray-200 rounded-xl p-4"
              onClick={() => setEditing(true)}
            >
              Edit Display Name
            </button>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Display name"
                  maxLength={50}
                />
                <Button
                  disabled={saving || !nameInput.trim() || nameInput.trim() === (user?.displayName || '')}
                  onClick={async () => {
                    if (!user) return;
                    try {
                      setSaving(true);
                      await updateDisplayName(user, nameInput);
                      setEditing(false);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setNameInput(user?.displayName || '');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}


