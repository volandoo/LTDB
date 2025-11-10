package main

import (
	"fmt"
	"log"
	"time"

	fluxiondb "github.com/volandoo/fluxiondb/clients/go"
)

func main() {
	// Create a new client
	client := fluxiondb.NewClient("ws://localhost:8080", "my-secret-key")

	// Connect to the server
	if err := client.Connect(); err != nil {
		log.Fatal("Failed to connect:", err)
	}
	defer client.Close()

	// Example 1: Insert a time series record
	now := time.Now().Unix()
	record := fluxiondb.InsertMessageRequest{
		TS:   now,
		Doc:  "collection123",
		Data: `{"temperature": 22.5, "humidity": 65.2}`,
		Col:  "sensors",
	}

	if err := client.InsertSingleDocumentRecord(record); err != nil {
		log.Printf("Failed to insert record: %v", err)
		return
	}
	fmt.Println("✓ Record inserted successfully")

	// Example 2: Insert multiple records
	records := []fluxiondb.InsertMessageRequest{
		{
			TS:   now + 1,
			Doc:  "collection123",
			Data: `{"temperature": 22.7, "humidity": 64.8}`,
			Col:  "sensors",
		},
		{
			TS:   now + 2,
			Doc:  "collection123",
			Data: `{"temperature": 22.9, "humidity": 64.5}`,
			Col:  "sensors",
		},
	}

	if err := client.InsertMultipleRecords(records); err != nil {
		log.Printf("Failed to insert multiple records: %v", err)
		return
	}
	fmt.Println("✓ Multiple records inserted successfully")

	// Example 3: Fetch all collections
	collections, err := client.FetchCollections()
	if err != nil {
		log.Printf("Failed to fetch collections: %v", err)
		return
	}
	fmt.Printf("✓ Collections: %v\n", collections)

	// Example 4: Fetch records for a collection
	fetchedRecords, err := client.FetchDocument(fluxiondb.FetchRecordsParams{
		Col:  "sensors",
		Doc:  "collection123",
		From: now - 3600, // 1 hour ago
		To:   now + 100,  // future time to include all records
	})
	if err != nil {
		log.Printf("Failed to fetch records: %v", err)
		return
	}
	fmt.Printf("✓ Fetched %d records for collection123\n", len(fetchedRecords))
	for i, rec := range fetchedRecords {
		fmt.Printf("  Record %d: TS=%d, Data=%s\n", i+1, rec.TS, rec.Data)
	}

	// sessions

	// Example 5: Key-Value operations
	// Set a value
	if err := client.SetValue(fluxiondb.SetValueParams{
		Col:   "config",
		Key:   "app_version",
		Value: "1.0.0",
	}); err != nil {
		log.Printf("Failed to set value: %v", err)
		return
	}
	fmt.Println("✓ Key-value pair set successfully")

	// Get a value
	value, err := client.GetValue(fluxiondb.GetValueParams{
		Col: "config",
		Key: "app_version",
	})
	if err != nil {
		log.Printf("Failed to get value: %v", err)
		return
	}
	fmt.Printf("✓ Retrieved value: %s\n", value)

	// Get all keys in collection
	keys, err := client.GetKeys(fluxiondb.CollectionParam{
		Col: "config",
	})
	if err != nil {
		log.Printf("Failed to get keys: %v", err)
		return
	}
	fmt.Printf("✓ Keys in config Col: %v\n", keys)

	// Example 6: Fetch sessions
	from := now - 3600
	sessions, err := client.FetchLatestRecords(fluxiondb.FetchLatestRecordsParams{
		Col:  "sensors",
		TS:   now,
		Doc:  "collection123",
		From: &from,
	})
	if err != nil {
		log.Printf("Failed to fetch sessions: %v", err)
		return
	}
	fmt.Printf("✓ Fetched sessions for collection123: %d entries\n", len(sessions))

	fmt.Println("\n🎉 All examples completed successfully!")
}
