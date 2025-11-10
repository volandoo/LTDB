# Getting Started

Install the package and establish a WebSocket session using your server URL and API key:

```ts
import FluxionDBClient from "@volandoo/fluxiondb-client";

const client = new FluxionDBClient({
    url: "ws://localhost:8080",
    apiKey: process.env.FLUXIONDB_API_KEY ?? "your-api-key",
});

await client.connect();
```

Every method automatically calls `connect()` if the socket is closed, but invoking it up front ensures the connection (and automatic reconnection logic) is ready before issuing database commands.

## client.connect()

Establishes the WebSocket connection. Call once during startup or before your first request.

```ts
await client.connect();
```

## client.close()

Stops automatic reconnection and closes the underlying socket. Use it during shutdown or test teardown.

```ts
client.close();
```

## client.fetchCollections()

Returns the list of collection names currently stored in FluxionDB.

```ts
const collections = await client.fetchCollections();
console.log(collections);
```

## client.deleteCollection(params)

Deletes an entire collection and its documents.

```ts
await client.deleteCollection({ col: "temperature" });
```

## client.fetchLatestRecords(params)

Retrieves the most recent record per document within a collection. Optionally scope by document ID and lower timestamp bound.

```ts
const latest = await client.fetchLatestRecords({
    col: "temperature",
    ts: Date.now(),
    doc: "device-a", // optional
    from: Date.now() - 3600_000, // optional
});
console.log(latest["device-a"].data);
```

## client.insertMultipleRecords(items)

Bulk insert records (each record targets one document in a collection).

```ts
await client.insertMultipleRecords([
    {
        col: "temperature",
        doc: "device-a",
        ts: Date.now(),
        data: JSON.stringify({ value: 22.5 }),
    },
    {
        col: "temperature",
        doc: "device-b",
        ts: Date.now(),
        data: JSON.stringify({ value: 21.9 }),
    },
]);
```

## client.insertSingleRecord(item)

Convenience wrapper that inserts a single record.

```ts
await client.insertSingleRecord({
    col: "temperature",
    doc: "device-a",
    ts: Date.now(),
    data: JSON.stringify({ value: 22.5 }),
});
```

## client.fetchDocument(params)

Fetches records for a specific document using time window filters (and optional limit/reverse).

```ts
const history = await client.fetchDocument({
    col: "temperature",
    doc: "device-a",
    from: Date.now() - 3600_000,
    to: Date.now(),
    limit: 100,
    reverse: true,
});
```

## client.deleteDocument(params)

Removes an entire document (and its records) from a collection.

```ts
await client.deleteDocument({ col: "temperature", doc: "device-a" });
```

## client.deleteRecord(params)

Deletes a single record identified by timestamp.

```ts
await client.deleteRecord({
    col: "temperature",
    doc: "device-a",
    ts: 1717610400000,
});
```

## client.deleteMultipleRecords(params)

Deletes multiple records across one or more documents.

```ts
await client.deleteMultipleRecords([
    { col: "temperature", doc: "device-a", ts: 1717610400000 },
    { col: "temperature", doc: "device-b", ts: 1717610460000 },
]);
```

## client.deleteRecordsRange(params)

Deletes all records for a document within a timestamp range.

```ts
await client.deleteRecordsRange({
    col: "temperature",
    doc: "device-a",
    fromTs: Date.now() - 3600_000,
    toTs: Date.now(),
});
```

## client.setValue(params)

Stores a key/value pair inside the collection-scoped KV store.

```ts
await client.setValue({
    col: "metadata",
    key: "device-a:location",
    value: "warehouse-1",
});
```

## client.getValue(params)

Retrieves a single key/value entry.

```ts
const location = await client.getValue({
    col: "metadata",
    key: "device-a:location",
});
console.log(location);
```

## client.getKeys(params)

Lists all keys in a KV collection.

```ts
const keys = await client.getKeys({ col: "metadata" });
```

## client.getValues(params)

Returns a map of all key/value pairs in a KV collection.

```ts
const values = await client.getValues({ col: "metadata" });
console.log(values["device-a:location"]);
```

## client.deleteValue(params)

Removes a key/value entry.

```ts
await client.deleteValue({
    col: "metadata",
    key: "device-a:location",
});
```

## client.addApiKey(params)

Creates a new API key with a specific scope.

```ts
const response = await client.addApiKey({
    key: "readonly-device",
    scope: "readonly",
});
console.log(response.status);
```

## client.removeApiKey(params)

Deletes an existing API key.

```ts
await client.removeApiKey({
    key: "readonly-device",
});
```
