import { defineConfig } from 'drizzle-kit';

const { PGUSER, PGPASSWORD, PGHOST, PGDATABASE } = process.env;
const databaseUrl = `postgres://${PGUSER}:${encodeURIComponent(PGPASSWORD ?? '')}@${PGHOST}/${PGDATABASE}`;

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dbCredentials: { url: `${databaseUrl}?sslmode=require` }
});
