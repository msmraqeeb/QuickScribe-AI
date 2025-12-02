import lamejs from 'lamejs';

// Helper to write string to DataView
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Convert AudioBuffer to WAV Blob
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  let result: Float32Array;
  
  // Interleave channels if stereo
  if (numChannels === 2) {
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      result = new Float32Array(left.length + right.length);
      for (let i = 0; i < left.length; i++) {
          result[i * 2] = left[i];
          result[i * 2 + 1] = right[i];
      }
  } else {
      result = buffer.getChannelData(0);
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const bufferLength = 44 + result.length * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + result.length * bytesPerSample, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * blockAlign, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, result.length * bytesPerSample, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < result.length; i++) {
      const s = Math.max(-1, Math.min(1, result[i]));
      // Convert float to 16-bit PCM
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

// Convert AudioBuffer to MP3 Blob using lamejs
export function audioBufferToMp3(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const kbps = 128; // Standard quality

  const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
  const mp3Data: Int8Array[] = [];

  // Helper to convert float32 audio data to int16 for lamejs
  const floatTo16BitPCM = (input: Float32Array) => {
      const output = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++){
          const s = Math.max(-1, Math.min(1, input[i]));
          output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return output;
  };

  const left = floatTo16BitPCM(buffer.getChannelData(0));
  const right = channels > 1 ? floatTo16BitPCM(buffer.getChannelData(1)) : undefined;
  
  // Process in chunks to avoid blocking the main thread too much
  const sampleBlockSize = 1152; // multiple of 576
  for (let i = 0; i < left.length; i += sampleBlockSize) {
      const leftChunk = left.subarray(i, i + sampleBlockSize);
      const rightChunk = right ? right.subarray(i, i + sampleBlockSize) : undefined;
      
      const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
      }
  }

  const endBuf = mp3encoder.flush();
  if (endBuf.length > 0) {
      mp3Data.push(endBuf);
  }

  return new Blob(mp3Data, { type: 'audio/mp3' });
}