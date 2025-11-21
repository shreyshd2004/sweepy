'use client';

import React, { useState, useEffect } from 'react';
import { MaterialDocument, MaterialStats } from '@/lib/zodSchemas';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getImageDownloadURL, getAudioDownloadURL } from '@/lib/storage';
import { X, Users, Trophy, Calendar, Play, Pause } from 'lucide-react';

interface MaterialDatabaseDrawerProps {
  material: {
    id: string;
    materialName: string;
    howToRecycle: string;
    discoveredAt: Date;
    imagePath?: string;
    audioPath?: string;
    frequencyData?: Record<string, any>;
  };
  isOpen: boolean;
  onClose: () => void;
  communityRecordings: MaterialDocument[];
  stats: MaterialStats | null;
  isDiscovered: boolean;
}

export function MaterialDatabaseDrawer({
  material,
  isOpen,
  onClose,
  communityRecordings,
  stats,
  isDiscovered,
}: MaterialDatabaseDrawerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Map<string, string>>(new Map());
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  useEffect(() => {
    if (material?.imagePath) {
      getImageDownloadURL(material.imagePath)
        .then(setImageUrl)
        .catch(console.error);
    } else {
      setImageUrl(null);
    }
  }, [material?.imagePath]);

  useEffect(() => {
    // Load audio URLs for all recordings
    const loadAudioUrls = async () => {
      const urls = new Map<string, string>();
      for (const recording of communityRecordings) {
        if (recording.audioPath) {
          try {
            const url = await getAudioDownloadURL(recording.audioPath);
            urls.set(recording.id, url);
          } catch (error) {
            console.error(`Error loading audio for ${recording.id}:`, error);
          }
        }
      }
      setAudioUrls(urls);
    };

    if (communityRecordings.length > 0) {
      loadAudioUrls();
    }
  }, [communityRecordings]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 text-gray-700';
      case 'uncommon': return 'bg-green-100 text-green-700';
      case 'rare': return 'bg-blue-100 text-blue-700';
      case 'epic': return 'bg-purple-100 text-purple-700';
      case 'legendary': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (!material) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>{material.materialName}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Discovery Status */}
          {!isDiscovered && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                ⚠️ You haven't discovered this material yet. Scan it to add it to your collection!
              </p>
            </div>
          )}

          {/* Image */}
          {imageUrl && (
            <div>
              <img 
                src={imageUrl} 
                alt={material.materialName}
                className="w-full h-64 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Discoveries</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDiscoveries}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Play className="w-4 h-4" />
                  <span className="text-sm">Recordings</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRecordings}</p>
              </div>
            </div>
          )}

          {/* Discovery Date */}
          {isDiscovered && (
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Discovered
              </h3>
              <p className="text-sm text-gray-600">
                {new Intl.DateTimeFormat('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }).format(material.discoveredAt)}
              </p>
            </div>
          )}

          {/* How to Recycle */}
          {material.howToRecycle && (
            <div>
              <h3 className="font-semibold mb-2">How to Recycle</h3>
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap">{material.howToRecycle}</p>
              </div>
            </div>
          )}

          {/* Community Recordings */}
          {communityRecordings.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Community Recordings ({communityRecordings.length})</h3>
              <div className="space-y-3">
                {communityRecordings.map((recording) => {
                  const audioUrl = audioUrls.get(recording.id);
                  return (
                    <div key={recording.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Recording by {recording.ownerUid.slice(0, 8)}...
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }).format(recording.discoveredAt)}
                        </span>
                      </div>
                      {audioUrl && (
                        <audio 
                          controls 
                          className="w-full"
                          onPlay={() => setPlayingAudio(recording.id)}
                          onPause={() => setPlayingAudio(null)}
                          onEnded={() => setPlayingAudio(null)}
                        >
                          <source src={audioUrl} type="audio/webm" />
                          Your browser does not support the audio element.
                        </audio>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {communityRecordings.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No community recordings available yet.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

