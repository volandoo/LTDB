import { env } from "$env/dynamic/private";
import { createRequire } from "module";
import type FluxionDBClientType from "@volandoo/fluxiondb-client/dist/client.js";
import type {
	FetchRecordsParams as FluxionDBFetchRecordsParams,
	FetchLatestRecordsParams as FluxionDBFetchLatestRecordsParams
} from "@volandoo/fluxiondb-client";

const require = createRequire(import.meta.url);
const { default: FluxionDBClient } = require("@volandoo/fluxiondb-client/dist/client.js") as {
	default: typeof FluxionDBClientType;
};

const wsUrl = env.FLUXIONDB_WS_URL ?? env._WS_URL ?? "ws://localhost:8080";
const apiKey = env.FLUXIONDB_API_KEY ?? env._API_KEY;

type ClientInstance = InstanceType<typeof FluxionDBClient>;

let clientPromise: Promise<ClientInstance> | null = null;

async function createClient(): Promise<ClientInstance> {
	if (!apiKey) {
		throw new Error("FLUXIONDB_API_KEY environment variable is not set");
	}

	const client = new FluxionDBClient({ url: wsUrl, apiKey });
	await client.connect();
	return client;
}

async function getClient(): Promise<ClientInstance> {
	if (!clientPromise) {
		clientPromise = (async () => {
			try {
				return await createClient();
			} catch (error) {
				clientPromise = null;
				throw error;
			}
		})();
	}
	return clientPromise;
}

export async function listCollections(): Promise<string[]> {
	const client = await getClient();
	return client.fetchCollections();
}

export async function listDocuments(collection: string): Promise<string[]> {
	const client = await getClient();

	const params: FluxionDBFetchLatestRecordsParams = {
		collection,
		ts: Math.floor(Date.now() / 1000)
	};

	const response = await client.fetchLatestDocumentRecords(params);
	return Object.keys(response ?? {}).sort();
}

export async function deleteCollection(collection: string): Promise<void> {
	const client = await getClient();
	await client.deleteCollection({ collection });
}

interface FetchDocumentParams {
	collection: string;
	document: string;
	from?: number;
	to?: number;
	limit?: number;
	reverse?: boolean;
}

export async function fetchDocumentRecords({
	collection,
	document,
	from,
	to,
	limit,
	reverse
}: FetchDocumentParams) {
	const client = await getClient();

	const nowSeconds = Math.floor(Date.now() / 1000);
	const payload: FluxionDBFetchRecordsParams = {
		collection,
		key: document,
		from: from ?? 0,
		to: to ?? nowSeconds
	};

	if (typeof limit === "number") {
		payload.limit = limit;
	}
	if (typeof reverse === "boolean") {
		payload.reverse = reverse;
	}

	return client.fetchDocument(payload);
}

export async function deleteDocument(collection: string, document: string): Promise<void> {
	const client = await getClient();
	await client.deleteDocument({ collection, key: document });
}
