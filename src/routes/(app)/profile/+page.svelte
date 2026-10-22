<script lang="ts">
	import Button from '$lib/ui/Button.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const values = $derived(
		form?.values ?? {
			conditions: data.profile.conditions,
			allergies: data.profile.allergies,
			dietaryPreferences: data.profile.dietaryPreferences,
			notes: data.profile.notes
		}
	);
</script>

<section>
	<h1>Health profile</h1>
	<p class="muted account-email">Email: {data.email}</p>
	<p class="muted">
		DearDish uses your profile to adapt restaurant-style dishes to your needs. It avoids your
		allergies, respects your dietary preferences, steers around ingredients that clash with your
		conditions, and folds your notes into every adaptation.
	</p>

	<div class="card">
		<form method="POST">
			{#if form?.saved}
				<p class="success" role="status" aria-live="polite">Profile saved.</p>
			{/if}
			{#if form?.errors?.form}
				<p class="error">{form.errors.form}</p>
			{/if}

			<label for="conditions">Conditions</label>
			<input id="conditions" name="conditions" value={values.conditions} />
			{#if form?.errors?.conditions}
				<p class="error">{form.errors.conditions}</p>
			{/if}

			<label for="allergies">Allergies</label>
			<input id="allergies" name="allergies" value={values.allergies} />
			{#if form?.errors?.allergies}
				<p class="error">{form.errors.allergies}</p>
			{/if}

			<label for="dietaryPreferences">Dietary preferences</label>
			<input id="dietaryPreferences" name="dietaryPreferences" value={values.dietaryPreferences} />
			{#if form?.errors?.dietaryPreferences}
				<p class="error">{form.errors.dietaryPreferences}</p>
			{/if}

			<label for="notes">Notes</label>
			<textarea id="notes" name="notes" rows="5">{values.notes}</textarea>
			{#if form?.errors?.notes}
				<p class="error">{form.errors.notes}</p>
			{/if}

			<Button type="submit" variant="primary">Save profile</Button>
		</form>
	</div>
</section>

<style>
	form {
		border-left: 4px solid var(--sun);
		padding-left: 1rem;
	}

	form label {
		color: var(--leaf-dark);
	}

	.account-email {
		margin-top: -0.5rem;
	}

	.success {
		color: var(--leaf-dark);
		font-weight: 700;
	}
</style>
