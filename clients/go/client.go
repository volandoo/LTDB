package fluxiondb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	messageTypeInsert           = "ins"
	messageTypeQueryRecords     = "qry"
	messageTypeQueryCollections = "cols"
	messageTypeQueryDocument    = "qdoc"
	messageTypeDeleteDocument   = "ddoc"
	messageTypeDeleteCollection = "dcol"
	messageTypeDeleteRecord     = "drec"
	messageTypeDeleteMultiple   = "dmrec"
	messageTypeSetValue         = "sval"
	messageTypeGetValue         = "gval"
	messageTypeRemoveValue      = "rval"
	messageTypeGetAllValues     = "gvals"
	messageTypeGetAllKeys       = "gkeys"
	messageTypeManageKeys       = "keys"
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
	headers := http.Header{}
	headers.Set("X-API-Key", c.apiKey)

	conn, _, err := dialer.Dial(u.String(), headers)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}

	c.conn = conn
	c.reconnectAttempts = 0
	c.isReconnecting = false

	go c.readMessages()

	log.Println("WebSocket connected")
	return nil
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

		// Check if connection is still valid before reading
		if c.conn == nil {
			return
		}

		var response map[string]interface{}
		err := c.conn.ReadJSON(&response)
		if err != nil {
			// Only log and reconnect if context is not cancelled
			select {
			case <-c.ctx.Done():
				return
			default:
				log.Printf("Error reading message: %v", err)
				c.reconnect()
				return
			}
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
	c.connectionMutex.Lock()
	defer c.connectionMutex.Unlock()

	if c.conn != nil {
		c.conn.Close()
		c.conn = nil
	}

	c.inflightMutex.Lock()
	for id, ch := range c.inflightRequests {
		select {
		case <-ch:
			// Channel already closed
		default:
			close(ch)
		}
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

	// Wait a moment for the readMessages goroutine to exit
	time.Sleep(100 * time.Millisecond)

	c.cleanupConnection()
}

// FetchCollections fetches all available collections
func (c *Client) FetchCollections() ([]string, error) {
	var response LTDBCollectionsResponse
	err := c.send(messageTypeQueryCollections, "{}", &response)
	if err != nil {
		return nil, err
	}
	return response.Collections, nil
}

// FetchLatestDocumentRecords fetches the latest records per document for a collection
func (c *Client) FetchLatestDocumentRecords(params LTDBFetchLatestRecordsParams) (map[string]LTDBRecordResponse, error) {
	data, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}

	var response LTDBQueryResponse
	err = c.send(messageTypeQueryRecords, string(data), &response)
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
	return c.send(messageTypeDeleteCollection, string(data), &response)
}

// InsertMultipleDocumentRecords inserts multiple records into a document
func (c *Client) InsertMultipleDocumentRecords(items []LTDBInsertMessageRequest) error {
	data, err := json.Marshal(items)
	if err != nil {
		return err
	}

	var response LTDBInsertMessageResponse
	return c.send(messageTypeInsert, string(data), &response)
}

// InsertSingleDocumentRecord inserts a single record into a document
func (c *Client) InsertSingleDocumentRecord(item LTDBInsertMessageRequest) error {
	return c.InsertMultipleDocumentRecords([]LTDBInsertMessageRequest{item})
}

// FetchDocument fetches all records for a specific document according to the provided filters
func (c *Client) FetchDocument(params LTDBFetchRecordsParams) ([]LTDBRecordResponse, error) {
	data, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}

	var response LTDBQueryCollectionResponse
	err = c.send(messageTypeQueryDocument, string(data), &response)
	if err != nil {
		return nil, err
	}
	return response.Records, nil
}

// DeleteDocument deletes an entire document (optionally scoped to a collection)
func (c *Client) DeleteDocument(params LTDBDeleteDocumentParams) error {
	data, err := json.Marshal(params)
	if err != nil {
		return err
	}

	var response LTDBInsertMessageResponse
	return c.send(messageTypeDeleteDocument, string(data), &response)
}

// DeleteDocumentRecord deletes a single record within a document
func (c *Client) DeleteDocumentRecord(params LTDBDeleteRecord) error {
	data, err := json.Marshal(params)
	if err != nil {
		return err
	}

	var response LTDBInsertMessageResponse
	return c.send(messageTypeDeleteRecord, string(data), &response)
}

// DeleteMultipleDocumentRecords deletes multiple records across one or more documents
func (c *Client) DeleteMultipleDocumentRecords(params []LTDBDeleteRecord) error {
	data, err := json.Marshal(params)
	if err != nil {
		return err
	}

	var response LTDBInsertMessageResponse
	return c.send(messageTypeDeleteMultiple, string(data), &response)
}

// SetValue sets a key-value pair
func (c *Client) SetValue(params LTDBSetValueParams) error {
	data, err := json.Marshal(params)
	if err != nil {
		return err
	}

	var response LTDBInsertMessageResponse
	return c.send(messageTypeSetValue, string(data), &response)
}

// GetValue gets a value by key
func (c *Client) GetValue(params LTDBGetValueParams) (string, error) {
	data, err := json.Marshal(params)
	if err != nil {
		return "", err
	}

	var response LTDBKeyValueResponse
	err = c.send(messageTypeGetValue, string(data), &response)
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
	err = c.send(messageTypeGetAllKeys, string(data), &response)
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
	err = c.send(messageTypeGetAllValues, string(data), &response)
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
	return c.send(messageTypeRemoveValue, string(data), &response)
}

// AddAPIKey registers a new API key with the specified scope
func (c *Client) AddAPIKey(key string, scope LTDBApiKeyScope) (LTDBManageAPIKeyResponse, error) {
	payload := LTDBManageAPIKeyParams{
		Action: "add",
		Key:    key,
		Scope:  scope,
	}

	return c.manageAPIKey(payload)
}

// RemoveAPIKey deletes a previously created API key
func (c *Client) RemoveAPIKey(key string) (LTDBManageAPIKeyResponse, error) {
	payload := LTDBManageAPIKeyParams{
		Action: "remove",
		Key:    key,
	}

	return c.manageAPIKey(payload)
}

func (c *Client) manageAPIKey(params LTDBManageAPIKeyParams) (LTDBManageAPIKeyResponse, error) {
	data, err := json.Marshal(params)
	if err != nil {
		return LTDBManageAPIKeyResponse{}, err
	}

	var response LTDBManageAPIKeyResponse
	if err := c.send(messageTypeManageKeys, string(data), &response); err != nil {
		return LTDBManageAPIKeyResponse{}, err
	}

	return response, nil
}
