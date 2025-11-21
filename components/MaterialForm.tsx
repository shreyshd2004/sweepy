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
  userId: string;
}

export function MaterialForm({ initialData, onSubmit, isLoading = false, userId }: MaterialFormProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
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

  // Compress and resize image for preview
  const compressImage = (file: File, maxWidth: number = 800, maxHeight: number = 600, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: file.type,
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Compression failed'));
              }
            },
            file.type,
            quality
          );
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('Image is too large. Please select an image smaller than 10MB.');
      return;
    }

    setIsProcessingImage(true);
    
    try {
      // Compress image for better performance
      const compressedFile = await compressImage(file);
      setImageFile(compressedFile);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
        setIsProcessingImage(false);
      };
      reader.onerror = () => {
        toast.error('Failed to load image preview');
        setIsProcessingImage(false);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image. Please try again.');
      setIsProcessingImage(false);
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
      // Validate image is provided (required)
      if (!imageFile && !initialData?.imagePath) {
        toast.error('An image is required. Please upload a photo.');
        return;
      }

      let imagePath = initialData?.imagePath || null;

      // Upload image if new one is selected
      if (imageFile) {
        try {
          imagePath = await uploadMaterialImage(userId, imageFile);
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          toast.error('Failed to upload image. Please try again.');
          return;
        }
      }

      // Ensure imagePath is a string or null (not undefined) - required field
      if (!imagePath) {
        toast.error('An image is required. Please upload a photo.');
        return;
      }
      
      const submitData: MaterialInput = {
        ...data,
        similarMaterials,
        imagePath: imagePath, // Must be a string, never undefined or null
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
    } catch (error: any) {
      console.error('Error submitting form:', error);
      const errorMessage = error?.message || 'Failed to save material. Please try again.';
      toast.error(errorMessage);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit as any)} className="space-y-6">
      {/* Image Upload */}
      <div className="space-y-4">
        <label className="text-sm font-medium">Material Image *</label>
        
        {isProcessingImage ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <div className="space-y-2">
              <div className="w-8 h-8 mx-auto border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-gray-600">Processing image...</p>
            </div>
          </div>
        ) : imagePreview ? (
          <div className="relative">
            <img 
              src={imagePreview} 
              alt="Preview" 
              className="w-full h-48 object-cover rounded-lg border"
              loading="lazy"
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
              <p className="text-xs text-gray-500">Max size: 10MB</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImage}
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
