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

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project with Authentication, Firestore, and Storage enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sweepy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Create a new Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Authentication (Google provider)
   - Enable Firestore Database
   - Enable Storage
   - Get your Firebase configuration

4. **Configure environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

5. **Deploy Firebase rules**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init
   firebase deploy --only firestore:rules,storage:rules
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

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

## Deployment

### Vercel Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Connect your GitHub repository to Vercel
   - Add environment variables in Vercel dashboard
   - Deploy automatically on push

3. **Update Firebase Auth domains**
   - Add your Vercel domain to Firebase Auth settings
   - Update authorized domains in Firebase console

### Firebase Rules Deployment
```bash
firebase deploy --only firestore:rules,storage:rules
```

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

## 📱 Android App

Your Sweepy web app can also run as a native Android app using Capacitor!

### Android Setup

1. **Install Android Studio**
   - Download from [developer.android.com](https://developer.android.com/studio)
   - Install Android SDK and tools

2. **Build Android App**
   ```bash
   npm run android:build
   ```

3. **Open in Android Studio**
   ```bash
   npm run android:open
   ```

4. **Run on Device/Emulator**
   ```bash
   npm run android:run
   ```

### Android Features
- ✅ Native Android app experience
- ✅ Camera integration for material scanning
- ✅ File system access for image uploads
- ✅ Push notifications (can be added)
- ✅ Offline capabilities (can be added)

## Future Enhancements

- **OCR Integration** - Extract text from uploaded images using Tesseract.js
- **AI Suggestions** - Use ML models to suggest similar materials
- **Sharing** - Share materials with other users
- **Export Features** - Export data in various formats
- **iOS App** - Capacitor iOS version
- **Barcode Scanning** - Scan product barcodes for automatic material detection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, please open an issue on GitHub or contact the development team.