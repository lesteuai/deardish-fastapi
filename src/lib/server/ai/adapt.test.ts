import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { streamTextMock } = vi.hoisted(() => ({ streamTextMock: vi.fn() }));

vi.mock('ai', async (importOriginal) => {
	const actual = await importOriginal<typeof import('ai')>();
	return { ...actual, streamText: streamTextMock };
});

// `$env/dynamic/private` is snapshotted from `.env` when Vite configures, so
// `vi.stubEnv` cannot reach it. Back it with `process.env` so stubs apply.
vi.mock('$env/dynamic/private', () => ({ env: process.env }));

import { createAdaptationResponse } from './adapt';
import type { Dish, HealthProfile } from './prompt';

type Part =
	| { type: 'text-start'; id: string }
	| { type: 'text-delta'; id: string; text: string }
	| { type: 'text-end'; id: string }
	| { type: 'error'; error: unknown };

function streamOf(parts: Part[]): ReadableStream<Part> {
	return new ReadableStream<Part>({
		start(controller) {
			for (const part of parts) controller.enqueue(part);
			controller.close();
		}
	});
}

function failingStream(): ReadableStream<Part> {
	return new ReadableStream<Part>({
		start(controller) {
			controller.error(new Error('provider connection dropped'));
		}
	});
}

const dish: Dish = {
	name: 'Paneer Butter Masala',
	cuisine: 'Indian',
	description: 'A creamy tomato curry with cubes of paneer.',
	ingredients: ['paneer', 'tomatoes', 'cream', 'butter', 'garam masala']
};

const profile: HealthProfile = {
	conditions: '',
	allergies: '',
	dietaryPreferences: '',
	notes: ''
};

beforeEach(() => {
	vi.stubEnv('AI_API_KEY', 'test-api-key');
	vi.stubEnv('AI_MODEL', 'test/model');
});

afterEach(() => {
	vi.unstubAllEnvs();
	streamTextMock.mockReset();
});

describe('createAdaptationResponse', () => {
	it('returns a 200 text/plain stream whose body includes the first buffered chunk', async () => {
		const parts: Part[] = [
			{ type: 'text-start', id: '1' },
			{ type: 'text-delta', id: '1', text: 'Hello ' },
			{ type: 'text-delta', id: '1', text: 'world' },
			{ type: 'text-end', id: '1' }
		];
		streamTextMock.mockReturnValue({ stream: streamOf(parts) });

		const response = await createAdaptationResponse(dish, profile);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/plain');

		const body = await response.text();

		expect(body).toBe('Hello world');
		expect(body).toContain('Hello ');
	});

	it('passes separate system instructions and user prompt to the provider', async () => {
		streamTextMock.mockReturnValue({
			stream: streamOf([{ type: 'text-delta', id: '1', text: 'ok' }])
		});

		await createAdaptationResponse(dish, profile);

		expect(streamTextMock).toHaveBeenCalledTimes(1);
		const args = streamTextMock.mock.calls[0][0] as {
			instructions?: string;
			prompt?: string;
		};
		expect(args.instructions).toContain('DearDish');
		expect(args.prompt).toContain(dish.name);
		expect(args.prompt).not.toContain('DearDish');
	});

	it('returns a 502 JSON error when the provider errors before the first text chunk', async () => {
		streamTextMock.mockReturnValue({
			stream: streamOf([
				{ type: 'error', error: new Error('provider down') },
				{ type: 'text-delta', id: '1', text: 'never reached' }
			])
		});

		const response = await createAdaptationResponse(dish, profile);

		expect(response.status).toBe(502);
		expect(response.headers.get('content-type')).toContain('application/json');

		const json = (await response.json()) as { error?: unknown };
		expect(json.error).toBeTruthy();
	});

	it('returns a 502 JSON error when the stream rejects before any text', async () => {
		streamTextMock.mockReturnValue({ stream: failingStream() });

		const response = await createAdaptationResponse(dish, profile);

		expect(response.status).toBe(502);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(((await response.json()) as { error?: unknown }).error).toBeTruthy();
	});

	it('returns a 502 JSON error when the stream ends with zero text deltas', async () => {
		const parts: Part[] = [
			{ type: 'text-start', id: '1' },
			{ type: 'text-end', id: '1' }
		];
		streamTextMock.mockReturnValue({ stream: streamOf(parts) });

		const response = await createAdaptationResponse(dish, profile);

		expect(response.status).toBe(502);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(((await response.json()) as { error?: unknown }).error).toBeTruthy();
	});

	it('returns a 502 JSON error when the AI configuration is missing', async () => {
		vi.stubEnv('AI_API_KEY', '');
		vi.stubEnv('AI_MODEL', '');

		const response = await createAdaptationResponse(dish, profile);

		expect(response.status).toBe(502);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(((await response.json()) as { error?: unknown }).error).toBeTruthy();
		expect(streamTextMock).not.toHaveBeenCalled();
	});
});
