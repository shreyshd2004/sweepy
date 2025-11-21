'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { onAuthStateChange } from '@/lib/auth';
import { BottomNavigation } from '@/components/BottomNavigation';
import { getLeaderboard, getUserStats, LeaderboardEntry, UserStats } from '@/lib/firestore';
import { Trophy, Medal } from 'lucide-react';

export default function LeaderboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      setUser(user);
      
      // Redirect unauthenticated users to landing page
      if (!user) {
        router.push('/');
        return;
      }
      
      try {
        // Load leaderboard and user stats
        const [leaderboardData, stats] = await Promise.all([
          getLeaderboard(user.uid, 20), // Top 20 users
          getUserStats(user.uid)
        ]);
        
        setLeaderboard(leaderboardData);
        setUserStats(stats);
        
        // Find user's rank
        const rank = leaderboardData.findIndex(entry => entry.uid === user.uid) + 1;
        setUserRank(rank || null);
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setLoading(false);
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

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-orange-600" />;
    return null;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-50 border-yellow-200';
    if (rank === 2) return 'bg-gray-50 border-gray-200';
    if (rank === 3) return 'bg-orange-50 border-orange-200';
    return 'bg-white border-gray-200';
  };

  const currentUserEntry = leaderboard.find(entry => entry.uid === user?.uid);
  const otherEntries = leaderboard.filter(entry => entry.uid !== user?.uid);

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Leaderboard</h1>
        {userRank && (
          <p className="text-sm text-gray-500">
            {userRank === 1 ? '🏆 You are #1!' : `You are ${userRank}${userRank === 2 ? 'nd' : userRank === 3 ? 'rd' : 'th'} place!`}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="max-w-md mx-auto">
          {/* Your Entry - Always show at top if you're on leaderboard */}
          {currentUserEntry && (
            <div className="bg-green-50 rounded-xl border-2 border-green-300 p-4 flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'You'} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <span className="text-green-600 font-bold text-lg">You</span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{user?.displayName || 'You'}</p>
                <p className="text-xs text-gray-500">Rank #{currentUserEntry.rank}</p>
              </div>
              <div className="text-right">
                <p className="text-green-600 font-bold text-lg">{currentUserEntry.points}</p>
                <p className="text-xs text-gray-500">points</p>
              </div>
            </div>
          )}

          {/* Top 3 Podium */}
          {otherEntries.length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Top Recyclers</h2>
              <div className="space-y-3">
                {otherEntries.slice(0, 10).map((entry) => {
                  const isCurrentUser = entry.uid === user?.uid;
                  return (
                    <div 
                      key={entry.uid} 
                      className={`${getRankColor(entry.rank)} ${isCurrentUser ? 'ring-2 ring-green-400' : ''} rounded-xl border p-4 flex items-center`}
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mr-4 bg-white">
                        {getRankIcon(entry.rank) || (
                          <span className="text-gray-600 font-semibold">{entry.rank}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {isCurrentUser ? 'You' : entry.displayName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {entry.totalDiscovered} discovered • {entry.discoveredThisWeek} this week
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-600 font-semibold">{entry.points}</p>
                        <p className="text-xs text-gray-500">points</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {leaderboard.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              <p>No leaderboard data yet. Start discovering materials!</p>
            </div>
          )}
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
