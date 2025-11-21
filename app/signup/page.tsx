'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { signUpWithEmail, updateDisplayName, updatePhotoURL } from '@/lib/auth';
import { createUserProfile } from '@/lib/firestore';
import { uploadUserProfileImage } from '@/lib/storage';
import { SignUpSchema, SignUpInput } from '@/lib/zodSchemas';
import { toast } from 'sonner';
import { ArrowLeft, Upload, X } from 'lucide-react';
import Link from 'next/link';

export default function SignUpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SignUpInput>({
    username: '',
    email: '',
    password: '',
    fullName: '',
    phoneNumber: '',
    bio: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const handleChange = (field: keyof SignUpInput, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const compressImage = (file: File, maxWidth: number = 400, maxHeight: number = 400, quality: number = 0.8): Promise<File> => {
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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    setIsProcessingImage(true);
    try {
      const compressedFile = await compressImage(file);
      setProfileImage(compressedFile);

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
      toast.error('Failed to process image');
      setIsProcessingImage(false);
    }
  };

  const removeImage = () => {
    setProfileImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      // Validate form data
      const validated = SignUpSchema.parse(formData);

      // Create auth account
      const user = await signUpWithEmail(validated.email, validated.password);

      // Update display name in auth
      await updateDisplayName(user, validated.fullName);

      // Upload profile image if provided
      let photoURL: string | undefined = undefined;
      if (profileImage) {
        try {
          photoURL = await uploadUserProfileImage(user.uid, profileImage);
          // Update auth profile with photoURL
          await updatePhotoURL(user, photoURL);
        } catch (imageError) {
          console.error('Error uploading profile image:', imageError);
          toast.error('Failed to upload profile image, but account was created');
          // Continue without photoURL
        }
      }

      // Create user profile in Firestore
      await createUserProfile(user.uid, {
        username: validated.username,
        email: validated.email,
        fullName: validated.fullName,
        phoneNumber: validated.phoneNumber || undefined,
        bio: validated.bio || undefined,
        photoURL: photoURL,
      });

      toast.success('Account created successfully!');
      if (typeof window !== 'undefined') {
        window.location.href = '/scan';
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      if (error.errors) {
        // Zod validation errors
        const zodErrors: Record<string, string> = {};
        error.errors.forEach((err: any) => {
          if (err.path) {
            zodErrors[err.path[0]] = err.message;
          }
        });
        setErrors(zodErrors);
      } else if (error.code === 'auth/email-already-in-use') {
        setErrors({ email: 'This email is already registered. Please sign in instead.' });
      } else if (error.code === 'auth/weak-password') {
        setErrors({ password: 'Password is too weak. Please use a stronger password.' });
      } else if (error.code === 'auth/invalid-email') {
        setErrors({ email: 'Invalid email address.' });
      } else {
        toast.error(error.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-green-600"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/';
              }
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <h1 className="text-lg font-semibold text-gray-900 ml-4">Create Account</h1>
        </div>
      </div>

      <div className="px-4 py-6 max-w-md mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile Image Upload */}
          <div>
            <label htmlFor="profileImage" className="block text-sm font-medium text-gray-700 mb-1">
              Profile Picture (Optional)
            </label>
            <div className="flex items-center gap-4">
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Profile preview"
                    className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  {isProcessingImage ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  ) : (
                    <Upload className="w-8 h-8 text-gray-400" />
                  )}
                </div>
              )}
              <div className="flex-1">
                <label
                  htmlFor="profileImage"
                  className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {imagePreview ? 'Change Photo' : 'Upload Photo'}
                </label>
                <input
                  id="profileImage"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  disabled={isProcessingImage}
                />
                <p className="text-xs text-gray-500 mt-1">JPG, PNG up to 10MB</p>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username *
            </label>
            <Input
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) => handleChange('username', e.target.value)}
              placeholder="Choose a username"
              required
              className={errors.username ? 'border-red-500' : ''}
            />
            {errors.username && (
              <p className="text-xs text-red-500 mt-1">{errors.username}</p>
            )}
          </div>

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <Input
              id="fullName"
              type="text"
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              placeholder="Your full name"
              required
              className={errors.fullName ? 'border-red-500' : ''}
            />
            {errors.fullName && (
              <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="your.email@example.com"
              required
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className="text-xs text-red-500 mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder="At least 6 characters"
              required
              className={errors.password ? 'border-red-500' : ''}
            />
            {errors.password && (
              <p className="text-xs text-red-500 mt-1">{errors.password}</p>
            )}
          </div>

          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number (Optional)
            </label>
            <Input
              id="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => handleChange('phoneNumber', e.target.value)}
              placeholder="+1 (555) 123-4567"
              className={errors.phoneNumber ? 'border-red-500' : ''}
            />
            {errors.phoneNumber && (
              <p className="text-xs text-red-500 mt-1">{errors.phoneNumber}</p>
            )}
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
              Bio (Optional)
            </label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
              maxLength={500}
              className={errors.bio ? 'border-red-500' : ''}
            />
            {errors.bio && (
              <p className="text-xs text-red-500 mt-1">{errors.bio}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">{(formData.bio || '').length}/500</p>
          </div>

          <Button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>

          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/signin';
                }
              }}
              className="text-green-600 hover:underline"
            >
              Sign in
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

