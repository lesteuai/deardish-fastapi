import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ProfilePage from './+page.svelte';

const profile = {
	conditions: 'Diabetes',
	allergies: 'Peanuts',
	dietaryPreferences: 'Vegetarian',
	notes: 'Low salt please'
};

describe('profile page', () => {
	it('prefills the form with the stored profile values', () => {
		const { getByLabelText } = render(ProfilePage, {
			props: { data: { profile }, form: undefined } as never
		});

		expect((getByLabelText('Conditions') as HTMLInputElement).value).toBe('Diabetes');
		expect((getByLabelText('Allergies') as HTMLInputElement).value).toBe('Peanuts');
		expect((getByLabelText('Dietary preferences') as HTMLInputElement).value).toBe('Vegetarian');
		expect((getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('Low salt please');
	});

	it('renders visible field errors from the form prop', () => {
		const form = {
			errors: {
				conditions: 'Conditions must be 200 characters or fewer',
				notes: 'Notes must be 2000 characters or fewer'
			},
			values: { ...profile, conditions: 'over-limit text' }
		};

		const { getByText, getByLabelText } = render(ProfilePage, {
			props: { data: { profile }, form } as never
		});

		expect(getByText('Conditions must be 200 characters or fewer')).toBeTruthy();
		expect(getByText('Notes must be 2000 characters or fewer')).toBeTruthy();
		expect((getByLabelText('Conditions') as HTMLInputElement).value).toBe('over-limit text');
	});

	it('wraps the profile form in a card container', () => {
		const { getByLabelText } = render(ProfilePage, {
			props: { data: { profile }, form: undefined } as never
		});

		const form = getByLabelText('Conditions').closest('form');
		expect(form).not.toBeNull();
		expect(form!.closest('.card')).not.toBeNull();
	});
});
