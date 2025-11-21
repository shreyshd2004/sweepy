import { z } from 'zod';

export const MaterialSchema = z.object({
  materialName: z.string().min(1, 'Material name is required').max(100, 'Material name must be 100 characters or less'),
  howToRecycle: z.string().max(2000, 'How to recycle must be 2000 characters or less').default(''),
  discoveredAt: z.coerce.date(),
  similarMaterials: z.array(z.string().min(1, 'Similar material cannot be empty').max(50, 'Similar material must be 50 characters or less')).max(20, 'Maximum 20 similar materials allowed'),
  imagePath: z.string().optional(),
  audioPath: z.string().optional(),
  frequencyData: z.any().optional(), // Store processed frequency data as JSON
});

export type MaterialInput = z.infer<typeof MaterialSchema>;

export interface Material extends MaterialInput {
  id: string;
  ownerUid: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialDocument {
  id: string;
  ownerUid: string;
  materialName: string;
  howToRecycle: string;
  discoveredAt: Date;
  similarMaterials: string[];
  imagePath?: string;
  audioPath?: string;
  frequencyData?: Record<string, any>; // Processed frequency data from audio pipeline
  createdAt: Date;
  updatedAt: Date;
}

export const SignUpSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be 30 characters or less'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required').max(100, 'Full name must be 100 characters or less'),
  phoneNumber: z.string().optional(),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
});

export type SignUpInput = z.infer<typeof SignUpSchema>;

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  bio?: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Material Catalog (Pokedex) Schemas
export const MaterialCatalogSchema = z.object({
  materialName: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  recyclingInstructions: z.string().max(2000).default(''),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']).default('common'),
  defaultImagePath: z.string().optional(),
  tags: z.array(z.string().max(30)).max(10).default([]),
});

export type MaterialCatalogInput = z.infer<typeof MaterialCatalogSchema>;

export interface MaterialCatalogDocument extends MaterialCatalogInput {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDiscovery {
  userId: string;
  materialId: string;
  discoveredAt: Date;
  discoveryMethod: 'scan' | 'manual' | 'community';
  userMaterialId?: string; // Reference to user's material entry
  isFirstDiscovery: boolean;
  createdAt: Date;
}

export interface MaterialStats {
  materialId: string;
  totalDiscoveries: number;
  totalRecordings: number;
  firstDiscoveredBy?: string;
  firstDiscoveredAt?: Date;
  lastDiscoveredAt?: Date;
  averageFrequencyData?: Record<string, any>;
  updatedAt: Date;
}

export interface MaterialMatchResult {
  matched: boolean;
  materialId?: string;
  materialName?: string;
  confidence: number; // 0-1
  matchReason: 'frequency' | 'name' | 'both' | 'none';
}
