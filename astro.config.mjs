// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  redirects: {
    '/writing': '/notes',
    '/writing/[slug]': '/notes/[slug]',
    '/a-complete-history': '/an-incomplete-history',
    '/transmissions': '/radio',
  },
});
