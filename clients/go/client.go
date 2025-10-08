package ltdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Client represents an LTDB WebSocket client
type Client struct {
	url                  string
	apiKey               string
	conn                 *websocket.Conn
	inflightRequests     map[string]chan json.RawMessage
	inflightMutex        sync.RWMutex
	isConnecting         bool
	isReconnecting       bool
	reconnectAttempts    int
	maxReconnectAttempts int
	reconnectInterval    time.Duration
	connectionMutex      sync.Mutex
	ctx                  context.Context
	cancel               context.CancelFunc
	connected            chan struct{}
}

// NewClient creates a new LTDB client
func NewClient(wsURL, apiKey string) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	return &Client{
		url:                  wsURL,
		apiKey:               apiKey,
		inflightRequests:     make(map[string]chan json.RawMessage),
		maxReconnectAttempts: 5,
		reconnectInterval:    5 * time.Second,
		ctx:                  ctx,
		cancel:               cancel,
		connected:            make(chan struct{}),
	}
}

// Connect establishes a WebSocket connection to the LTDB server
func (c *Client) Connect() error {
	c.connectionMutex.Lock()
	defer c.connectionMutex.Unlock()

	if c.conn != nil {
		return nil
	}

	if c.isConnecting {
		return errors.New("connection already in progress")
	}

	c.isConnecting = true
	defer func() { c.isConnecting = false }()

	u, err := url.Parse(c.url)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(u.String(), nil)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}

	c.conn = conn
	c.reconnectAttempts = 0
	c.isReconnecting = false

	go c.readMessages()

	// Authenticate with API key
	messageID := c.generateID()
	authChan := make(chan json.RawMessage, 1)

	c.inflightMutex.Lock()
	c.inflightRequests[messageID] = authChan
	c.inflightMutex.Unlock()

	authMsg := WebSocketMessage{
		ID:   messageID,
		Type: "api-key",
		Data: c.apiKey,
	}

	if err := c.conn.WriteJSON(authMsg); err != nil {
		c.cleanupConnection()
		return fmt.Errorf("failed to send auth message: %w", err)
	}

	// Wait for auth response
	select {
	case <-authChan:
		close(c.connected)
		log.Println("WebSocket connected and authenticated")
		return nil
	case <-time.After(10 * time.Second):
		c.cleanupConnection()
		return errors.New("authentication timeout")
	case <-c.ctx.Done():
		c.cleanupConnection()
		return c.ctx.Err()
	}
}

// readMessages handles incoming WebSocket messages
func (c *Client) readMessages() {
	defer c.cleanupConnection()

	for {
		select {
		case <-c.ctx.Done():
			return
		default:
		}

		var response map[string]interface{}
		err := c.conn.ReadJSON(&response)
		if err != nil {
			log.Printf("Error reading message: %v", err)
			c.reconnect()
			return
		}

		id, ok := response["id"].(string)
		if !ok {
			log.Printf("Received message without ID: %v", response)
			continue
		}

		c.inflightMutex.RLock()
		responseChan, exists := c.inflightRequests[id]
		c.inflightMutex.RUnlock()

		if exists {
			responseBytes, _ := json.Marshal(response)
			select {
			case responseChan <- responseBytes:
			default:
				log.Printf("Failed to send response for ID %s", id)
			}

			c.inflightMutex.Lock()
			delete(c.inflightRequests, id)
			c.inflightMutex.Unlock()
		} else {
			log.Printf("Received unexpected message with ID: %s", id)
		}
	}
}

// cleanupConnection cleans up the connection and inflight requests
func (c *Client) cleanupConnection() {
	if c.conn != nil {
		c.conn.Close()
		c.conn = nil
	}

	c.inflightMutex.Lock()
	for id, ch := range c.inflightRequests {
		close(ch)
		delete(c.inflightRequests, id)
	}
	c.inflightMutex.Unlock()
}

// reconnect attempts to reconnect to the server
func (c *Client) reconnect() {
	if c.isReconnecting || c.reconnectAttempts >= c.maxReconnectAttempts {
		return
	}

	c.isReconnecting = true
	c.reconnectAttempts++

	log.Printf("Attempting to reconnect... (Attempt %d/%d)", c.reconnectAttempts, c.maxReconnectAttempts)

	time.Sleep(c.reconnectInterval)

	c.connectionMutex.Lock()
	c.isConnecting = false
	c.connectionMutex.Unlock()

	err := c.Connect()
	if err != nil {
		log.Printf("Reconnection failed: %v", err)
	}

	c.isReconnecting = false
}

// send sends a message and waits for a response
func (c *Client) send(msgType, data string, response interface{}) error {
	if c.conn == nil {
		if err := c.Connect(); err != nil {
			return fmt.Errorf("failed to connect: %w", err)
		}
	}

	messageID := c.generateID()
	responseChan := make(chan json.RawMessage, 1)

	c.inflightMutex.Lock()
	c.inflightRequests[messageID] = responseChan
	c.inflightMutex.Unlock()

	msg := WebSocketMessage{
		ID:   messageID,
		Type: msgType,
		Data: data,
	}

	if err := c.conn.WriteJSON(msg); err != nil {
		c.inflightMutex.Lock()
		delete(c.inflightRequests, messageID)
		c.inflightMutex.Unlock()
		return fmt.Errorf("failed to send message: %w", err)
	}

	select {
	case responseData := <-responseChan:
		return json.Unmarshal(responseData, response)
	case <-time.After(30 * time.Second):
		c.inflightMutex.Lock()
		delete(c.inflightRequests, messageID)
		c.inflightMutex.Unlock()
		return errors.New("request timeout")
	case <-c.ctx.Done():
		c.inflightMutex.Lock()
		delete(c.inflightRequests, messageID)
		c.inflightMutex.Unlock()
		return c.ctx.Err()
	}
}

// generateID generates a random ID for messages
func (c *Client) generateID() string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 13)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

// Close closes the client connection
func (c *Client) Close() {
	c.cancel()
	c.cleanupConnection()
	fmt.Println("Client closed")
}

// FetchCollections fetches all available collections
func (c *Client) FetchCollections() ([]string, error) {
	var response LTDBCollectionsResponse
	err := c.send("collections", "{}", &response)
	if err != nil {
		return nil, err
	}
	return response.Collections, nil
}

// FetchSessions fetches sessions based on parameters
func (c *Client) FetchSessions(params LTDBFetchSessionsParams) (map[string]LTDBRecordResponse, error) {
	data, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}

	var response LTDBQueryResponse
	err = c.send("query", string(data), &response)
	if err != nil {
		return nil, err
	}
	return response.Records, nil
}

// DeleteCollection deletes a collection
func (c *Client) DeleteCollection(params LTDBDeleteCollectionParams) error {
	data, err := json.Marshal(params)
	if err != nil {
		return err
	}

	var response LTDBInsertMessageResponse
	return c.send("delete-collection", string(data), &response)
}

// InsertMultipleRecords inserts multiple records
func (c *Client) InsertMultipleRecords(items []LTDBInsertMessageRequest) error {
	data, err := json.Marshal(items)
	if err != nil {
		return err
	}

	var response LTDBInsertMessageResponse
	return c.send("insert", string(data), &response)
}

// InsertRecord inserts a single record
func (c *Client) InsertRecord(item LTDBInsertMessageRequest) error {
	return c.InsertMultipleRecords([]LTDBInsertMessageRequest{item})
}

// FetchRecords fetches records for a specific user
func (c *Client) FetchRecords(params LTDBFetchRecordsParams) ([]LTDBRecordResponse, error) {
	data, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}

	var response LTDBQueryUserResponse
	err = c.send("query-user", string(data), &response)
	if err != nil {
		return nil, err
	}
	return response.Records, nil
}

// DeleteRecord deletes a single record
func (c *Client) DeleteRecord(params LTDBDeleteRecord) error {
	data, err := json.Marshal(params)
	if err != nil {
		return err
	}

	var response LTDBInsertMessageResponse
	return c.send("delete-record", string(data), &response)
}

// DeleteMultipleRecords deletes multiple records
func (c *Client) DeleteMultipleRecords(params []LTDBDeleteRecord) error {
	data, err := json.Marshal(params)
	if err != nil {
		return err
	}

	var response LTDBInsertMessageResponse
	return c.send("delete-multiple-records", string(data), &response)
}

// DeleteSession deletes a user session
func (c *Client) DeleteSession(params LTDBDeleteUserParams) error {
	data, err := json.Marshal(params)
	if err != nil {
		return err
	}

	var response LTDBInsertMessageResponse
	return c.send("delete-user", string(data), &response)
}

// SetValue sets a key-value pair
func (c *Client) SetValue(params LTDBSetValueParams) error {
	data, err := json.Marshal(params)
	if err != nil {
		return err
	}

	var response LTDBInsertMessageResponse
	return c.send("set-value", string(data), &response)
}

// GetValue gets a value by key
func (c *Client) GetValue(params LTDBGetValueParams) (string, error) {
	data, err := json.Marshal(params)
	if err != nil {
		return "", err
	}

	var response LTDBKeyValueResponse
	err = c.send("get-value", string(data), &response)
	if err != nil {
		return "", err
	}
	return response.Value, nil
}

// GetKeys gets all keys in a collection
func (c *Client) GetKeys(params LTDBCollectionParam) ([]string, error) {
	data, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}

	var response LTDBKeyValueAllKeysResponse
	err = c.send("get-all-keys", string(data), &response)
	if err != nil {
		return nil, err
	}
	return response.Keys, nil
}

// GetValues gets all values in a collection
func (c *Client) GetValues(params LTDBCollectionParam) (map[string]string, error) {
	data, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}

	var response LTDBKeyValueAllValuesResponse
	err = c.send("get-all-values", string(data), &response)
	if err != nil {
		return nil, err
	}
	return response.Values, nil
}

// DeleteValue deletes a key-value pair
func (c *Client) DeleteValue(params LTDBDeleteValueParams) error {
	data, err := json.Marshal(params)
	if err != nil {
		return err
	}

	var response LTDBInsertMessageResponse
	return c.send("remove-value", string(data), &response)
}
