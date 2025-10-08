package main

import (
	"fmt"
	"log"
	"time"

	ltdb "github.com/volandoo/ltdb/clients/go"
)

func main() {
	// Create a new client
	client := ltdb.NewClient("ws://localhost:8080", "my-secret-key")

	// Connect to the server
	if err := client.Connect(); err != nil {
		log.Fatal("Failed to connect:", err)
	}
	defer client.Close()

	// Example 1: Insert a time series record
	now := time.Now().Unix()
	record := ltdb.LTDBInsertMessageRequest{
		TS:         now,
		Key:        "user123",
		Data:       `{"temperature": 22.5, "humidity": 65.2}`,
		Collection: "sensors",
	}

	if err := client.InsertRecord(record); err != nil {
		log.Printf("Failed to insert record: %v", err)
		return
	}
	fmt.Println("✓ Record inserted successfully")

	// Example 2: Insert multiple records
	records := []ltdb.LTDBInsertMessageRequest{
		{
			TS:         now + 1,
			Key:        "user123",
			Data:       `{"temperature": 22.7, "humidity": 64.8}`,
			Collection: "sensors",
		},
		{
			TS:         now + 2,
			Key:        "user123",
			Data:       `{"temperature": 22.9, "humidity": 64.5}`,
			Collection: "sensors",
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

	// Example 4: Fetch records for a user
	fetchedRecords, err := client.FetchRecords(ltdb.LTDBFetchRecordsParams{
		Collection: "sensors",
		Key:        "user123",
		From:       now - 3600, // 1 hour ago
		To:         now + 100,  // future time to include all records
	})
	if err != nil {
		log.Printf("Failed to fetch records: %v", err)
		return
	}
	fmt.Printf("✓ Fetched %d records for user123\n", len(fetchedRecords))
	for i, rec := range fetchedRecords {
		fmt.Printf("  Record %d: TS=%d, Data=%s\n", i+1, rec.TS, rec.Data)
	}

	// sessions

	// Example 5: Key-Value operations
	// Set a value
	if err := client.SetValue(ltdb.LTDBSetValueParams{
		Collection: "config",
		Key:        "app_version",
		Value:      "1.0.0",
	}); err != nil {
		log.Printf("Failed to set value: %v", err)
		return
	}
	fmt.Println("✓ Key-value pair set successfully")

	// Get a value
	value, err := client.GetValue(ltdb.LTDBGetValueParams{
		Collection: "config",
		Key:        "app_version",
	})
	if err != nil {
		log.Printf("Failed to get value: %v", err)
		return
	}
	fmt.Printf("✓ Retrieved value: %s\n", value)

	// Get all keys in collection
	keys, err := client.GetKeys(ltdb.LTDBCollectionParam{
		Collection: "config",
	})
	if err != nil {
		log.Printf("Failed to get keys: %v", err)
		return
	}
	fmt.Printf("✓ Keys in config collection: %v\n", keys)

	// Example 6: Fetch sessions
	sessions, err := client.FetchSessions(ltdb.LTDBFetchSessionsParams{
		Collection: "sensors",
		TS:         now,
		Key:        "user123",
		From:       now - 3600,
	})
	if err != nil {
		log.Printf("Failed to fetch sessions: %v", err)
		return
	}
	fmt.Printf("✓ Fetched sessions for user123: %d entries\n", len(sessions))

	fmt.Println("\n🎉 All examples completed successfully!")
}
