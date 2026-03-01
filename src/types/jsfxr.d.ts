declare module 'jsfxr' {
  interface RiffWaveResult {
    dataURI: string;
    getAudio(): HTMLAudioElement;
  }
  type SynthDef = Record<string, number> | string;
  export const sfxr: {
    toWave(params: SynthDef): RiffWaveResult;
    toAudio(params: SynthDef): HTMLAudioElement;
    toBuffer(params: SynthDef): { buffer: ArrayBuffer };
    toWebAudio(params: SynthDef, ctx?: AudioContext): AudioBufferSourceNode;
    play(params: SynthDef): void;
    generate(algorithm: string, options?: Record<string, unknown>): Record<string, number>;
    b58encode(params: SynthDef): string;
    b58decode(encoded: string): Record<string, number>;
  };
  export const jsfxr: Record<string, unknown>;
  export default jsfxr;
}
