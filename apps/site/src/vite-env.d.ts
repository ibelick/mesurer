/// <reference types="vite/client" />

interface Window {
  __MESURER_PRERENDER__?: boolean;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}
