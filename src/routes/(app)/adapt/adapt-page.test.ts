import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

import AdaptPage from './[dishId]/+page.svelte';

const dish = {
	id: '123e4567-e89b-12d3-a456-426614174000',
	name: 'Miso Glazed Salmon',
	cuisine: 'Japanese',
	description: 'Sweet and savory roasted salmon.',
	ingredients: ['salmon', 'miso', 'mirin']
};

function streamingResponse(chunks: string[]) {
	const encoder = new TextEncoder();
	let index = 0;
	return {
		ok: true,
		status: 200,
		body: {
			getReader() {
				return {
					read() {
						if (index < chunks.length) {
							const value = encoder.encode(chunks[index]);
							index += 1;
							return Promise.resolve({ done: false, value });
						}
						return Promise.resolve({ done: true, value: undefined });
					}
				};
			}
		}
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
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
			vi.fn(async () => streamingResponse(['Adapted recipe body']))
		);

		const { getByRole, findByRole } = render(AdaptPage, {
			props: { data: { dish } } as never
		});

		getByRole('button', { name: 'Adapt this dish' }).click();

		const heading = await findByRole('heading', { name: 'Your adapted recipe' });
		expect(heading.closest('.recipe-card')).not.toBeNull();
	});
});
