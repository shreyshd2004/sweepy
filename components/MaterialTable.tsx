'use client';

import React, { useState, useMemo } from 'react';
import { MaterialDocument } from '@/lib/zodSchemas';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MaterialCard } from './MaterialCard';
import { Search, Plus } from 'lucide-react';

interface MaterialTableProps {
  materials: MaterialDocument[];
  onView: (material: MaterialDocument) => void;
  onEdit: (material: MaterialDocument) => void;
  onDelete: (material: MaterialDocument) => void;
  onCreateNew: () => void;
  isLoading?: boolean;
}

export function MaterialTable({
  materials,
  onView,
  onEdit,
  onDelete,
  onCreateNew,
  isLoading = false,
}: MaterialTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMaterials = useMemo(() => {
    if (!searchQuery.trim()) return materials;
    
    return materials.filter(material =>
      material.materialName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [materials, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 h-10 bg-gray-200 rounded animate-pulse" />
          <div className="w-32 h-10 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded-lg animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-6 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
                </div>
                <div className="w-20 h-8 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search materials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Button onClick={onCreateNew} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Material
        </Button>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600">
        {filteredMaterials.length === materials.length
          ? `${materials.length} material${materials.length !== 1 ? 's' : ''}`
          : `${filteredMaterials.length} of ${materials.length} materials`}
      </div>

      {/* Materials Grid */}
      {filteredMaterials.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            {searchQuery ? 'No materials found' : 'No materials yet'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Add your first material to get started'
            }
          </p>
          {!searchQuery && (
            <Button onClick={onCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Material
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filteredMaterials.map((material) => (
            <div key={material.id} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 text-2xl">♻️</span>
              </div>
              <h3 className="font-semibold text-sm text-gray-900 mb-1">{material.materialName}</h3>
              <p className="text-xs text-gray-500">{material.similarMaterials.length} similar</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
