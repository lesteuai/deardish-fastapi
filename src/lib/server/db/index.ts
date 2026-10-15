import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '$env/dynamic/private';
import postgres from 'postgres';
import * as schema from './schema';

export function buildDatabaseUrl() {
	const envImport = !process.env.PGUSER ? env : process.env;
	const { PGUSER, PGPASSWORD, PGHOST, PGDATABASE } = envImport;
	console.log(PGUSER, PGPASSWORD, PGHOST, PGDATABASE)
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
