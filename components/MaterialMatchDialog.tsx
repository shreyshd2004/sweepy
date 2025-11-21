'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MaterialMatchResult } from '@/lib/zodSchemas';
import { CheckCircle2, XCircle } from 'lucide-react';

interface MaterialMatchDialogProps {
  isOpen: boolean;
  matches: MaterialMatchResult[];
  materialName: string;
  onSelectMatch: (materialId: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

export function MaterialMatchDialog({
  isOpen,
  matches,
  materialName,
  onSelectMatch,
  onCreateNew,
  onCancel,
}: MaterialMatchDialogProps) {
  const getMatchReasonText = (reason: string) => {
    switch (reason) {
      case 'frequency': return 'Frequency match';
      case 'name': return 'Name similarity';
      case 'both': return 'Frequency + Name match';
      default: return 'Match';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-orange-600';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Match Found!</DialogTitle>
          <DialogDescription>
            We found potential matches for "{materialName}". Would you like to link to an existing material or create a new one?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {matches.map((match, index) => (
            <button
              key={match.materialId}
              onClick={() => onSelectMatch(match.materialId!)}
              className="w-full text-left border-2 border-gray-200 rounded-lg p-3 hover:border-green-300 hover:bg-green-50 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="font-semibold">{match.materialName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{getMatchReasonText(match.matchReason)}</span>
                    <span className={`font-semibold ${getConfidenceColor(match.confidence)}`}>
                      {Math.round(match.confidence * 100)}% match
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}

          <div className="border-t pt-3 mt-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={onCreateNew}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Create New Material Entry
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

