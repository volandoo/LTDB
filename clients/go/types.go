package ltdb

// LTDBInsertMessageRequest represents a request to insert a message
type LTDBInsertMessageRequest struct {
	TS         int64  `json:"ts"`
	Key        string `json:"key"`
	Data       string `json:"data"`
	Collection string `json:"collection"`
}

// LTDBAPIKeyRequest represents an API key request
type LTDBAPIKeyRequest struct {
	Data string `json:"data"`
}

// LTDBInsertMessageResponse represents the response to an insert message
type LTDBInsertMessageResponse struct {
	ID string `json:"id"`
}

// LTDBQueryResponse represents the response to a query
type LTDBQueryResponse struct {
	ID      string                        `json:"id"`
	Records map[string]LTDBRecordResponse `json:"records"`
}

// LTDBRecordResponse represents a single record in a query response
type LTDBRecordResponse struct {
	TS   int64  `json:"ts"`
	Data string `json:"data"`
}

// LTDBQueryCollectionResponse represents the response to a collection query
type LTDBQueryCollectionResponse struct {
	ID      string               `json:"id"`
	Records []LTDBRecordResponse `json:"records"`
}

// LTDBCollectionsResponse represents the response containing collections
type LTDBCollectionsResponse struct {
	ID          string   `json:"id"`
	Collections []string `json:"collections"`
}

// LTDBKeyValueResponse represents a key-value response
type LTDBKeyValueResponse struct {
	ID    string `json:"id"`
	Value string `json:"value"`
}

// LTDBKeyValueAllKeysResponse represents response with all keys
type LTDBKeyValueAllKeysResponse struct {
	ID   string   `json:"id"`
	Keys []string `json:"keys"`
}

// LTDBKeyValueAllValuesResponse represents response with all values
type LTDBKeyValueAllValuesResponse struct {
	ID     string            `json:"id"`
	Values map[string]string `json:"values"`
}

// LTDBCollectionParam represents a collection parameter
type LTDBCollectionParam struct {
	Collection string `json:"collection"`
}

// LTDBFetchLatestRecordsParams represents parameters for fetching sessions
type LTDBFetchLatestRecordsParams struct {
	Collection string `json:"collection"`
	TS         int64  `json:"ts"`
	Key        string `json:"key,omitempty"`
	From       *int64 `json:"from,omitempty"`
}

// LTDBDeleteCollectionParams represents parameters for deleting a collection
type LTDBDeleteCollectionParams struct {
	Collection string `json:"collection"`
}

// LTDBFetchRecordsParams represents parameters for fetching records
type LTDBFetchRecordsParams struct {
	Collection string `json:"collection"`
	Key        string `json:"key"`
	From       int64  `json:"from"`
	To         int64  `json:"to"`
	Limit      *int   `json:"limit,omitempty"`
	Reverse    *bool  `json:"reverse,omitempty"`
}

// LTDBDeleteDocumentParams represents parameters for deleting a document
type LTDBDeleteDocumentParams struct {
	Key        string `json:"key"`
	Collection string `json:"collection"`
}

// LTDBDeleteRecord represents parameters for deleting a record
type LTDBDeleteRecord struct {
	Key        string `json:"key"`
	Collection string `json:"collection"`
	TS         int64  `json:"ts"`
}

// LTDBSetValueParams represents parameters for setting a value
type LTDBSetValueParams struct {
	Collection string `json:"collection"`
	Key        string `json:"key"`
	Value      string `json:"value"`
}

// LTDBGetValueParams represents parameters for getting a value
type LTDBGetValueParams struct {
	Collection string `json:"collection"`
	Key        string `json:"key"`
}

// LTDBDeleteValueParams represents parameters for deleting a value
type LTDBDeleteValueParams struct {
	Collection string `json:"collection"`
	Key        string `json:"key"`
}

// WebSocketResponse represents a generic WebSocket response
type WebSocketResponse struct {
	ID string `json:"id"`
}

// WebSocketMessage represents a WebSocket message
type WebSocketMessage struct {
	ID   string `json:"id"`
	Type string `json:"type"`
	Data string `json:"data"`
}
