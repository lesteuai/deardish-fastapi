/// <reference types="vitest/config" />
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

const unavailableMessage = JSON.stringify({
	error: 'DearDish services are temporarily unavailable. Please try again shortly.'
});

function backendProxy(target: string): ProxyOptions {
	return {
		target,
		configure(proxy) {
			proxy.on('error', (_error, _request, response) => {
				if ('writeHead' in response && !response.headersSent && !response.writableEnded) {
					response
						.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
						.end(unavailableMessage);
				}
			});
		}
	};
}

export default defineConfig(({ mode }) => {
	const { BACKEND_URL } = loadEnv(mode, process.cwd(), ['BACKEND_URL']);
	const backendTarget = BACKEND_URL || 'http://127.0.0.1:8000';
	return {
		plugins: [sveltekit(), svelteTesting()],
		server: { proxy: { '/api': backendProxy(backendTarget) } },
		preview: { proxy: { '/api': backendProxy(backendTarget) } },
		test: {
			environment: 'jsdom',
			include: ['src/**/*.test.ts'],
			passWithNoTests: true
		}
	};
});
