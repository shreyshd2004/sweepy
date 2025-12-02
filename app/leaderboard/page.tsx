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
        // Load leaderboard first
        const rawLeaderboard = await getLeaderboard(user.uid, 50);
        
        // Try to get user stats - if it fails, we'll use the leaderboard entry's stats
        let stats: UserStats | null = null;
        try {
          stats = await getUserStats(user.uid);
          console.log('🔵 Leaderboard: getUserStats result:', stats);
        } catch (statsError) {
          console.error('🔴 Leaderboard: getUserStats failed:', statsError);
          // Continue - we'll use leaderboard entry stats as fallback
        }

        console.log('🔵 Leaderboard: rawLeaderboard entries:', rawLeaderboard.length);
        console.log('🔵 Leaderboard: All users in leaderboard:', rawLeaderboard.map(e => ({ uid: e.uid.slice(0, 8), name: e.displayName, points: e.points })));

        // Find current user in leaderboard first
        const existingEntry = rawLeaderboard.find((entry) => entry.uid === user.uid);
        
        // ALWAYS use getUserStats if available (to match profile), otherwise use leaderboard entry stats
        const userStatsForLeaderboard: UserStats = stats || (existingEntry ? {
          totalDiscovered: existingEntry.totalDiscovered,
          discoveredThisWeek: existingEntry.discoveredThisWeek,
          points: existingEntry.points,
        } : {
          totalDiscovered: 0,
          discoveredThisWeek: 0,
          points: 0,
        });
        
        console.log('🔵 Leaderboard: Using stats for current user:', userStatsForLeaderboard);

        // Ensure the current user always appears on the leaderboard with stats from getUserStats
        let entries: LeaderboardEntry[] = [...rawLeaderboard];

        const existingIndex = entries.findIndex((entry) => entry.uid === user.uid);
        console.log('🔵 Leaderboard: Current user found at index:', existingIndex);
        if (existingIndex >= 0) {
          console.log('🔵 Leaderboard: Before overwrite - entry points:', entries[existingIndex].points);
          // ALWAYS overwrite with getUserStats to match profile
          entries[existingIndex] = {
            ...entries[existingIndex],
            points: userStatsForLeaderboard.points,
            totalDiscovered: userStatsForLeaderboard.totalDiscovered,
            discoveredThisWeek: userStatsForLeaderboard.discoveredThisWeek,
            displayName: user.displayName || entries[existingIndex].displayName || 'You',
            photoURL: user.photoURL || entries[existingIndex].photoURL || null,
          };
          console.log('🔵 Leaderboard: After overwrite - entry points:', entries[existingIndex].points);
        } else {
          // Add current user if not in leaderboard
          const userEntry: LeaderboardEntry = {
            uid: user.uid,
            displayName: user.displayName || 'You',
            photoURL: user.photoURL || null,
            points: userStatsForLeaderboard.points,
            totalDiscovered: userStatsForLeaderboard.totalDiscovered,
            discoveredThisWeek: userStatsForLeaderboard.discoveredThisWeek,
            rank: 0, // temporary, will be reassigned below
          };
          entries.push(userEntry);
        }

        // Sort by points and assign global ranks
        entries = entries
          .sort((a, b) => b.points - a.points)
          .map((entry, index) => ({
            ...entry,
            rank: index + 1,
          }));

        console.log('🔵 Leaderboard: Final entries after processing:', entries.length);
        console.log('🔵 Leaderboard: Final entries details:', entries.map(e => ({ uid: e.uid.slice(0, 8), name: e.displayName, points: e.points })));
        
        setLeaderboard(entries);

        // Always use getUserStats for header to match profile exactly
        setUserStats(userStatsForLeaderboard);

        // Find user's rank from the final list
        const rankIndex = entries.findIndex((entry) => entry.uid === user.uid);
        setUserRank(rankIndex >= 0 ? rankIndex + 1 : null);
      } catch (error) {
        console.error('Error loading leaderboard:', error);

        // Fallback: still show the current user with 0 points so the page
        // never appears completely empty when signed in.
        if (user) {
          const fallbackStats: UserStats = {
            totalDiscovered: 0,
            discoveredThisWeek: 0,
            points: 0,
          };

          const fallbackEntry: LeaderboardEntry = {
            uid: user.uid,
            displayName: user.displayName || 'You',
            photoURL: user.photoURL || null,
            points: fallbackStats.points,
            totalDiscovered: fallbackStats.totalDiscovered,
            discoveredThisWeek: fallbackStats.discoveredThisWeek,
            rank: 1,
          };

          setLeaderboard([fallbackEntry]);
          setUserStats(fallbackStats);
          setUserRank(1);
        }
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
          {(currentUserEntry || userStats) && (
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
                <p className="text-xs text-gray-500">Rank #{currentUserEntry?.rank || userRank || '—'}</p>
              </div>
              <div className="text-right">
                {/* Prefer userStats.points (from getUserStats) to match profile exactly */}
                <p className="text-green-600 font-bold text-lg">{userStats?.points ?? currentUserEntry?.points ?? 0}</p>
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
