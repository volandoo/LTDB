# LTDB Go Client

Go client library for LTDB (Live Time Series Database).

## Installation

```bash
go get github.com/volandoo/ltdb/clients/go
```

## Usage

```go
package main

import (
    "encoding/json"
    "fmt"
    "log"
    "time"

    ltdb "github.com/volandoo/ltdb/clients/go"
)

func main() {
    // Create a new client
    client := ltdb.NewClient("ws://localhost:8080", "YOUR_SECRET_KEY")
    
    // Connect to the server
    if err := client.Connect(); err != nil {
        log.Fatal("Failed to connect:", err)
    }
    defer client.Close()

    // Insert a time series record
    now := time.Now().Unix()
    record := ltdb.LTDBInsertMessageRequest{
        TS:         now,
        Key:        "user123",
        Data:       `{"temperature": 22.5}`,
        Collection: "sensors",
    }
    
    if err := client.InsertRecord(record); err != nil {
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

    // Fetch records for a user in a collection
    records, err := client.FetchRecords(ltdb.LTDBFetchRecordsParams{
        Collection: "sensors",
        Key:        "user123",
        From:       now - 3600, // 1 hour ago
        To:         now,
    })
    if err != nil {
        log.Printf("Failed to fetch records: %v", err)
        return
    }
    
    fmt.Printf("Records: %v\n", records)
}
```

## API Reference

### Time Series Methods

- `InsertRecord(record LTDBInsertMessageRequest) error` - Insert a single record
- `InsertMultipleRecords(records []LTDBInsertMessageRequest) error` - Insert multiple records
- `FetchRecords(params LTDBFetchRecordsParams) ([]LTDBRecordResponse, error)` - Fetch records for a specific key
- `FetchSessions(params LTDBFetchSessionsParams) (map[string]LTDBRecordResponse, error)` - Fetch sessions
- `DeleteRecord(params LTDBDeleteRecord) error` - Delete a single record
- `DeleteMultipleRecords(params []LTDBDeleteRecord) error` - Delete multiple records
- `DeleteSession(params LTDBDeleteUserParams) error` - Delete all records for a user

### Collection Methods

- `FetchCollections() ([]string, error)` - Get all collections
- `DeleteCollection(params LTDBDeleteCollectionParams) error` - Delete a collection

### Key-Value Methods

- `SetValue(params LTDBSetValueParams) error` - Set a key-value pair
- `GetValue(params LTDBGetValueParams) (string, error)` - Get a value by key
- `GetKeys(params LTDBCollectionParam) ([]string, error)` - Get all keys in a collection
- `GetValues(params LTDBCollectionParam) (map[string]string, error)` - Get all key-value pairs in a collection
- `DeleteValue(params LTDBDeleteValueParams) error` - Delete a key-value pair

## Important Notes

- Timestamps must always be in seconds (Unix timestamp)
- Use `time.Now().Unix()` to get the current time in seconds
- The client automatically handles WebSocket connection, reconnection, and authentication
- All data fields should be JSON-encoded strings when storing complex objects

## Error Handling

The client includes automatic reconnection with exponential backoff. Connection errors are handled gracefully, and the client will attempt to reconnect up to 5 times before giving up.

## License

Apache-2.0
