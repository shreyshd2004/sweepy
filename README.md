# Sweepy - Material Recycling Tracker

A modern web application for tracking and managing recyclable materials. Built with Next.js 14, Firebase, and TypeScript.

## Features

- 🔐 **Google Authentication** - Secure sign-in with Google
- 📸 **Material Scanning** - Upload images and manually enter material details
- 🗄️ **Smart Database** - Search, filter, and organize your materials
- ✏️ **CRUD Operations** - Create, read, update, and delete materials
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🎨 **Modern UI** - Clean interface with Tailwind CSS and shadcn/ui

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React

## Project Structure

```
sweepy/
├── app/
│   ├── (auth)/              # Protected routes
│   │   └── layout.tsx       # Auth guard
│   ├── (public)/            # Public routes
│   │   └── page.tsx         # Landing page
│   ├── scan/                # Material scanning page
│   │   └── page.tsx
│   ├── materials/           # Materials database page
│   │   └── page.tsx
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Root redirect
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── AuthButton.tsx       # Authentication component
│   ├── MaterialForm.tsx     # Material creation/edit form
│   ├── MaterialCard.tsx    # Material display card
│   ├── MaterialTable.tsx   # Materials listing
│   └── MaterialDetailDrawer.tsx # Material detail view
├── lib/
│   ├── firebase.ts          # Firebase configuration
│   ├── auth.ts              # Authentication helpers
│   ├── firestore.ts         # Firestore CRUD operations
│   ├── storage.ts           # Storage helpers
│   ├── zodSchemas.ts        # Data validation schemas
│   └── utils.ts             # Utility functions
├── firestore.rules          # Firestore security rules
├── storage.rules            # Storage security rules
└── firebase.json            # Firebase configuration
```

## Data Model

### Material Document Structure

```typescript
interface Material {
  id: string;                    // Document ID
  ownerUid: string;             // User who owns this material
  materialName: string;         // Name of the material (1-100 chars)
  howToRecycle: string;         // Recycling instructions (0-2000 chars)
  discoveredAt: Date;          // When the material was discovered
  similarMaterials: string[];   // Array of similar materials (max 20)
  imagePath?: string;           // Firebase Storage path for image
  createdAt: Date;             // Document creation timestamp
  updatedAt: Date;             // Document update timestamp
}
```

## Firebase Security Rules

### Firestore Rules
- Users can only read/write materials they own
- Field validation ensures data integrity
- Server timestamps are enforced for audit fields

### Storage Rules
- Users can only access files in their own directory
- Path structure: `/materials/{userId}/{filename}`

## API Reference

### Authentication
- `signInWithGoogle()` - Sign in with Google
- `signOutUser()` - Sign out current user
- `getCurrentUser()` - Get current authenticated user
- `onAuthStateChange(callback)` - Listen to auth state changes

### Materials CRUD
- `createMaterial(uid, data)` - Create new material
- `listMaterials(uid, opts)` - List user's materials
- `getMaterial(uid, id)` - Get specific material
- `updateMaterial(uid, id, data)` - Update material
- `deleteMaterial(uid, id)` - Delete material

### Storage
- `uploadMaterialImage(uid, file)` - Upload material image
- `getImageDownloadURL(path)` - Get image download URL
- `deleteMaterialImage(path)` - Delete material image

## License

This project is licensed under the MIT License.

## Support

For support, please open an issue on GitHub or contact the development team.
