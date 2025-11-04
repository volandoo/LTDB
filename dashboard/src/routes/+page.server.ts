import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch }) => {
	const collectionsRes = await fetch("/api/collections");
	if (!collectionsRes.ok) {
		return { collections: [] };
	}
	const data = await collectionsRes.json();
	return { collections: data.collections ?? [] };
};
