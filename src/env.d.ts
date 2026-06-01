/// <reference types="astro/client" />

// CSS Studio (dev-only, loaded via a Vite DEV-gated dynamic import in
// BaseLayout.astro). The package ships no type declarations, so declare the
// one entry point we use.
declare module 'cssstudio' {
  export function startStudio(): void;
}
