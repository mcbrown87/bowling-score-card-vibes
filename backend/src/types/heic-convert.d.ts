declare module 'heic-convert' {
  interface HeicConvertOptions {
    buffer: ArrayBuffer | Buffer | Uint8Array;
    format: 'JPEG' | 'PNG';
    quality?: number;
  }

  function heicConvert(options: HeicConvertOptions): Promise<ArrayBuffer | Buffer>;
  export default heicConvert;
}
