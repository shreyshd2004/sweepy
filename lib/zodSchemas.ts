import { z } from 'zod';

export const MaterialSchema = z.object({
  materialName: z.string().min(1, 'Material name is required').max(100, 'Material name must be 100 characters or less'),
  howToRecycle: z.string().max(2000, 'How to recycle must be 2000 characters or less').default(''),
  discoveredAt: z.coerce.date(),
  similarMaterials: z.array(z.string().min(1, 'Similar material cannot be empty').max(50, 'Similar material must be 50 characters or less')).max(20, 'Maximum 20 similar materials allowed'),
  imagePath: z.string().optional(),
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
  createdAt: Date;
  updatedAt: Date;
}
