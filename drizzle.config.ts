import { defineConfig } from 'drizzle-kit';
import { buildDatabaseUrl } from './src/lib/server/db';

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dbCredentials: { url: `${buildDatabaseUrl()}?sslmode=require` }
});
