import type { AuthUser } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			user: AuthUser | null;
		}
	}
}

export {};
