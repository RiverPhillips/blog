# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Astro-based blog for riverphillips.dev, deployed on Vercel with SSR (serverless) mode. The project is built from the Astro blog template and includes MDX support, sitemap generation, RSS feeds, and Vercel analytics integration.

## Development Commands

All commands are run from the project root:

- `npm run dev` - Start local development server at localhost:4321
- `npm run build` - Type-check with `astro check` and build to ./dist/
- `npm run preview` - Preview production build locally
- `npm run astro -- --help` - Get Astro CLI help
- `npm run mdlint` - Lint markdown files

## Architecture

### Content Management

Blog posts are managed through Astro's Content Collections system:

- Blog posts live in `src/content/blog/` as Markdown or MDX files
- Content schema is defined in `src/content/config.ts` with Zod validation
- Required frontmatter: `title`, `description`, `pubDate`, `heroImage`
- Optional frontmatter: `updatedDate`
- Posts are retrieved using `getCollection('blog')` from `astro:content`
- Note: Astro 5 no longer supports custom validation with `image().refine()` - basic image() schema only

### Routing

- File-based routing via `src/pages/`
- Blog posts use dynamic routing: `src/pages/blog/[...slug].astro`
- Individual posts are pre-rendered at build time (`prerender: true`)
- `getStaticPaths()` generates routes from the blog collection

### TypeScript Path Aliases

Configured in `tsconfig.json`:
- `@components/*` → `src/components/*`
- `@layouts/*` → `src/layouts/*`

### Deployment

- Output mode: `server` (SSR via Vercel adapter)
- Vercel Web Analytics and Speed Insights are enabled
- Site URL configured: https://www.riverphillips.dev/

### Global Configuration

Site metadata is centralized in `src/consts.ts`:
- `SITE_TITLE`: "River Phillips"
- `SITE_DESCRIPTION`: "My blog"
