import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    repoUrl: z.url(),
    order: z.number().int(),
    draft: z.boolean().default(false),
    bentoSpan: z.enum(['hero', 'wide', 'tall', 'normal']).default('normal'),
    coverVariant: z.enum(['base', 'alt']).default('base'),
    cover: z.string().optional(),
    deepwikiUrl: z.url().optional(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, blog };
