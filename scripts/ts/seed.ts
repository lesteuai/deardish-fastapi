import { inArray } from 'drizzle-orm';
import { db } from '../../src/lib/server/db';
import { dishes, images } from '../../src/lib/server/db/schema';

export const seedImages = [
	{ id: '10000000-0000-4000-8000-000000000001', location: '/assets/dishes/tuscan-ribollita.jpg', type: 'file' },
	{ id: '10000000-0000-4000-8000-000000000002', location: '/assets/dishes/coq-au-vin.jpg', type: 'file' },
	{ id: '10000000-0000-4000-8000-000000000003', location: '/assets/dishes/miso-glazed-salmon.jpg', type: 'file' },
	{ id: '10000000-0000-4000-8000-000000000004', location: '/assets/dishes/chana-masala.jpg', type: 'file' },
	{ id: '10000000-0000-4000-8000-000000000005', location: '/assets/dishes/baja-fish-tacos.jpg', type: 'file' },
	{ id: '10000000-0000-4000-8000-000000000006', location: '/assets/dishes/thai-green-curry.jpg', type: 'file' }
];

export const seedDishes = [
	{
		name: 'Tuscan Ribollita',
		imageId: seedImages[0].id,
		cuisine: 'Italian',
		content: `## Tuscan Ribollita\n\n**Serves 4 | Prep 15 minutes | Cook 35 minutes**\n\n### Ingredients\n- 2 tbsp extra-virgin olive oil, plus more to serve\n- 1 yellow onion, diced\n- 1 carrot and 2 celery stalks, diced\n- 2 garlic cloves, minced\n- 1 rosemary sprig\n- 1 (400 g) can crushed tomatoes\n- 500 ml vegetable stock\n- 1 (400 g) can cannellini beans, drained and rinsed\n- 250 g lacinato kale, chopped\n- 150 g stale sourdough, torn into chunks\n- 1 tbsp red-wine vinegar, salt and black pepper\n\n### Method\n1. Warm the oil in a heavy pot. Cook onion, carrot, and celery with a pinch of salt for 12-15 minutes until soft. Add garlic and rosemary; cook for 1 minute.\n2. Stir in tomatoes, stock, and beans. Bring to a simmer, add kale, cover, and cook for 10 minutes.\n3. Stir in bread and simmer until softened and the stew is thick, about 5 minutes. Stir in vinegar, season to taste, and serve with olive oil.\n\nRecipe reference: https://www.bbcgoodfood.com/recipes/tuscan-style-ribollita`,
		description:
			'A hearty Tuscan bread and bean stew simmered with kale and tomatoes, finished with a swirl of olive oil.',
		ingredients: [
			'cannellini beans',
			'lacinato kale',
			'stale sourdough bread',
			'crushed tomatoes',
			'carrots',
			'celery',
			'yellow onion',
			'garlic',
			'extra virgin olive oil',
			'fresh rosemary'
		]
	},
	{
		name: 'Coq au Vin',
		imageId: seedImages[1].id,
		cuisine: 'French',
		content: `## Coq au Vin\n\n**Serves 4 | Prep 25 minutes | Cook about 1 hour 20 minutes**\n\n### Ingredients\n- 8 chicken thighs, patted dry\n- 100 g bacon lardons\n- 12 pearl onions, peeled\n- 2 carrots, sliced; 2 garlic cloves, minced\n- 250 g cremini mushrooms, halved\n- 2 tbsp flour and 25 g unsalted butter\n- 600 ml red wine and 150 ml chicken stock\n- 3 thyme sprigs, 2 bay leaves, salt and black pepper\n- 2 tbsp olive oil\n\n### Method\n1. Heat 1 tbsp oil in a heavy casserole and brown the bacon. Remove, then brown the onions and chicken in batches, adding more oil as needed. Set aside.\n2. Cook carrots and garlic briefly. Stir in flour and butter, then gradually pour in wine and stock, scraping up browned bits. Add thyme, bay, bacon, onions, and chicken.\n3. Cover and simmer gently for 50-60 minutes, until the chicken is cooked through and tender.\n4. Meanwhile, sauté mushrooms in a little oil until golden. Stir them into the casserole for the final 10 minutes. Season and serve.\n\nRecipe reference: https://www.bbcgoodfood.com/recipes/coq-au-vin`,
		description:
			'Chicken braised low and slow in red wine with bacon lardons, mushrooms, and pearl onions.',
		ingredients: [
			'chicken thighs',
			'red wine',
			'bacon lardons',
			'pearl onions',
			'cremini mushrooms',
			'carrots',
			'garlic',
			'fresh thyme',
			'unsalted butter',
			'flour'
		]
	},
	{
		name: 'Miso Glazed Salmon',
		imageId: seedImages[2].id,
		cuisine: 'Japanese',
		content: `## Miso-Glazed Salmon\n\n**Serves 4 | Prep 10 minutes | Cook 5-8 minutes**\n\n### Ingredients\n- 4 salmon fillets, about 150 g each\n- 3 tbsp white miso\n- 2 tbsp mirin\n- 1 tbsp brown sugar\n- 1 tsp finely grated fresh ginger\n- 1 tbsp neutral oil\n- 2 scallions, thinly sliced; toasted sesame seeds, to finish\n- 300 g sushi rice, cooked to package directions\n\n### Method\n1. Whisk miso, mirin, brown sugar, ginger, and oil. Coat the salmon and marinate for 30 minutes, or cook immediately.\n2. Heat the broiler to high. Wipe excess marinade from the fish and arrange on a foil-lined tray. Broil about 5-8 minutes, until browned and cooked to your preferred doneness.\n3. Serve over rice with scallions and sesame seeds.\n\nRecipe reference: https://www.seriouseats.com/miso-glazed-salmon-in-the-toaster-oven-recipe`,
		description:
			'Salmon fillets glazed with sweet white miso and mirin, roasted until caramelized and served over rice.',
		ingredients: [
			'salmon fillets',
			'white miso paste',
			'mirin',
			'brown sugar',
			'fresh ginger',
			'scallions',
			'toasted sesame seeds',
			'sushi rice'
		]
	},
	{
		name: 'Chana Masala',
		imageId: seedImages[3].id,
		cuisine: 'Indian',
		content: `## Chana Masala\n\n**Serves 4-6 | Prep 10 minutes | Cook 45 minutes**\n\n### Ingredients\n- 2 tbsp neutral oil or ghee\n- 1 large yellow onion, finely diced\n- 4 garlic cloves, 1-inch piece fresh ginger, and 1-2 green chilies\n- 2 tsp whole cumin seeds, 2 tsp ground coriander, 1/2 tsp turmeric\n- 1 1/2 tsp garam masala, divided\n- 1 (400 g) can whole tomatoes\n- 2 (400 g) cans chickpeas, drained and rinsed\n- 1 tbsp lemon juice, 1/2 cup chopped cilantro, salt\n\n### Method\n1. Pound or blend garlic, ginger, chilies, lemon juice, and a pinch of salt into a paste.\n2. Heat oil in a saucepan. Toast cumin seeds until fragrant, add onion, and cook until deeply browned, about 10 minutes. Add a splash of water as needed to loosen browned bits.\n3. Add the aromatics paste, coriander, turmeric, and 1 tsp garam masala. Stir for 30 seconds. Add tomatoes, crush them, then stir in chickpeas, cilantro, and 1/2 cup water.\n4. Simmer partially covered for about 30 minutes, stirring occasionally, until thick. Finish with remaining garam masala and lemon juice; season and serve with rice or naan.\n\nRecipe reference: https://www.seriouseats.com/channa-masala-recipe`,
		description:
			'Tender chickpeas in a spiced tomato and onion masala, brightened with garam masala and fresh cilantro.',
		ingredients: [
			'chickpeas',
			'yellow onion',
			'tomatoes',
			'fresh ginger',
			'garlic',
			'garam masala',
			'ground cumin',
			'ground coriander',
			'turmeric',
			'green chili'
		]
	},
	{
		name: 'Baja Fish Tacos',
		imageId: seedImages[4].id,
		cuisine: 'Mexican',
		content: `## Baja Fish Tacos\n\n**Makes 8 tacos | Prep 20 minutes | Cook 15 minutes**\n\n### Ingredients\n- 700 g firm white fish, cut into strips\n- 8 corn tortillas\n- 1/2 small cabbage, finely shredded\n- 1/2 red onion, thinly sliced; 1 avocado, sliced\n- 2 tbsp lime juice, plus wedges to serve\n- 1/2 cup chipotle mayonnaise\n- 1/2 cup flour, 1 tsp ground cumin, 1 tsp smoked paprika\n- 180 ml cold sparkling water, neutral oil for frying\n- Cilantro, salt, and black pepper\n\n### Method\n1. Toss cabbage with lime juice and a pinch of salt. Set aside. Pat fish dry and season with salt, pepper, cumin, and paprika.\n2. Whisk flour with sparkling water and a pinch of salt to make a smooth, pourable batter. Heat 2-3 cm oil in a deep pan to 175-190°C.\n3. Dip fish in batter and fry in batches for 3-5 minutes, turning once, until crisp and cooked through. Drain on a rack or paper towels.\n4. Warm tortillas. Fill with fish, cabbage, red onion, avocado, chipotle mayonnaise, and cilantro. Serve with lime.\n\nRecipe reference: https://www.seriouseats.com/baja-fish-tacos-recipe-8682282`,
		description:
			'Lightly spiced grilled fish tucked into warm corn tortillas with cabbage slaw and chipotle crema.',
		ingredients: [
			'white fish fillets',
			'corn tortillas',
			'shredded cabbage',
			'lime',
			'fresh cilantro',
			'red onion',
			'avocado',
			'chipotle mayo',
			'ground cumin',
			'smoked paprika'
		]
	},
	{
		name: 'Thai Green Curry',
		imageId: seedImages[5].id,
		cuisine: 'Thai',
		content: `## Thai Green Curry\n\n**Serves 4 | Prep 10 minutes | Cook 20 minutes**\n\n### Ingredients\n- 450 g chicken breast, cut into bite-size pieces\n- 1 tbsp neutral oil and 2 tbsp Thai green curry paste\n- 400 ml coconut milk\n- 1 red bell pepper, sliced; 150 g bamboo shoots, drained\n- 2 kaffir lime leaves, torn\n- 1 tbsp fish sauce and 1 tsp palm sugar, to taste\n- A handful of Thai basil leaves\n- Steamed jasmine rice and lime wedges, to serve\n\n### Method\n1. Heat oil in a wok over medium-high heat. Fry curry paste for 1-2 minutes until fragrant.\n2. Add chicken and stir to coat. Cook until lightly browned, then add coconut milk and lime leaves. Bring to a gentle simmer.\n3. Simmer 8-10 minutes, until chicken is cooked through. Add bell pepper and bamboo shoots for the final 3-4 minutes.\n4. Season with fish sauce and palm sugar. Stir in basil and serve with rice and lime.\n\nRecipe reference: https://www.bbc.co.uk/food/recipes/thaigreenchickencurr_92440`,
		description:
			'A fragrant coconut curry with chicken, bamboo shoots, and Thai basil, balanced with fish sauce and lime.',
		ingredients: [
			'chicken breast',
			'green curry paste',
			'coconut milk',
			'Thai basil',
			'bamboo shoots',
			'red bell pepper',
			'fish sauce',
			'palm sugar',
			'kaffir lime leaves'
		]
	}
];

export async function seed() {
	const names = seedDishes.map((dish) => dish.name);
	await db.delete(dishes).where(inArray(dishes.name, names));
	await db
		.insert(images)
		.values(seedImages)
		.onConflictDoNothing({ target: images.id });
	await db.insert(dishes).values(seedDishes);
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
	await seed();
	console.log(`Seeded ${seedDishes.length} dishes.`);
	process.exit(0);
}
