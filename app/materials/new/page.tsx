'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { onAuthStateChange } from '@/lib/auth';
import { createMaterial } from '@/lib/firestore';
import { MaterialForm } from '@/components/MaterialForm';
import { MaterialInput } from '@/lib/zodSchemas';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { BottomNavigation } from '@/components/BottomNavigation';
import { uploadMaterialAudio } from '@/lib/storage';
import { getAudioPipeline, cleanupAudioPipeline } from '@/lib/audioPipeline';
import type { ProcessedAudio } from '@/lib/audioPipeline';
import { Loader2 } from 'lucide-react';
import { matchMaterialToCatalog, linkMaterialToCatalog, createCatalogEntry } from '@/lib/firestore-catalog';
import { MaterialMatchDialog } from '@/components/MaterialMatchDialog';
import { MaterialMatchResult } from '@/lib/zodSchemas';

export default function NewMaterialPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordTime, setRecordTime] = useState(0);
  const [recordTimer, setRecordTimer] = useState<NodeJS.Timeout | null>(null);
  const [hasScannedAudio, setHasScannedAudio] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [materialMatches, setMaterialMatches] = useState<MaterialMatchResult[]>([]);
  const [pendingMaterialData, setPendingMaterialData] = useState<{ materialId: string; payload: any } | null>(null);
  const router = useRouter();

  useEffect(() => {
    console.log('🟢 NewMaterialPage: useEffect running');
    
    // CRITICAL: Check pathname FIRST - if we're on this page, NEVER redirect away
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isOnNewMaterialPage = currentPath === '/materials/new' || currentPath === '/materials/new/';
    const urlHasScanned = typeof window !== 'undefined' && window.location.search.includes('scanned=1');
    const hasNavigationFlag = sessionStorage.getItem('navigatingToForm') === 'true';
    const hasScanData = !!sessionStorage.getItem('scanAudioData');
    
    // Clear navigation flag since we've arrived
    if (hasNavigationFlag) {
      console.log('🟢 NewMaterialPage: Clearing navigation flag');
      sessionStorage.removeItem('navigatingToForm');
    }
    
    // CRITICAL: If we have scan data or scanned param, set loading to false immediately
    // Don't wait for auth - we can show the form and load scan data
    if (hasScanData || urlHasScanned) {
      console.log('🟢 NewMaterialPage: Has scan data or scanned param - setting loading to false immediately');
      setLoading(false);
      
      // Load scan data immediately if available
      if (hasScanData) {
        try {
          const scanData = sessionStorage.getItem('scanAudioData');
          if (scanData) {
            const parsed = JSON.parse(scanData);
            if (parsed.audioBlob) {
              console.log('🟢 NewMaterialPage: Loading scan data immediately');
              const byteCharacters = atob(parsed.audioBlob);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: parsed.audioType || 'audio/wav' });
              setAudioBlob(blob);
              setAudioUrl(URL.createObjectURL(blob));
              setHasScannedAudio(true);
            }
          }
        } catch (e) {
          console.error('🟢 NewMaterialPage: Failed to load scan data immediately:', e);
        }
      }
    }
    
    console.log('🟢 NewMaterialPage: Initial check', { 
      isOnNewMaterialPage, 
      urlHasScanned, 
      hadNavigationFlag: hasNavigationFlag,
      hasScanData,
      currentPath 
    });
    
    // If we're on the new material page with scanned param, NEVER redirect
    if (isOnNewMaterialPage && (urlHasScanned || hasNavigationFlag)) {
      console.log('NewMaterialPage: On correct page with scan indicator - preventing ALL redirects');
    }
    
    let redirectTimeout: NodeJS.Timeout | null = null;
    let hasLoadedScanData = false;
    
    // Fallback: If auth doesn't fire within 2 seconds and we have scan data, show the form anyway
    const loadingTimeout = setTimeout(() => {
      if (hasScanData || urlHasScanned) {
        console.log('🟢 NewMaterialPage: Loading timeout - showing form with scan data');
        setLoading(false);
      }
    }, 2000);
    
    const unsub = onAuthStateChange((u) => {
      // Clear the loading timeout since auth fired
      clearTimeout(loadingTimeout);
      // Check for scan data FRESH each time (not from closure)
      const scanData = sessionStorage.getItem('scanAudioData');
      const hasScanData = !!scanData;
      const currentPathCheck = typeof window !== 'undefined' ? window.location.pathname : '';
      const stillOnNewPage = currentPathCheck === '/materials/new' || currentPathCheck === '/materials/new/';
      
      console.log('🟢 NewMaterialPage: Auth state changed', { 
        hasUser: !!u, 
        userId: u?.uid,
        hasScanData, 
        urlHasScanned,
        isOnNewMaterialPage,
        stillOnNewPage,
        pathname: currentPathCheck,
        search: typeof window !== 'undefined' ? window.location.search : 'unknown'
      });
      
      setUser(u);
      setLoading(false);
      
      // CRITICAL: If we're on the new material page with scan indicators, NEVER redirect
      if (isOnNewMaterialPage && (hasScanData || urlHasScanned || hasNavigationFlag)) {
        console.log('NewMaterialPage: On new material page with scan data - preventing any redirects');
        
        // Clear any pending redirect immediately
        if (redirectTimeout) {
          clearTimeout(redirectTimeout);
          redirectTimeout = null;
        }
        
        // Load scan data if we haven't already
        if (scanData && !hasLoadedScanData) {
          hasLoadedScanData = true;
          console.log('NewMaterialPage: Found scan data in sessionStorage');
          try {
            const parsed = JSON.parse(scanData);
            if (parsed.audioBlob) {
              console.log('NewMaterialPage: Processing audio blob from scan');
              // Convert base64 back to blob
              const byteCharacters = atob(parsed.audioBlob);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: parsed.audioType || 'audio/wav' });
              setAudioBlob(blob);
              setAudioUrl(URL.createObjectURL(blob));
              setHasScannedAudio(true);
              console.log('NewMaterialPage: Scan audio loaded successfully');
              // Don't remove scanAudioData yet - we need frequencyData for submission
            }
          } catch (e) {
            console.error('NewMaterialPage: Failed to load scan audio data:', e);
          }
        }
        return; // Exit early - don't check auth if we have scan data
      }
      
      // Only redirect if we DON'T have scan data AND no user after timeout AND we're not on the new material page
      if (!u && !isOnNewMaterialPage) {
        // Wait 3 seconds for auth to initialize before redirecting
        if (!redirectTimeout) {
          redirectTimeout = setTimeout(() => {
            // Triple-check: no scan data, no scanned param, not on new material page, and still no user
            const stillNoScanData = !sessionStorage.getItem('scanAudioData');
            const stillNoScannedParam = !window.location.search.includes('scanned=1');
            const stillNotOnNewPage = window.location.pathname !== '/materials/new' && window.location.pathname !== '/materials/new/';
            if (stillNoScanData && stillNoScannedParam && stillNotOnNewPage && !u) {
              console.log('NewMaterialPage: No user and no scan data after timeout, redirecting to /');
              router.push('/');
            }
          }, 3000);
        }
      } else {
        // Clear redirect if we have a user or we're on the right page
        if (redirectTimeout) {
          clearTimeout(redirectTimeout);
          redirectTimeout = null;
        }
      }
    });
    
    return () => {
      if (redirectTimeout) clearTimeout(redirectTimeout);
      clearTimeout(loadingTimeout);
      unsub();
    };
  }, [router]);

  const handleSubmit = async (data: MaterialInput) => {
    if (!user) {
      toast.error('You must be signed in to save materials.');
      return;
    }
    
    setIsSubmitting(true);
    console.log('Starting material save...', { userId: user.uid, data });
    
    try {
      const payload: any = { ...data };
      
      // Check for frequency data from scan
      const scanData = sessionStorage.getItem('scanAudioData');
      if (scanData) {
        try {
          const parsed = JSON.parse(scanData);
          console.log('Found scan data:', { hasFrequencyData: !!parsed.frequencyData, hasAudioBlob: !!parsed.audioBlob });
          if (parsed.frequencyData) {
            payload.frequencyData = parsed.frequencyData;
            console.log('Added frequency data to payload');
          }
        } catch (e) {
          console.error('Failed to parse frequency data:', e);
        }
      } else {
        console.log('No scan data found in sessionStorage');
      }
      
      // Upload audio if available
      if (audioBlob) {
        console.log('Uploading audio blob...', { size: audioBlob.size, type: audioBlob.type });
        try {
          const audioPath = await uploadMaterialAudio(user.uid, audioBlob);
          payload.audioPath = audioPath;
          console.log('Audio uploaded successfully:', audioPath);
        } catch (audioError) {
          console.error('Audio upload error:', audioError);
          toast.error('Failed to upload audio. Saving material without audio.');
          // Continue without audio rather than failing completely
        }
      } else {
        console.log('No audio blob to upload');
      }
      
      console.log('Creating material with payload:', { 
        materialName: payload.materialName,
        hasImagePath: !!payload.imagePath,
        hasAudioPath: !!payload.audioPath,
        hasFrequencyData: !!payload.frequencyData
      });
      
      const materialId = await createMaterial(user.uid, payload);
      console.log('Material created successfully:', materialId);
      
      // Try to match to catalog
      try {
        const matches = await matchMaterialToCatalog(payload.materialName, payload.frequencyData);
        
        if (matches.length > 0 && matches[0].confidence > 0.5) {
          // Show match dialog for user approval
          setMaterialMatches(matches);
          setPendingMaterialData({ materialId, payload });
          setShowMatchDialog(true);
          setIsSubmitting(false);
          return; // Don't navigate yet, wait for user decision
        } else {
          // No good matches, create new catalog entry
          await handleCreateNewCatalogEntry(materialId, payload, user.uid);
        }
      } catch (matchError) {
        console.error('Error matching material:', matchError);
        // Continue anyway - create new catalog entry
        await handleCreateNewCatalogEntry(materialId, payload, user.uid);
      }
      
      toast.success('Material saved to database!');
      sessionStorage.removeItem('scanAudioData'); // Clean up
      router.push('/materials');
    } catch (e: any) {
      console.error('Save error details:', {
        error: e,
        message: e?.message,
        code: e?.code,
        stack: e?.stack
      });
      const errorMessage = e?.message || e?.code || 'Failed to save material. Please check console for details.';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      rec.start();
      setMediaRecorder(rec);
      setIsRecording(true);
      const timer = setInterval(() => {
        setRecordTime((t) => {
          const next = t + 1;
          if (next >= 30) {
            rec.stop();
            setIsRecording(false);
            if (timer) clearInterval(timer);
            return 30;
          }
          return next;
        });
      }, 1000);
      setRecordTimer(timer);
    } catch (err) {
      console.error(err);
      toast.error('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordTimer) {
        clearInterval(recordTimer);
        setRecordTimer(null);
      }
    }
  };

  // Handle creating new catalog entry
  const handleCreateNewCatalogEntry = async (materialId: string, payload: any, userId: string) => {
    try {
      // For now, use a simple category extraction or default
      // In the future, this could be a proper dialog
      const category = payload.category || 'Uncategorized';
      
      await createCatalogEntry(
        {
          materialName: payload.materialName,
          category: category.trim() || 'Uncategorized',
          recyclingInstructions: payload.howToRecycle || '',
          description: '',
          rarity: 'common', // Will be updated based on discovery count
          defaultImagePath: payload.imagePath || undefined,
          tags: [],
        },
        userId,
        materialId
      );
      
      console.log('Created new catalog entry');
    } catch (error) {
      console.error('Error creating catalog entry:', error);
      // Don't fail the whole operation if catalog creation fails
    }
  };

  // Handle match selection
  const handleMatchSelect = async (matchedMaterialId: string) => {
    if (!user || !pendingMaterialData) return;
    
    setIsSubmitting(true);
    setShowMatchDialog(false);
    
    try {
      await linkMaterialToCatalog(
        user.uid,
        matchedMaterialId,
        pendingMaterialData.materialId,
        !!pendingMaterialData.payload.audioPath
      );
      
      toast.success('Material linked to existing catalog entry!');
      sessionStorage.removeItem('scanAudioData');
      router.push('/materials');
    } catch (error) {
      console.error('Error linking material:', error);
      toast.error('Failed to link material. Creating new entry instead.');
      await handleCreateNewCatalogEntry(pendingMaterialData.materialId, pendingMaterialData.payload, user.uid);
      router.push('/materials');
    } finally {
      setIsSubmitting(false);
      setPendingMaterialData(null);
    }
  };

  // Handle create new catalog entry from dialog
  const handleCreateNewFromDialog = async () => {
    if (!user || !pendingMaterialData) return;
    
    setIsSubmitting(true);
    setShowMatchDialog(false);
    
    try {
      await handleCreateNewCatalogEntry(pendingMaterialData.materialId, pendingMaterialData.payload, user.uid);
      toast.success('Material saved to database!');
      sessionStorage.removeItem('scanAudioData');
      router.push('/materials');
    } catch (error) {
      console.error('Error creating catalog entry:', error);
      toast.error('Failed to create catalog entry.');
    } finally {
      setIsSubmitting(false);
      setPendingMaterialData(null);
    }
  };

  // Inline material scanning using audio pipeline
  const startMaterialScan = async () => {
    if (!user || isScanning) return;
    
    setIsScanning(true);
    setScanStep('Initializing audio system...');
    
    try {
      const pipeline = getAudioPipeline();
      
      // Initialize pipeline with sweep audio
      setScanStep('Loading audio system...');
      const sweepAudioPath = window.location.origin + '/sweepy_audio.wav';
      console.log('Loading sweep audio from:', sweepAudioPath);
      await pipeline.initialize(sweepAudioPath);
      
      // Run complete pipeline
      setScanStep('Recording ambient noise...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setScanStep('Playing sweep tone and recording...');
      toast.info('You should hear a sweep tone now. Point your device at the material.');
      const processedAudio: ProcessedAudio = await pipeline.runCompletePipeline();
      
      setScanStep('Processing audio data...');
      
      // Extract frequency data for storage - use aggressive downsampling
      const originalFreqs = processedAudio.frequencyData.frequencies;
      const originalMags = processedAudio.frequencyData.magnitudes;
      
      // Aggressive downsampling: keep every 50th value
      const sampleRate = 50;
      const downsampledFreqs: number[] = [];
      const downsampledMags: number[] = [];
      
      for (let i = 0; i < originalFreqs.length; i += sampleRate) {
        downsampledFreqs.push(originalFreqs[i]);
        downsampledMags.push(originalMags[i]);
      }
      
      // Store key features
      const maxMagIndex = downsampledMags.indexOf(Math.max(...downsampledMags));
      const peakFrequency = downsampledFreqs[maxMagIndex];
      const peakMagnitude = downsampledMags[maxMagIndex];
      
      // Calculate top 5 peaks
      const sortedIndices = [...downsampledMags]
        .map((mag, idx) => ({ mag, idx }))
        .sort((a, b) => b.mag - a.mag)
        .slice(0, 5);
      
      const topPeaks = sortedIndices.map(({ mag, idx }) => ({
        frequency: downsampledFreqs[idx],
        magnitude: mag,
      }));
      
      const frequencyData = {
        frequencies: downsampledFreqs,
        magnitudes: downsampledMags,
        peakFrequency,
        peakMagnitude,
        topPeaks,
        fftSize: processedAudio.frequencyData.fftSize,
        frequencyRange: processedAudio.frequencyData.frequencyRange,
        sampleRate,
        timestamp: Date.now(),
      };
      
      // Export processed audio as WAV
      const processedWavBlob = pipeline.exportToWav(processedAudio.sampleRecording);
      
      // Cleanup
      await cleanupAudioPipeline();
      
      // Store in state (no need for sessionStorage since we're on the same page)
      setAudioBlob(processedWavBlob);
      setAudioUrl(URL.createObjectURL(processedWavBlob));
      setHasScannedAudio(true);
      
      // Store frequency data in sessionStorage for submission
      sessionStorage.setItem('scanAudioData', JSON.stringify({
        frequencyData,
        audioBlob: await blobToBase64(processedWavBlob),
        audioType: 'audio/wav',
      }));
      
      setScanStep('Scan complete!');
      toast.success('Material scanned successfully! Audio recorded and ready to save.');
      
      // Ensure loading is false and form is visible
      setLoading(false);
      setIsScanning(false);
      setScanStep('');
      
    } catch (error: any) {
      console.error('Scan error:', error);
      toast.error(error.message || 'Failed to scan material. Please try again.');
      await cleanupAudioPipeline();
      setLoading(false);
      setIsScanning(false);
      setScanStep('');
    }
  };

  // Helper to convert blob to base64
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

  // Don't show loading spinner if we're scanning OR if we have scan data (show form instead)
  // Allow form to show even without user if we have scan data (user will load soon)
  const urlHasScannedCheck = typeof window !== 'undefined' && window.location.search.includes('scanned=1');
  if (loading && !isScanning && !hasScannedAudio && !urlHasScannedCheck) {
    console.log('NewMaterialPage: Still loading...', { loading, isScanning, hasUser: !!user, hasScannedAudio });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Only block if no user AND no scan data AND not scanning
  if (!user && !isScanning && !hasScannedAudio && !urlHasScannedCheck) {
    console.log('NewMaterialPage: No user and no scan data, returning null');
    return null;
  }

  console.log('NewMaterialPage: Rendering form', { 
    hasUser: !!user, 
    hasScannedAudio, 
    hasAudioBlob: !!audioBlob,
    isScanning,
    loading,
    scanStep
  });

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="px-4 py-6 max-w-md mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 text-center text-gray-700">
          You Discovered A New Material! Describe it and add a photo.
        </div>
             {user && <MaterialForm onSubmit={handleSubmit} isLoading={isSubmitting} userId={user.uid} />}
             </div>
             {/* Material Match Dialog */}
             {showMatchDialog && (
               <MaterialMatchDialog
                 isOpen={showMatchDialog}
                 matches={materialMatches}
                 materialName={pendingMaterialData?.payload.materialName || ''}
                 onSelectMatch={handleMatchSelect}
                 onCreateNew={handleCreateNewFromDialog}
                 onCancel={() => {
                   setShowMatchDialog(false);
                   setPendingMaterialData(null);
                   setIsSubmitting(false);
                 }}
               />
             )}

             <BottomNavigation />
           </div>
         );
       }


