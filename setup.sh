#!/bin/bash

# Sweepy Environment Setup Script
echo "🚀 Setting up Sweepy environment..."

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local file..."
    cat > .env.local << EOF
# Firebase Configuration
# Replace these values with your Firebase project details

NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
EOF
    echo "✅ Created .env.local file"
    echo "⚠️  Please update .env.local with your Firebase project details"
else
    echo "✅ .env.local already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your Firebase project details"
echo "2. Set up Firebase project with Authentication, Firestore, and Storage"
echo "3. Deploy Firebase rules: npm run firebase:rules"
echo "4. Start development server: npm run dev"
echo ""
echo "For detailed setup instructions, see README.md"
