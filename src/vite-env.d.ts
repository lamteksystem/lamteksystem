/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.md?raw' {
  const content: string
  export default content
}

/** Experimental Barcode Detection API (Chrome / Edge). */
interface BarcodeDetectorOptions {
  formats?: string[]
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions)
  detect(source: ImageBitmapSource): Promise<{ rawValue?: string }[]>
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector
}
