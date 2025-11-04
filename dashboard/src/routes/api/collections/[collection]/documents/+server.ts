import { json } from "@sveltejs/kit";
import { listDocuments } from "$lib/server/fluxiondb";

export const GET = async ({ params }) => {
	try {
		const documents = await listDocuments(params.collection);
		return json({ documents });
	} catch (error) {
		console.error("Failed to fetch documents", error);
		return json({ error: "Failed to fetch documents" }, { status: 500 });
	}
};
