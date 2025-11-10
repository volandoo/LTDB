# Getting Started

Install the module and create a client with your WebSocket endpoint and API key:

```bash
go get github.com/volandoo/fluxiondb/clients/go
```

```go
package main

import (
	"log"
	"os"

	fluxiondb "github.com/volandoo/fluxiondb/clients/go"
)

func main() {
	client := fluxiondb.NewClient("ws://localhost:8080", os.Getenv("FLUXIONDB_API_KEY"))
	if err := client.Connect(); err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// use the client…
}
```

The client reconnects automatically if the socket drops, but calling `Connect()` explicitly during startup ensures the link is ready before issuing commands.
The snippets below assume standard helpers such as `time`, `log`, and pointer utility functions are imported or defined in your application.

## client.Connect()

Establishes the WebSocket session.

```go
if err := client.Connect(); err != nil {
	log.Fatalf("connect: %v", err)
}
```

## client.Close()

Cancels background routines and closes the WebSocket. Invoke it in `defer` to cleanly shut down your program or tests.

```go
defer client.Close()
```

## client.FetchCollections()

Lists the collections stored in FluxionDB.

```go
collections, err := client.FetchCollections()
if err != nil {
	log.Fatalf("fetch collections: %v", err)
}
log.Println(collections)
```

## client.DeleteCollection(params)

Removes a collection and all of its documents.

```go
if err := client.DeleteCollection(fluxiondb.DeleteCollectionParams{
	Col: "temperature",
}); err != nil {
	log.Fatalf("delete collection: %v", err)
}
```

## client.FetchLatestRecords(params)

Retrieves the most recent record for every document in a collection, optionally scoping by document ID and minimum timestamp.

```go
latest, err := client.FetchLatestRecords(fluxiondb.FetchLatestRecordsParams{
	Col: "temperature",
	TS:  time.Now().UnixMilli(),
	Doc: "device-a",               // optional
	From: ptrInt64(time.Now().Add(-time.Hour).UnixMilli()), // optional helper returning *int64
})
if err != nil {
	log.Fatalf("fetch latest: %v", err)
}
log.Printf("device-a: %s", latest["device-a"].Data)
```

## client.InsertMultipleRecords(items)

Bulk insert one or more records (each item targets a document within a collection).

```go
payload := []fluxiondb.InsertMessageRequest{
	{
		Col:  "temperature",
		Doc:  "device-a",
		TS:   time.Now().UnixMilli(),
		Data: `{"value":22.5}`,
	},
	{
		Col:  "temperature",
		Doc:  "device-b",
		TS:   time.Now().UnixMilli(),
		Data: `{"value":21.9}`,
	},
}

if err := client.InsertMultipleRecords(payload); err != nil {
	log.Fatalf("insert batch: %v", err)
}
```

## client.InsertSingleDocumentRecord(item)

Convenience wrapper for inserting a single record.

```go
if err := client.InsertSingleDocumentRecord(fluxiondb.InsertMessageRequest{
	Col:  "temperature",
	Doc:  "device-a",
	TS:   time.Now().UnixMilli(),
	Data: `{"value":22.5}`,
}); err != nil {
	log.Fatalf("insert single: %v", err)
}
```

## client.FetchDocument(params)

Retrieves a document’s record history with explicit time filters (and optional `Limit`/`Reverse` pagination hints).

```go
records, err := client.FetchDocument(fluxiondb.FetchRecordsParams{
	Col:   "temperature",
	Doc:   "device-a",
	From:  time.Now().Add(-time.Hour).UnixMilli(),
	To:    time.Now().UnixMilli(),
	Limit: ptrInt(100),
})
if err != nil {
	log.Fatalf("fetch document: %v", err)
}
```

## client.DeleteDocument(params)

Removes an entire document (all records) from a collection.

```go
if err := client.DeleteDocument(fluxiondb.DeleteDocumentParams{
	Col: "temperature",
	Doc: "device-a",
}); err != nil {
	log.Fatalf("delete document: %v", err)
}
```

## client.DeleteDocumentRecord(params)

Deletes a single record identified by timestamp.

```go
if err := client.DeleteDocumentRecord(fluxiondb.DeleteRecord{
	Col: "temperature",
	Doc: "device-a",
	TS:  1717610400000,
}); err != nil {
	log.Fatalf("delete record: %v", err)
}
```

## client.DeleteMultipleRecords(params)

Deletes multiple records across one or more documents.

```go
err := client.DeleteMultipleRecords([]fluxiondb.DeleteRecord{
	{Col: "temperature", Doc: "device-a", TS: 1717610400000},
	{Col: "temperature", Doc: "device-b", TS: 1717610460000},
})
if err != nil {
	log.Fatalf("delete multiple: %v", err)
}
```

## client.DeleteRecordsRange(params)

Deletes all records for a document within a timestamp range.

```go
if err := client.DeleteRecordsRange(fluxiondb.DeleteRecordsRange{
	Col:    "temperature",
	Doc:    "device-a",
	FromTS: time.Now().Add(-time.Hour).UnixMilli(),
	ToTS:   time.Now().UnixMilli(),
}); err != nil {
	log.Fatalf("delete range: %v", err)
}
```

## client.SetValue(params)

Stores a key/value pair in the collection-scoped KV store.

```go
if err := client.SetValue(fluxiondb.SetValueParams{
	Col:   "metadata",
	Key:   "device-a:location",
	Value: "warehouse-1",
}); err != nil {
	log.Fatalf("set value: %v", err)
}
```

## client.GetValue(params)

Fetches a single key/value entry.

```go
value, err := client.GetValue(fluxiondb.GetValueParams{
	Col: "metadata",
	Key: "device-a:location",
})
if err != nil {
	log.Fatalf("get value: %v", err)
}
log.Println(value)
```

## client.GetKeys(params)

Lists all keys under a KV collection.

```go
keys, err := client.GetKeys(fluxiondb.CollectionParam{Col: "metadata"})
if err != nil {
	log.Fatalf("get keys: %v", err)
}
log.Println(keys)
```

## client.GetValues(params)

Returns a map containing all key/value pairs in a KV collection.

```go
values, err := client.GetValues(fluxiondb.CollectionParam{Col: "metadata"})
if err != nil {
	log.Fatalf("get values: %v", err)
}
log.Println(values["device-a:location"])
```

## client.DeleteValue(params)

Removes a key/value entry.

```go
if err := client.DeleteValue(fluxiondb.DeleteValueParams{
	Col: "metadata",
	Key: "device-a:location",
}); err != nil {
	log.Fatalf("delete value: %v", err)
}
```

## client.AddAPIKey(key, scope)

Creates an API key with the desired scope (`ApiKeyScopeReadOnly`, `ApiKeyScopeReadWrite`, or `ApiKeyScopeReadWriteDelete`).

```go
resp, err := client.AddAPIKey("readonly-device", fluxiondb.ApiKeyScopeReadOnly)
if err != nil {
	log.Fatalf("add api key: %v", err)
}
log.Println(resp.Status)
```

## client.RemoveAPIKey(key)

Deletes a previously registered API key.

```go
if _, err := client.RemoveAPIKey("readonly-device"); err != nil {
	log.Fatalf("remove api key: %v", err)
}
```

> Tip: helper functions like `ptrInt` and `ptrInt64` are simple utilities returning pointers to satisfy optional parameters:
>
> ```go
> func ptrInt(v int) *int       { return &v }
> func ptrInt64(v int64) *int64 { return &v }
> ```
