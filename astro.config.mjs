import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from "@astrojs/vercel/serverless";
import sentry from "@sentry/astro";

// https://astro.build/config
export default defineConfig({
	site: 'https://example.com',
	integrations: [mdx(), sitemap(), sentry({
		dsn: "https://889623d33b0d38d17cdeea2ab58f45da@o4504895664488448.ingest.sentry.io/4505924641423360",
		sourceMapsUploadOptions: {
			project: "blog",
			authToken: process.env.SENTRY_AUTH_TOKEN,
		}
	})],
	output: "hybrid",
	adapter: vercel()
});
