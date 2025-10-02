declare module 'jsdom' {
  interface JSDOMOptions {
    url?: string
    [key: string]: unknown
  }

  export class JSDOM {
    constructor(html?: string, options?: JSDOMOptions)
    window: Window & typeof globalThis
  }
}
