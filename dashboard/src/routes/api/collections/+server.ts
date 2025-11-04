import { json } from "@sveltejs/kit";
import { listCollections } from "$lib/server/fluxiondb";

export const GET = async () => {
	try {
		const collections = await listCollections();
		return json({ collections });
	} catch (error) {
		console.error("Failed to fetch collections", error);
		return json({ error: "Failed to fetch collections" }, { status: 500 });
	}
};
