'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { onAuthStateChange, getCurrentUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { getAudioPipeline, cleanupAudioPipeline } from '@/lib/audioPipeline';
import type { ProcessedAudio } from '@/lib/audioPipeline';

export default function ScanPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    console.log('🔵 ScanPage: useEffect running, setting up auth listener');
    const unsubscribe = onAuthStateChange((user) => {
      console.log('🔵 ScanPage: Auth state changed', { 
        hasUser: !!user, 
        userId: user?.uid,
        pathname: window.location.pathname,
        search: window.location.search
      });
      
      setUser(user);
      setLoading(false);
      
      // DON'T redirect if we're navigating to form or have scan data
      const hasScanData = sessionStorage.getItem('scanAudioData');
      const isNavigating = sessionStorage.getItem('navigatingToForm') === 'true';
      
      console.log('🔵 ScanPage: Redirect check', { hasScanData: !!hasScanData, isNavigating });
      
      if (hasScanData || isNavigating) {
        console.log('🔵 ScanPage: Has scan data or navigating - preventing redirect');
        return; // Don't redirect during navigation
      }
      
      // Redirect unauthenticated users to landing page
      if (!user) {
        console.log('🔵 ScanPage: No user, redirecting to /');
        router.push('/');
      }
    });

    return () => {
      console.log('🔵 ScanPage: Cleaning up auth listener');
      unsubscribe();
    };
  }, [router]);

  const handleAuthChange = (user: User | null) => {
    setUser(user);
    if (!user) {
      router.push('/');
    }
  };

  const startScan = async () => {
    if (!user) return;
    
    setIsScanning(true);
    setScanStep('Initializing audio system...');
    
    try {
      const pipeline = getAudioPipeline();
      
      // Initialize pipeline with sweep audio
      setScanStep('Loading audio system...');
      // Use absolute path from public folder
      const sweepAudioPath = window.location.origin + '/sweepy_audio.wav';
      console.log('Loading sweep audio from:', sweepAudioPath);
      await pipeline.initialize(sweepAudioPath);
      
      // Run complete pipeline
      setScanStep('Recording ambient noise...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UI
      
      setScanStep('Playing sweep tone and recording...');
      toast.info('You should hear a sweep tone now. Point your device at the material.');
      const processedAudio: ProcessedAudio = await pipeline.runCompletePipeline();
      
      setScanStep('Processing audio data...');
      
      // Extract frequency data for storage - use aggressive downsampling to avoid Firestore index limits
      const originalFreqs = processedAudio.frequencyData.frequencies;
      const originalMags = processedAudio.frequencyData.magnitudes;
      
      // Aggressive downsampling: keep every 50th value (reduces size by 98%)
      // This still preserves key frequency peaks for material identification
      const sampleRate = 50;
      const downsampledFreqs: number[] = [];
      const downsampledMags: number[] = [];
      
      for (let i = 0; i < originalFreqs.length; i += sampleRate) {
        downsampledFreqs.push(originalFreqs[i]);
        downsampledMags.push(originalMags[i]);
      }
      
      // Store key features: peaks and summary statistics
      const maxMagIndex = downsampledMags.indexOf(Math.max(...downsampledMags));
      const peakFrequency = downsampledFreqs[maxMagIndex];
      const peakMagnitude = downsampledMags[maxMagIndex];
      
      // Calculate top 5 peaks for material identification
      const sortedIndices = [...downsampledMags]
        .map((mag, idx) => ({ mag, idx }))
        .sort((a, b) => b.mag - a.mag)
        .slice(0, 5);
      
      const topPeaks = sortedIndices.map(({ mag, idx }) => ({
        frequency: downsampledFreqs[idx],
        magnitude: mag,
      }));
      
      // Store only essential data to minimize index entries
      const frequencyData = {
        // Store only downsampled arrays (much smaller)
        frequencies: downsampledFreqs,
        magnitudes: downsampledMags,
        // Key features for quick matching (no indexing needed)
        peakFrequency,
        peakMagnitude,
        topPeaks, // Top 5 peaks for material identification
        fftSize: processedAudio.frequencyData.fftSize,
        frequencyRange: processedAudio.frequencyData.frequencyRange,
        sampleRate, // Store downsample rate for reconstruction
        timestamp: Date.now(),
      };
      
      // Export processed audio as WAV for storage
      const processedWavBlob = pipeline.exportToWav(processedAudio.sampleRecording);
      
      // Cleanup
      await cleanupAudioPipeline();
      
      // Store processed data in sessionStorage to pass to next page
      sessionStorage.setItem('scanAudioData', JSON.stringify({
        frequencyData,
        audioBlob: await blobToBase64(processedWavBlob),
        audioType: 'audio/wav',
      }));
      
      setScanStep('Scan complete!');
      setIsScanning(false); // Reset scanning state
      
      // Set navigation flag FIRST to prevent any redirects
      sessionStorage.setItem('navigatingToForm', 'true');
      
      // Small delay to ensure flag is set and prevent race conditions
      await new Promise(resolve => setTimeout(resolve, 100));
      
      toast.success('Scan data saved! Redirecting to form...');
      
      // Navigate immediately - use window.location directly since static export doesn't support Next.js router well
      console.log('Scan complete: Navigating to /materials/new');
      console.log('Navigation flag set:', sessionStorage.getItem('navigatingToForm'));
      console.log('Scan data exists:', !!sessionStorage.getItem('scanAudioData'));
      
      // Use immediate navigation without delay
      try {
        // CRITICAL: Use href (not replace) to force full page reload
        // With static export + Firebase rewrites, we need a full reload to load the correct component
        window.location.href = '/materials/new?scanned=1';
      } catch (navError) {
        console.error('Navigation error:', navError);
        // Fallback: try router.push
        router.push('/materials/new?scanned=1');
      }
      
    } catch (error: any) {
      console.error('Scan error:', error);
      toast.error(error.message || 'Failed to scan material. Please try again.');
      setIsScanning(false);
      setScanStep('');
      await cleanupAudioPipeline();
      // Clear navigation flag on error
      sessionStorage.removeItem('navigatingToForm');
    }
  };
  
  // Helper to convert blob to base64 for sessionStorage
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/materials')}
            className="text-green-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold text-gray-900">Scanning Page</h1>
          <div className="w-16"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-10">
        <div className="max-w-md mx-auto flex flex-col items-center">
          {isScanning ? (
            <div className="w-full max-w-sm space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-green-600 animate-spin" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Scanning Material...</h3>
                <p className="text-sm text-gray-600">{scanStep}</p>
                <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="w-56 h-56 rounded-full bg-green-600 flex items-center justify-center shadow-lg mb-8 cursor-pointer hover:bg-green-700 transition-colors"
                   onClick={startScan}>
                <button className="text-white text-2xl font-bold tracking-wide">Start Scan</button>
              </div>
              <Button variant="outline" onClick={startScan} className="mb-2" disabled={isScanning}>
                {isScanning ? 'Scanning...' : 'Start Scan'}
              </Button>
              <button className="text-sm text-green-600 underline" onClick={() => toast.info("Try turning up your volume and moving the phone around.")}>Where's my speaker?</button>
              <p className="text-sm text-gray-600 mt-2">Push and listen to where your speaker is.</p>
            </>
          )}
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
