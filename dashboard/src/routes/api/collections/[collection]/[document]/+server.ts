import { json } from "@sveltejs/kit";
import { deleteDocument, fetchDocumentRecords } from "$lib/server/fluxiondb";

const parseOptionalNumber = (value: string | null) => {
	if (value === null) return undefined;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const parseOptionalBoolean = (value: string | null) => {
	if (value === null) return undefined;
	const normalised = value.trim().toLowerCase();
	if (["true", "1", "yes", "y"].includes(normalised)) return true;
	if (["false", "0", "no", "n"].includes(normalised)) return false;
	return undefined;
};

export const GET = async ({ params, url }) => {
	const from = parseOptionalNumber(url.searchParams.get("from"));
	const to = parseOptionalNumber(url.searchParams.get("to"));
	const limit = parseOptionalNumber(url.searchParams.get("limit"));
	const reverse = parseOptionalBoolean(url.searchParams.get("reverse"));

	try {
		const records = await fetchDocumentRecords({
			collection: params.collection,
			document: params.document,
			from,
			to,
			limit,
			reverse
		});

		return json({
			collection: params.collection,
			document: params.document,
			records
		});
	} catch (error) {
		console.error("Failed to fetch document records", error);
		return json({ error: "Failed to fetch document records" }, { status: 500 });
	}
};

export const DELETE = async ({ params }) => {
	try {
		await deleteDocument(params.collection, params.document);
		return json({ status: "ok" });
	} catch (error) {
		console.error("Failed to delete document", error);
		return json({ error: "Failed to delete document" }, { status: 500 });
	}
};
