/**
 * Audio Pipeline for Material Identification
 * Replicates the Python pipeline from Material_Sound_ID project
 * 
 * Process:
 * 1. Record ambient noise (1 second)
 * 2. Play sweep + record simultaneously
 * 3. Apply spectral subtraction
 * 4. Return processed audio data
 */

import FFT from 'fft.js';

export interface AudioRecording {
  audioBuffer: AudioBuffer;
  rawData: Float32Array;
  sampleRate: number;
  timestamp: number;
}

export interface ProcessedAudio {
  ambientRecording: AudioRecording;
  sampleRecording: AudioRecording;
  subtractedData: Float32Array;
  frequencyData: FrequencyData;
}

export interface FrequencyData {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  fftSize: number;
  frequencyRange: { min: number; max: number };
}

export class AudioPipeline {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sweepBuffer: AudioBuffer | null = null;
  private workletNode: AudioWorkletNode | null = null;
  
  // Configuration matching Python implementation
  private readonly SAMPLE_RATE = 44100; // 44.1 kHz
  private readonly AMBIENT_DURATION = 1; // 1 second
  private readonly SWEEP_DURATION = 1; // 1.2 seconds to capture full 1s sweep
  private readonly FFT_SIZE = 32768; // Matches Python n_fft
  private readonly FREQ_MIN = 1000; // Hz
  private readonly FREQ_MAX = 20000; // Hz
  private readonly THRESHOLD = 1e-5; // Noise threshold

  constructor() {
    // Initialize on user interaction (required by browsers)
  }

  /**
   * Initialize the audio context and load sweep audio
   */
  async initialize(sweepAudioUrl: string = './sweepy_audio.wav'): Promise<void> {
    try {
      // Create audio context with specific sample rate
      console.log("sweepAudioUrl", sweepAudioUrl);
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.SAMPLE_RATE,
      });

      console.log('Actual sample rate:', this.audioContext.sampleRate);

      // Load worklet module
      await this.setupWorklet();

      // Load sweep audio file
      await this.loadSweepAudio(sweepAudioUrl);

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: this.SAMPLE_RATE,
        },
      });

      console.log('Audio pipeline initialized successfully');
      console.log('MediaStream tracks:', this.mediaStream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState
      })));

    } catch (error) {
      console.error('Failed to initialize audio pipeline:', error);
      throw new Error('Could not initialize audio system. Please check microphone permissions.');
    }
  }

  private async setupWorklet(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    if (this.workletNode) {
      return; // Already set up
    }

    try {
      // @ts-ignore - Vite handles the import.meta.url
      const workletUrl = new URL('./recorder-worklet.ts', import.meta.url);
      await this.audioContext.audioWorklet.addModule(workletUrl);
      console.log('[Main] Worklet module loaded');
    } catch (error) {
      console.error('[Main] Failed to load worklet:', error);
      throw error;
    }
  }

  /**
   * Load sweep audio file
   */
  private async loadSweepAudio(url: string): Promise<void> {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.sweepBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log('Sweep audio loaded:', this.sweepBuffer.duration, 'seconds');
    } catch (error) {
      console.error('Failed to load sweep audio:', error);
      throw new Error('Could not load sweep audio file');
    }
  }

  /**
   * Record ambient noise for spectral subtraction
   */
  async recordAmbientNoise(): Promise<AudioRecording> {
    if (!this.audioContext || !this.mediaStream) {
      throw new Error('Audio pipeline not initialized');
    }

    console.log('Recording ambient noise for', this.AMBIENT_DURATION, 'seconds...');
    
    return this.recordAudio(this.AMBIENT_DURATION);
  }

  /**
   * Play sweep and record simultaneously
   */
  async playSweepAndRecord(): Promise<AudioRecording> {
    if (!this.audioContext || !this.mediaStream || !this.sweepBuffer) {
      throw new Error('Audio pipeline not initialized or sweep not loaded');
    }

    console.log('Playing sweep and recording...');

    // Create a promise that resolves when recording is complete
    const recordingPromise = this.recordAudio(this.SWEEP_DURATION);

    // Play sweep audio
    const source = this.audioContext.createBufferSource();
    source.buffer = this.sweepBuffer;
    source.connect(this.audioContext.destination);
    
    // Start playback immediately
    source.start(0);

    // Wait for recording to complete
    return recordingPromise;
  }

  /**
   * Record audio for specified duration
   */
  private async recordAudio(duration: number): Promise<AudioRecording> {
    if (!this.audioContext || !this.mediaStream) {
      throw new Error('Audio system not ready');
    }

    const context = this.audioContext;
    
    console.log('[Main] AudioContext state:', context.state);
    console.log('[Main] Recording for', duration, 'seconds');

    // Ensure worklet is loaded
    await this.setupWorklet();

    // Create fresh worklet node for this recording
    const workletNode = new AudioWorkletNode(context, 'recorder-worklet');
    const source = context.createMediaStreamSource(this.mediaStream);
    
    // Create silent gain to keep audio graph active
    const silentGain = context.createGain();
    silentGain.gain.value = 0;
    
    const chunks: Float32Array[] = [];
    let messageCount = 0;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error('[Main] Recording timeout!');
        cleanup();
        reject(new Error('Recording timeout'));
      }, (duration + 1) * 1000);

      // Listen for audio data from worklet
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'data') {
          messageCount++;
          chunks.push(new Float32Array(event.data.audioData));
          
          if (messageCount === 1) {
            console.log('[Main] Received first chunk of data');
          }
        }
      };

      // Connect audio graph
      source.connect(workletNode);
      workletNode.connect(silentGain);
      silentGain.connect(context.destination);
      
      console.log('[Main] Audio graph connected');

      const cleanup = () => {
        clearTimeout(timeout);
        
        // Stop recording
        workletNode.port.postMessage({ type: 'stop' });
        
        // Disconnect
        source.disconnect();
        workletNode.disconnect();
        silentGain.disconnect();
        
        console.log(`[Main] Cleanup complete. Received ${messageCount} messages`);
      };

      // Start recording
      workletNode.port.postMessage({ type: 'start' });

      // Stop recording after duration
      setTimeout(() => {
        cleanup();

        console.log(`[Main] Captured ${chunks.length} chunks from ${messageCount} messages`);

        // Combine chunks into single array
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        
        if (totalLength === 0) {
          console.error('[Main] ERROR: No audio data captured!');
        }
        
        const rawData = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          rawData.set(chunk, offset);
          offset += chunk.length;
        }

        // Log statistics
        const maxAmplitude = Math.max(...Array.from(rawData).map(Math.abs));
        const hasData = rawData.some(s => Math.abs(s) > 0.0001);
        console.log(`[Main] Total samples: ${totalLength}, Max amplitude: ${maxAmplitude.toFixed(6)}, Has data: ${hasData}`);

        // Create AudioBuffer
        const audioBuffer = context.createBuffer(1, rawData.length, context.sampleRate);
        audioBuffer.copyToChannel(rawData, 0);

        resolve({
          audioBuffer,
          rawData,
          sampleRate: context.sampleRate,
          timestamp: Date.now(),
        });
      }, duration * 1000);
    });
  }
 
  /**
   * Perform spectral subtraction (ambient noise removal)
   * This replicates: sample_fft = sample_fft - control_fft
   */
  spectralSubtraction(
    ambientRecording: AudioRecording,
    sampleRecording: AudioRecording
  ): Float32Array {
    const fft = new FFT(32768);
    const ambientFreq = fft.createComplexArray();
    const sampleFreq = fft.createComplexArray();
    const resultFreq = fft.createComplexArray();

    fft.realTransform(ambientFreq, ambientRecording.rawData);
    fft.realTransform(sampleFreq, sampleRecording.rawData);

    for (let i = 0; i < sampleFreq.length; i += 2) {
      const magSample = Math.hypot(sampleFreq[i], sampleFreq[i+1]);
      const magAmbient = Math.hypot(ambientFreq[i], ambientFreq[i+1]);
      const magClean = Math.max(0, magSample - magAmbient);
      const phase = Math.atan2(sampleFreq[i+1], sampleFreq[i]);
      resultFreq[i] = magClean * Math.cos(phase);
      resultFreq[i+1] = magClean * Math.sin(phase);
    }

    const result = new Float32Array(ambientRecording.rawData.length);
    fft.inverseTransform(result, resultFreq);
    return result;
  }

/**
* Compute STFT and average (matching Python spectral.py)
*/
computeSTFT(audioData: Float32Array): FrequencyData {
  const fftSize = this.FFT_SIZE;
  const hopSize = fftSize / 2; // 50% overlap
  const numFrames = Math.floor((audioData.length - fftSize) / hopSize) + 1;
  
  const binWidth = this.SAMPLE_RATE / fftSize;
  const minBin = Math.floor(this.FREQ_MIN / binWidth);
  const maxBin = Math.floor(this.FREQ_MAX / binWidth);
  const numBins = maxBin - minBin;
  
  // Store magnitudes for each time frame
  const magnitudesOverTime: Float32Array[] = [];
  const fft = new FFT(fftSize);
  
  // Process each frame
  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize;
    const frameData = new Float32Array(fftSize);
    
    // Extract frame with bounds checking
    const copyLength = Math.min(fftSize, audioData.length - offset);
    frameData.set(audioData.subarray(offset, offset + copyLength));
    
    // Apply Hann window
    for (let i = 0; i < fftSize; i++) {
      const windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
      frameData[i] *= windowValue;
    }
    
    // Compute FFT for this frame
    const complexArray = fft.createComplexArray();
    fft.realTransform(complexArray, frameData);
    
    // Extract magnitudes for frequency range
    const frameMagnitudes = new Float32Array(numBins);
    for (let i = minBin; i < maxBin; i++) {
      const real = complexArray[i * 2];
      const imag = complexArray[i * 2 + 1];
      const magnitude = Math.hypot(real, imag) / fftSize;
      frameMagnitudes[i - minBin] = magnitude;
    }
    
    magnitudesOverTime.push(frameMagnitudes);
  }
  
  // Average across time (with threshold like Python)
  const avgMagnitudes = new Float32Array(numBins);
  const frequencies = new Float32Array(numBins);
  
  for (let bin = 0; bin < numBins; bin++) {
    let sum = 0;
    let count = 0;
    
    // Average with threshold (NaN treatment like Python)
    for (const frameMag of magnitudesOverTime) {
      if (frameMag[bin] > this.THRESHOLD) {
        sum += frameMag[bin];
        count++;
      }
    }
    
    avgMagnitudes[bin] = count > 0 ? sum / count : 0;
    frequencies[bin] = (minBin + bin) * binWidth;
  }
  
  return {
    frequencies,
    magnitudes: avgMagnitudes,
    fftSize,
    frequencyRange: { min: this.FREQ_MIN, max: this.FREQ_MAX },
  };
}

  /**
   * Complete pipeline: record ambient, record sample with sweep, process
   */
  async runCompletePipeline(): Promise<ProcessedAudio> {
    console.log('Starting complete audio pipeline...');

    // Step 1: Record ambient noise
    const ambientRecording = await this.recordAmbientNoise();
    
    // Short delay between recordings
    await this.delay(500);

    // Step 2: Play sweep and record
    const sampleRecording = await this.playSweepAndRecord();

    // Step 3: Spectral subtraction
    const sampleFFT = this.computeSTFT(sampleRecording.rawData);
    const ambientFFT = this.computeSTFT(ambientRecording.rawData);

    // Step 4: Compute FFT
    const subtractedMagnitudes = new Float32Array(sampleFFT.magnitudes.length);
    for (let i = 0; i < sampleFFT.magnitudes.length; i++) {
      subtractedMagnitudes[i] = Math.max(0, sampleFFT.magnitudes[i] - ambientFFT.magnitudes[i]);
    }

    console.log('Pipeline complete!');

    const processedFrequencyData = {
      frequencies: sampleFFT.frequencies,
      magnitudes: subtractedMagnitudes,
      fftSize: sampleFFT.fftSize,
      frequencyRange: sampleFFT.frequencyRange
    };

    // Logic to save to DATABASES WILL GO HERE


    return {
    ambientRecording: ambientRecording,
    sampleRecording: sampleRecording,
    subtractedData: new Float32Array(0), // Not used in this approach
    frequencyData: processedFrequencyData,
  };
}

  /**
   * Export recording as WAV file
   */
  exportToWav(audioRecording: AudioRecording): Blob {
    const buffer = audioRecording.audioBuffer;
    const length = buffer.length * buffer.numberOfChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, buffer.numberOfChannels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 2 * buffer.numberOfChannels, true);
    view.setUint16(32, buffer.numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);

    // Write audio data
    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {

    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    console.log('Audio pipeline cleaned up');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current state
   */
  isInitialized(): boolean {
    return this.audioContext !== null && this.mediaStream !== null && this.sweepBuffer !== null;
  }
}

// Singleton instance
let audioPipelineInstance: AudioPipeline | null = null;

export function getAudioPipeline(): AudioPipeline {
  if (!audioPipelineInstance) {
    audioPipelineInstance = new AudioPipeline();
  }
  return audioPipelineInstance;
}

export async function cleanupAudioPipeline(): Promise<void> {
  if (audioPipelineInstance) {
    await audioPipelineInstance.cleanup();
    audioPipelineInstance = null;
  }
}