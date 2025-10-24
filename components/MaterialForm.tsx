'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MaterialSchema, MaterialInput } from '@/lib/zodSchemas';
import { uploadMaterialImage, getImageDownloadURL } from '@/lib/storage';
import { toast } from 'sonner';
import { X, Upload, Camera } from 'lucide-react';

interface MaterialFormProps {
  initialData?: Partial<MaterialInput>;
  onSubmit: (data: MaterialInput) => Promise<void>;
  isLoading?: boolean;
}

export function MaterialForm({ initialData, onSubmit, isLoading = false }: MaterialFormProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [similarMaterials, setSimilarMaterials] = useState<string[]>(
    initialData?.similarMaterials || []
  );
  const [newSimilarMaterial, setNewSimilarMaterial] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<MaterialInput>({
    resolver: zodResolver(MaterialSchema) as any,
    defaultValues: {
      materialName: initialData?.materialName || '',
      howToRecycle: initialData?.howToRecycle || '',
      discoveredAt: initialData?.discoveredAt || new Date(),
      similarMaterials: initialData?.similarMaterials || [],
      imagePath: initialData?.imagePath,
    },
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        toast.error('Please select a valid image file');
      }
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addSimilarMaterial = () => {
    if (newSimilarMaterial.trim() && similarMaterials.length < 20) {
      const updated = [...similarMaterials, newSimilarMaterial.trim()];
      setSimilarMaterials(updated);
      setValue('similarMaterials', updated);
      setNewSimilarMaterial('');
    }
  };

  const removeSimilarMaterial = (index: number) => {
    const updated = similarMaterials.filter((_, i) => i !== index);
    setSimilarMaterials(updated);
    setValue('similarMaterials', updated);
  };

  const onFormSubmit = async (data: MaterialInput) => {
    try {
      let imagePath = initialData?.imagePath;

      // Upload image if new one is selected
      if (imageFile) {
        imagePath = await uploadMaterialImage(data.materialName, imageFile);
      }

      const submitData: MaterialInput = {
        ...data,
        similarMaterials,
        imagePath,
      };

      await onSubmit(submitData);
      
      // Reset form
      setImagePreview(null);
      setImageFile(null);
      setSimilarMaterials([]);
      setNewSimilarMaterial('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Failed to save material. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit as any)} className="space-y-6">
      {/* Image Upload */}
      <div className="space-y-4">
        <label className="text-sm font-medium">Material Image (Optional)</label>
        
        {imagePreview ? (
          <div className="relative">
            <img 
              src={imagePreview} 
              alt="Preview" 
              className="w-full h-48 object-cover rounded-lg border"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={removeImage}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <div className="space-y-2">
              <Upload className="w-8 h-8 mx-auto text-gray-400" />
              <p className="text-sm text-gray-600">
                Click to upload an image or drag and drop
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-2" />
                Choose Image
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Material Name */}
      <div className="space-y-2">
        <label htmlFor="materialName" className="text-sm font-medium">
          Material Name *
        </label>
        <Input
          id="materialName"
          {...register('materialName')}
          placeholder="e.g., Plastic Bottle, Cardboard Box"
        />
        {errors.materialName && (
          <p className="text-sm text-red-600">{errors.materialName.message}</p>
        )}
      </div>

      {/* How to Recycle */}
      <div className="space-y-2">
        <label htmlFor="howToRecycle" className="text-sm font-medium">
          How to Recycle
        </label>
        <Textarea
          id="howToRecycle"
          {...register('howToRecycle')}
          placeholder="Instructions for recycling this material..."
          rows={4}
        />
        {errors.howToRecycle && (
          <p className="text-sm text-red-600">{errors.howToRecycle.message}</p>
        )}
      </div>

      {/* Discovered At */}
      <div className="space-y-2">
        <label htmlFor="discoveredAt" className="text-sm font-medium">
          Discovered At
        </label>
        <Input
          id="discoveredAt"
          type="date"
          {...register('discoveredAt')}
        />
        {errors.discoveredAt && (
          <p className="text-sm text-red-600">{errors.discoveredAt.message}</p>
        )}
      </div>

      {/* Similar Materials */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Similar Materials</label>
        <div className="flex gap-2">
          <Input
            value={newSimilarMaterial}
            onChange={(e) => setNewSimilarMaterial(e.target.value)}
            placeholder="Add similar material..."
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSimilarMaterial();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={addSimilarMaterial}
            disabled={!newSimilarMaterial.trim() || similarMaterials.length >= 20}
          >
            Add
          </Button>
        </div>
        {similarMaterials.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {similarMaterials.map((material, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                {material}
                <button
                  type="button"
                  onClick={() => removeSimilarMaterial(index)}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        {errors.similarMaterials && (
          <p className="text-sm text-red-600">{errors.similarMaterials.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save Material'}
      </Button>
    </form>
  );
}
