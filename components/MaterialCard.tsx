'use client';

import React, { useState } from 'react';
import { MaterialDocument } from '@/lib/zodSchemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getImageDownloadURL } from '@/lib/storage';
import { Eye, Edit, Trash2 } from 'lucide-react';

interface MaterialCardProps {
  material: MaterialDocument;
  onView: (material: MaterialDocument) => void;
  onEdit: (material: MaterialDocument) => void;
  onDelete: (material: MaterialDocument) => void;
}

export function MaterialCard({ material, onView, onEdit, onDelete }: MaterialCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Load image if available
  React.useEffect(() => {
    if (material.imagePath) {
      setImageLoading(true);
      getImageDownloadURL(material.imagePath)
        .then(setImageUrl)
        .catch(console.error)
        .finally(() => setImageLoading(false));
    }
  }, [material.imagePath]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Image */}
        <div className="flex-shrink-0">
          {imageLoading ? (
            <div className="w-16 h-16 bg-gray-200 rounded-lg animate-pulse" />
          ) : imageUrl ? (
            <img 
              src={imageUrl} 
              alt={material.materialName}
              className="w-16 h-16 object-cover rounded-lg"
            />
          ) : (
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-gray-400 text-xs">No image</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{material.materialName}</h3>
          <p className="text-sm text-gray-600 mt-1">
            Discovered: {formatDate(material.discoveredAt)}
          </p>
          
          {/* Similar Materials */}
          {material.similarMaterials.length > 0 && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-1">
                {material.similarMaterials.slice(0, 3).map((similar, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {similar}
                  </Badge>
                ))}
                {material.similarMaterials.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{material.similarMaterials.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(material)}
            className="w-full"
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(material)}
            className="w-full"
          >
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(material)}
            className="w-full text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
