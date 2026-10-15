import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function buildDatabaseUrl() {
	const { PGUSER, PGPASSWORD, PGHOST, PGDATABASE } = process.env;
	return `postgres://${PGUSER}:${encodeURIComponent(PGPASSWORD ?? '')}@${PGHOST}/${PGDATABASE}`;
}

const client = postgres(buildDatabaseUrl(), {
	ssl: 'require',
	max: 10,
	prepare: false,
	idle_timeout: 20,
	connect_timeout: 10
});

export const db = drizzle(client, { schema });
