package fluxiondb

import (
	"testing"
	"time"
)

func TestNewClient(t *testing.T) {
	client := NewClient("ws://localhost:8080", "test-key")

	if client == nil {
		t.Fatal("Expected client to be created, got nil")
	}

	if client.url != "ws://localhost:8080" {
		t.Errorf("Expected URL to be 'ws://localhost:8080', got '%s'", client.url)
	}

	if client.apiKey != "test-key" {
		t.Errorf("Expected API key to be 'test-key', got '%s'", client.apiKey)
	}

	if client.maxReconnectAttempts != 5 {
		t.Errorf("Expected maxReconnectAttempts to be 5, got %d", client.maxReconnectAttempts)
	}

	if client.reconnectInterval != 5*time.Second {
		t.Errorf("Expected reconnectInterval to be 5s, got %v", client.reconnectInterval)
	}
}

func TestGenerateID(t *testing.T) {
	client := NewClient("ws://localhost:8080", "test-key")

	id1 := client.generateID()
	id2 := client.generateID()

	if len(id1) != 13 {
		t.Errorf("Expected ID length to be 13, got %d", len(id1))
	}

	if len(id2) != 13 {
		t.Errorf("Expected ID length to be 13, got %d", len(id2))
	}

	if id1 == id2 {
		t.Error("Expected different IDs, got the same")
	}

	// Check that ID only contains valid characters
	validChars := "abcdefghijklmnopqrstuvwxyz0123456789"
	for _, char := range id1 {
		found := false
		for _, validChar := range validChars {
			if char == validChar {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("ID contains invalid character: %c", char)
		}
	}
}

func TestTypes(t *testing.T) {
	// Test InsertMessageRequest
	req := InsertMessageRequest{
		TS:   time.Now().Unix(),
		Doc:  "test-key",
		Data: `{"test": "data"}`,
		Col:  "test-collection",
	}

	if req.Doc != "test-key" {
		t.Errorf("Expected Doc to be 'test-key', got '%s'", req.Doc)
	}

	if req.Col != "test-collection" {
		t.Errorf("Expected Col to be 'test-collection', got '%s'", req.Col)
	}
}

func TestClientClose(t *testing.T) {
	client := NewClient("ws://localhost:8080", "test-key")

	// Should not panic when closing a client that was never connected
	client.Close()

	// Verify that context is cancelled
	select {
	case <-client.ctx.Done():
		// Expected
	default:
		t.Error("Expected context to be cancelled after Close()")
	}
}
