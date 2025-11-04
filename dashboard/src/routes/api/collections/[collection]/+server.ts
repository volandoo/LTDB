import { json } from "@sveltejs/kit";
import { deleteCollection } from "$lib/server/fluxiondb";

export const DELETE = async ({ params }) => {
	try {
		await deleteCollection(params.collection);
		return json({ status: "ok" });
	} catch (error) {
		console.error("Failed to delete collection", error);
		return json({ error: "Failed to delete collection" }, { status: 500 });
	}
};
