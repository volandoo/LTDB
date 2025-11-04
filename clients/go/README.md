# FluxionDB Go Client

Go client library for FluxionDB (Live Time Series Database).

## Installation

```bash
go get github.com/volandoo/fluxiondb/clients/go
```

## Usage

```go
package main

import (
    "fmt"
    "log"
    "time"

    fluxiondb "github.com/volandoo/fluxiondb/clients/go"
)

func main() {
    // Create a new client
    client := fluxiondb.NewClient("ws://localhost:8080", "YOUR_SECRET_KEY")

    // Connect to the server
    if err := client.Connect(); err != nil {
        log.Fatal("Failed to connect:", err)
    }
    defer client.Close()

    if _, err := client.AddAPIKey("readonly-sdk", fluxiondb.ApiKeyScopeReadOnly); err != nil {
        log.Printf("Failed to add scoped key: %v", err)
    }

    // Insert a time series record
    now := time.Now().Unix()
    record := fluxiondb.InsertMessageRequest{
        TS:   now,
        Doc:  "device123",
        Data: `{"temperature": 22.5}`,
        Col:  "sensors",
    }

    if err := client.InsertSingleDocumentRecord(record); err != nil {
        log.Printf("Failed to insert record: %v", err)
        return
    }

    // Fetch all collections
    collections, err := client.FetchCollections()
    if err != nil {
        log.Printf("Failed to fetch collections: %v", err)
        return
    }
    fmt.Printf("Collections: %v\n", collections)

    // Fetch records for a document in a collection
    records, err := client.FetchDocument(fluxiondb.FetchRecordsParams{
        Col:  "sensors",
        Doc:  "device123",
        From: now - 3600, // 1 hour ago
        To:   now,
    })
    if err != nil {
        log.Printf("Failed to fetch records: %v", err)
        return
    }

    fmt.Printf("Records: %v\n", records)

    // Fetch latest record per document
    from := now - 3600
    sessions, err := client.FetchLatestDocumentRecords(fluxiondb.FetchLatestRecordsParams{
        Col:  "sensors",
        TS:   now,
        Doc:  "device123",
        From: &from,
    })
    if err != nil {
        log.Printf("Failed to fetch latest records: %v", err)
        return
    }
    fmt.Printf("Latest records: %v\n", sessions)
}
```

## API Reference

### Time Series Methods

-   `InsertSingleDocumentRecord(record InsertMessageRequest) error` - Insert a single record into a document
-   `InsertMultipleDocumentRecords(records []InsertMessageRequest) error` - Insert multiple records into a document
-   `FetchDocument(params FetchRecordsParams) ([]RecordResponse, error)` - Fetch records for a specific document
-   `FetchLatestDocumentRecords(params FetchLatestRecordsParams) (map[string]RecordResponse, error)` - Fetch the latest record per document in a collection
-   `DeleteDocument(params DeleteDocumentParams) error` - Delete a document (optionally across collections)
-   `DeleteDocumentRecord(params DeleteRecord) error` - Delete a single record within a document
-   `DeleteMultipleRecords(params []DeleteRecord) error` - Delete multiple records within documents
-   `DeleteRecordsRange(params DeleteRecordsRange) error` - Delete all records within a timestamp range for a document

### Collection Methods

-   `FetchCollections() ([]string, error)` - Get all collections
-   `DeleteCollection(params DeleteCollectionParams) error` - Delete a collection

### Key-Value Methods

-   `SetValue(params SetValueParams) error` - Set a key-value pair
-   `GetValue(params GetValueParams) (string, error)` - Get a value by key
-   `GetKeys(params CollectionParam) ([]string, error)` - Get all keys in a collection
-   `GetValues(params CollectionParam) (map[string]string, error)` - Get all key-value pairs in a collection
-   `DeleteValue(params DeleteValueParams) error` - Delete a key-value pair

### API Key Management

-   `AddAPIKey(key string, scope ApiKeyScope) (ManageAPIKeyResponse, error)` - Create a scoped key
-   `RemoveAPIKey(key string) (ManageAPIKeyResponse, error)` - Revoke a scoped key

> **Note:** Only the master API key (supplied via the `api-key` query parameter during the handshake) is allowed to add or remove keys. Scoped keys can consume their allotted permissions but cannot manage other credentials.

## Important Notes

-   Timestamps are stored as 64-bit numbers; choose the unit that fits your workload (seconds, milliseconds, counters, etc.).
-   Pick a consistent unit per collection to keep queries intuitive.
-   The client automatically appends the `api-key` query parameter and manages connection retries
-   All data fields should be JSON-encoded strings when storing complex objects

## Error Handling

The client includes automatic reconnection with exponential backoff. Connection errors are handled gracefully, and the client will attempt to reconnect up to 5 times before giving up.

## License

Apache-2.0
