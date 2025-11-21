'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FileText, Camera, BarChart3, User as UserIcon, Database } from 'lucide-react';

export function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-green-600 px-4 py-2 flex justify-around items-center">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/materials')}
        className={`flex flex-col items-center gap-1 p-2 ${
          isActive('/materials') ? 'text-white' : 'text-green-100'
        }`}
      >
        <FileText className="w-6 h-6" />
        <span className="text-xs">Catalog</span>
      </Button>
      {/*
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (typeof window !== 'undefined') {
            window.location.href = '/database';
          }
        }}
        className={`flex flex-col items-center gap-1 p-2 ${
          isActive('/database') ? 'text-white' : 'text-green-100'
        }`}
      >
        <Database className="w-6 h-6" />
        <span className="text-xs">Database</span>
      </Button>
      */}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/scan')}
        className={`flex flex-col items-center gap-1 p-2 ${
          isActive('/scan') ? 'text-white' : 'text-green-100'
        }`}
      >
        <Camera className="w-6 h-6" />
        <span className="text-xs">Scan</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/leaderboard')}
        className={`flex flex-col items-center gap-1 p-2 ${
          isActive('/leaderboard') ? 'text-white' : 'text-green-100'
        }`}
      >
        <BarChart3 className="w-6 h-6" />
        <span className="text-xs">Leaderboard</span>
      </Button>

      {/*
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/user')}
        className={`flex flex-col items-center gap-1 p-2 ${
          isActive('/user') ? 'text-white' : 'text-green-100'
        }`}
      >
        <UserIcon className="w-6 h-6" />
        <span className="text-xs">User</span>
      </Button>
      */}
    </div>
    
  );
}
