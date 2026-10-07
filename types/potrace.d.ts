declare module "potrace" {
  // Only the parts lib/svg/trace.ts uses.
  export class Potrace {
    constructor(options?: { threshold?: number; turdSize?: number; optTolerance?: number; color?: string });
    loadImage(target: unknown, callback: (err: Error | null) => void): void;
    getPathTag(fillColor?: string): string;
  }
}
