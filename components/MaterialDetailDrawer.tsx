'use client';

import React, { useState, useEffect } from 'react';
import { MaterialDocument } from '@/lib/zodSchemas';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MaterialForm } from './MaterialForm';
import { getImageDownloadURL, deleteMaterialImage } from '@/lib/storage';
import { updateMaterial, deleteMaterial } from '@/lib/firestore';
import { toast } from 'sonner';
import { Edit, Trash2, Download } from 'lucide-react';

interface MaterialDetailDrawerProps {
  material: MaterialDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onMaterialUpdate: (updatedMaterial: MaterialDocument) => void;
  onMaterialDelete: (materialId: string) => void;
  userId: string;
}

export function MaterialDetailDrawer({
  material,
  isOpen,
  onClose,
  onMaterialUpdate,
  onMaterialDelete,
  userId,
}: MaterialDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (material?.imagePath) {
      getImageDownloadURL(material.imagePath)
        .then(setImageUrl)
        .catch(console.error);
    } else {
      setImageUrl(null);
    }
  }, [material?.imagePath]);

  const handleUpdate = async (data: any) => {
    if (!material) return;
    
    setIsLoading(true);
    try {
      await updateMaterial(userId, material.id, data);
      
      const updatedMaterial: MaterialDocument = {
        ...material,
        ...data,
        updatedAt: new Date(),
      };
      
      onMaterialUpdate(updatedMaterial);
      setIsEditing(false);
      toast.success('Material updated successfully!');
    } catch (error) {
      console.error('Error updating material:', error);
      toast.error('Failed to update material. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!material) return;
    
    if (!confirm('Are you sure you want to delete this material? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      // Delete image from storage if it exists
      if (material.imagePath) {
        await deleteMaterialImage(material.imagePath);
      }
      
      // Delete material from Firestore
      await deleteMaterial(userId, material.id);
      
      onMaterialDelete(material.id);
      onClose();
      toast.success('Material deleted successfully!');
    } catch (error) {
      console.error('Error deleting material:', error);
      toast.error('Failed to delete material. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!material) return;
    
    const csvContent = [
      'Material Name,Discovered At,Similar Materials,How to Recycle',
      `"${material.materialName}","${material.discoveredAt.toISOString().split('T')[0]}","${material.similarMaterials.join('; ')}","${material.howToRecycle.replace(/"/g, '""')}"`
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${material.materialName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!material) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>{isEditing ? 'Edit Material' : 'Material Details'}</span>
            <div className="flex gap-2">
              {!isEditing && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToCSV}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          {isEditing ? (
            <MaterialForm
              initialData={material}
              onSubmit={handleUpdate}
              isLoading={isLoading}
              userId={userId}
            />
          ) : (
            <div className="space-y-6">
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

              {/* Material Name */}
              <div>
                <h2 className="text-2xl font-bold">{material.materialName}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Discovered: {new Intl.DateTimeFormat('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }).format(material.discoveredAt)}
                </p>
              </div>

              {/* How to Recycle */}
              {material.howToRecycle && (
                <div>
                  <h3 className="font-semibold mb-2">How to Recycle</h3>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{material.howToRecycle}</p>
                  </div>
                </div>
              )}

              {/* Similar Materials */}
              {material.similarMaterials.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Similar Materials</h3>
                  <div className="flex flex-wrap gap-2">
                    {material.similarMaterials.map((similar, index) => (
                      <Badge key={index} variant="secondary">
                        {similar}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-4 border-t text-sm text-gray-500">
                <p>Created: {new Intl.DateTimeFormat('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(material.createdAt)}</p>
                <p>Updated: {new Intl.DateTimeFormat('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(material.updatedAt)}</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
