import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';

const navigationMock = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => navigationMock);
const backendMock = vi.hoisted(() => ({
	backendJson: vi.fn(),
	throwBackendError: vi.fn((error: unknown): never => {
		throw error;
	})
}));
vi.mock('$lib/server/backend', () => backendMock);

import AdaptPage from './[dishId]/+page.svelte';
import { goto } from '$app/navigation';
import { load } from './[dishId]/+page.server';

const dish = {
	id: '123e4567-e89b-12d3-a456-426614174000',
	name: 'Miso Glazed Salmon',
	cuisine: 'Japanese',
	description: 'Sweet and savory roasted salmon.',
	ingredients: ['salmon', 'miso', 'mirin']
};

function streamResponse(chunks: Uint8Array[]) {
	let index = 0;
	return new Response(
		new ReadableStream<Uint8Array>({
			pull(controller) {
				if (index < chunks.length) {
					controller.enqueue(chunks[index]);
					index += 1;
				} else {
					controller.close();
				}
			}
		}),
		{ status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } }
	);
}

function encodeChunksAcrossUnicodeBoundary(value: string): Uint8Array[] {
	const bytes = new TextEncoder().encode(value);
	const boundary = bytes.findIndex((byte) => byte >= 0x80);
	return [bytes.slice(0, boundary + 1), bytes.slice(boundary + 1)];
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('adapt page', () => {
	it('renders the dish name and cuisine', () => {
		const { getByRole, getByText } = render(AdaptPage, {
			props: { data: { dish } } as never
		});

		expect(getByRole('heading', { name: 'Miso Glazed Salmon' })).toBeTruthy();
		expect(getByText('Japanese')).toBeTruthy();
		expect(getByText('Sweet and savory roasted salmon.')).toBeTruthy();
	});

	it('disables the save control before any streaming starts', () => {
		const { getByRole } = render(AdaptPage, {
			props: { data: { dish } } as never
		});

		const save = getByRole('button', { name: 'Save as meal' }) as HTMLButtonElement;
		expect(save.disabled).toBe(true);
	});

	it('offers an enabled adapt control', () => {
		const { getByRole } = render(AdaptPage, {
			props: { data: { dish } } as never
		});

		const adapt = getByRole('button', { name: 'Adapt this dish' }) as HTMLButtonElement;
		expect(adapt.disabled).toBe(false);
	});

	it('renders the adapted recipe heading inside a recipe-card container', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => streamResponse([new TextEncoder().encode('Adapted recipe body')]))
		);

		const { getByRole, findByRole } = render(AdaptPage, {
			props: { data: { dish } } as never
		});

		getByRole('button', { name: 'Adapt this dish' }).click();

		const heading = await findByRole('heading', { name: 'Your adapted recipe' });
		expect(heading.closest('.recipe-card')).not.toBeNull();
	});

	it('decodes split UTF-8 chunks and enables saving only after the stream completes', async () => {
		const content = '## Miso 鮭\n\nServe warm 🍣';
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			if (String(input) === '/api/adapt') {
				return streamResponse(encodeChunksAcrossUnicodeBoundary(content));
			}
			expect(input).toBe('/api/meals');
			expect(init?.method).toBe('POST');
			expect(JSON.parse(String(init?.body))).toMatchObject({ content, sourceDishId: dish.id });
			return new Response(JSON.stringify({ id: 'meal-1' }), { status: 201 });
		});
		vi.stubGlobal('fetch', fetchMock);

		const { getByRole, findByText } = render(AdaptPage, { props: { data: { dish } } as never });
		getByRole('button', { name: 'Adapt this dish' }).click();

		await findByText('Serve warm 🍣');
		const save = getByRole('button', { name: 'Save as meal' }) as HTMLButtonElement;
		expect(save.disabled).toBe(false);

		save.click();
		await waitFor(() => expect(goto).toHaveBeenCalledWith('/meals'));
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it.each([
		[401, 'Please sign in again.'],
		[502, 'The recipe could not be prepared: The adaptation service is unavailable.']
	])('shows an adaptation %i response and keeps saving disabled', async (status, message) => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				new Response(JSON.stringify({ error: 'The adaptation service is unavailable.' }), {
					status,
					headers: { 'content-type': 'application/json' }
				})
			)
		);

		const { getByRole, findByRole } = render(AdaptPage, { props: { data: { dish } } as never });
		getByRole('button', { name: 'Adapt this dish' }).click();

		expect((await findByRole('alert')).textContent).toContain(message);
		expect((getByRole('button', { name: 'Save as meal' }) as HTMLButtonElement).disabled).toBe(true);
	});

	it('shows an interrupted stream and prevents saving partial recipe text', async () => {
		let sentPartialChunk = false;
		const response = new Response(
			new ReadableStream<Uint8Array>({
				pull(controller) {
					if (sentPartialChunk) {
						controller.error(new Error('connection dropped'));
						return;
					}
					sentPartialChunk = true;
					controller.enqueue(new TextEncoder().encode('Partial recipe text'));
				}
			}),
			{ status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } }
		);
		vi.stubGlobal('fetch', vi.fn(async () => response));

		const { getByRole, findByText } = render(AdaptPage, { props: { data: { dish } } as never });
		getByRole('button', { name: 'Adapt this dish' }).click();

		await findByText('Partial recipe text');
		await waitFor(() =>
			expect(getByRole('alert').textContent).toContain('The recipe stream was interrupted.')
		);
		expect((getByRole('button', { name: 'Save as meal' }) as HTMLButtonElement).disabled).toBe(true);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('redirects anonymous adaptation-page visits before requesting the dish', async () => {
		let thrown: unknown;
		try {
			await (load as unknown as (event: unknown) => Promise<unknown>)({
				locals: { user: null },
				params: { dishId: dish.id }
			});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toMatchObject({ status: 303, location: '/auth/login' });
		expect(backendMock.backendJson).not.toHaveBeenCalled();
	});

	it('loads adaptation details through the backend bridge for signed-in users', async () => {
		backendMock.backendJson.mockResolvedValueOnce({ dish });
		const event = { locals: { user: { id: 'user-1' } }, params: { dishId: dish.id } };

		const result = await (
			load as unknown as (event: unknown) => Promise<{ dish: typeof dish }>
		)(event);

		expect(result).toEqual({ dish });
		expect(backendMock.backendJson).toHaveBeenCalledWith(event, `/api/dishes/${dish.id}`);
	});
});
