class RecorderWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.sampleCount = 0;
    
    this.port.onmessage = (event) => {
      if (event.data.type === 'start') {
        this.isRecording = true;
        this.sampleCount = 0;
        console.log('[Worklet] Recording started');
      } else if (event.data.type === 'stop') {
        console.log(`[Worklet] Recording stopped. Samples: ${this.sampleCount}`);
        this.isRecording = false;
      }
    };
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    
    if (this.isRecording && input && input.length > 0) {
      this.sampleCount += input.length;
      
      // Copy the data instead of transferring the buffer
      const dataCopy = new Float32Array(input);
      
      this.port.postMessage({
        type: 'data',
        audioData: dataCopy
      });
    }
    
    return true;
  }
}

registerProcessor('recorder-worklet', RecorderWorklet);

