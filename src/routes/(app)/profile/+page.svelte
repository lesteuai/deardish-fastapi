<script lang="ts">
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
	<p class="muted">
		DearDish uses your profile to adapt restaurant-style dishes to your needs. It avoids your
		allergies, respects your dietary preferences, steers around ingredients that clash with your
		conditions, and folds your notes into every adaptation.
	</p>

	<form method="POST">
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

		<button class="button primary" type="submit">Save profile</button>
	</form>
</section>
