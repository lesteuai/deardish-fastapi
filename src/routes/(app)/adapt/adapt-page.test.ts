import { describe, it, expect, vi } from 'vitest';
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
});
