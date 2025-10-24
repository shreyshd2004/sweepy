'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { onAuthStateChange } from '@/lib/auth';
import { listMaterials, updateMaterial, deleteMaterial } from '@/lib/firestore';
import { MaterialDocument, MaterialInput } from '@/lib/zodSchemas';
import { MaterialTable } from '@/components/MaterialTable';
import { MaterialDetailDrawer } from '@/components/MaterialDetailDrawer';
import { MaterialForm } from '@/components/MaterialForm';
import { AuthButton } from '@/components/AuthButton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';

export default function MaterialsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<MaterialDocument[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialDocument | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  useEffect(() => {
    if (user) {
      loadMaterials();
    }
  }, [user]);

  const loadMaterials = async () => {
    if (!user) return;
    
    try {
      const { materials: fetchedMaterials } = await listMaterials(user.uid);
      setMaterials(fetchedMaterials);
    } catch (error) {
      console.error('Error loading materials:', error);
      toast.error('Failed to load materials. Please try again.');
    }
  };

  const handleAuthChange = (user: User | null) => {
    setUser(user);
    if (!user) {
      router.push('/');
    }
  };

  const handleView = (material: MaterialDocument) => {
    setSelectedMaterial(material);
    setIsDetailOpen(true);
  };

  const handleEdit = (material: MaterialDocument) => {
    setSelectedMaterial(material);
    setIsDetailOpen(true);
  };

  const handleDelete = async (material: MaterialDocument) => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to delete this material? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteMaterial(user.uid, material.id);
      setMaterials(materials.filter(m => m.id !== material.id));
      toast.success('Material deleted successfully!');
    } catch (error) {
      console.error('Error deleting material:', error);
      toast.error('Failed to delete material. Please try again.');
    }
  };

  const handleCreateNew = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCreateSubmit = async (data: MaterialInput) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const { createMaterial } = await import('@/lib/firestore');
      await createMaterial(user.uid, data);
      
      // Reload materials
      await loadMaterials();
      
      setIsCreateDialogOpen(false);
      toast.success('Material created successfully!');
    } catch (error) {
      console.error('Error creating material:', error);
      toast.error('Failed to create material. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaterialUpdate = (updatedMaterial: MaterialDocument) => {
    setMaterials(materials.map(m => 
      m.id === updatedMaterial.id ? updatedMaterial : m
    ));
  };

  const handleMaterialDelete = (materialId: string) => {
    setMaterials(materials.filter(m => m.id !== materialId));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
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
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-semibold text-gray-900">Material Catalogue</h1>
          <Button
            onClick={handleCreateNew}
            className="bg-green-600 hover:bg-green-700 text-white"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search your materials"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <svg className="absolute right-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Materials Grid */}
      <div className="px-4 pb-6">
        <MaterialTable
          materials={materials}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCreateNew={handleCreateNew}
          isLoading={loading}
        />
      </div>

      {/* Detail Drawer */}
      <MaterialDetailDrawer
        material={selectedMaterial}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedMaterial(null);
        }}
        onMaterialUpdate={handleMaterialUpdate}
        onMaterialDelete={handleMaterialDelete}
        userId={user.uid}
      />

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Material</DialogTitle>
          </DialogHeader>
          <MaterialForm
            onSubmit={handleCreateSubmit}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
}
