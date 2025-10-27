import {
    LTDBCollectionsResponse,
    LTDBFetchSessionsParams,
    LTDBQueryResponse,
    LTDBDeleteCollectionParams,
    LTDBInsertMessageResponse,
    LTDBQueryCollectionResponse,
    LTDBDeleteRecord,
    LTDBSetValueParams,
    LTDBGetValueParams,
    LTDBKeyValueResponse,
    LTDBKeyValueAllKeysResponse,
    LTDBKeyValueAllValuesResponse,
    LTDBCollectionParam,
    LTDBDeleteValueParams,
    LTDBInsertMessageRequest,
    LTDBFetchRecordsParams,
    LTDBDeleteDocumentParams,
} from "./types";

const MESSAGE_TYPES = {
    AUTH: "auth",
    INSERT: "ins",
    QUERY_SESSIONS: "qry",
    QUERY_COLLECTIONS: "cols",
    QUERY_DOCUMENT: "qdoc",
    DELETE_DOCUMENT: "ddoc",
    DELETE_COLLECTION: "dcol",
    DELETE_RECORD: "drec",
    DELETE_MULTIPLE_RECORDS: "dmrec",
    SET_VALUE: "sval",
    GET_VALUE: "gval",
    REMOVE_VALUE: "rval",
    GET_ALL_VALUES: "gvals",
    GET_ALL_KEYS: "gkeys",
} as const;

type WebSocketResponse = {
    id: string;
    [key: string]: string;
};

type WebSocketMessage = {
    type: string;
    data: string;
};

class LTDBClient {
    private ws: WebSocket | null = null;
    private readonly url: string;
    private inflightRequests: { [id: string]: (response: any) => void; } = {};
    private isConnecting: boolean = false; // Track if we're currently attempting to connect
    private isReconnecting: boolean = false; // Flag to prevent concurrent reconnect attempts
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private readonly reconnectInterval: number = 5000; // milliseconds
    private connectionPromise: Promise<void> | null = null; // Promise to track connection status
    private apiKey: string;

    constructor({ url, apiKey }: { url: string; apiKey: string; }) {
        this.url = url;
        this.apiKey = apiKey;
    }

    public async connect(): Promise<void> {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        if (this.isConnecting) {
            console.warn("WebSocket connection already in progress.");
            return this.connectionPromise!; // Return existing promise
        }

        if (this.connectionPromise) {
            return this.connectionPromise; // Return existing promise
        }

        this.isConnecting = true;
        this.connectionPromise = new Promise<void>((resolve, reject) => {
            // Create a new promise.
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log("WebSocket connected");
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.isReconnecting = false;

                const messageId = this.generateId();
                this.inflightRequests[messageId] = () => {
                    resolve(); // Resolve the promise on successful connection
                };
                this.ws!.send(
                    JSON.stringify({
                        id: messageId,
                        type: MESSAGE_TYPES.AUTH,
                        data: this.apiKey,
                    })
                );
            };

            this.ws.onmessage = (event: MessageEvent) => {
                try {
                    const response: WebSocketResponse = JSON.parse(event.data);
                    const callback = this.inflightRequests[response.id];
                    if (callback) {
                        callback(response);
                        delete this.inflightRequests[response.id];
                    } else {
                        console.warn(`Received unexpected message with id: ${response.id}`, response);
                    }
                } catch (error) {
                    console.error("Error parsing WebSocket message:", error);
                }
            };

            this.ws.onclose = (event: CloseEvent) => {
                console.log("WebSocket disconnected:", event.code, event.reason);
                this.isConnecting = false;
                this.connectionPromise = null; // Clear the promise on close/error
                this.cleanupOnClose();
                this.reconnect();
                reject(new Error(`WebSocket closed: ${event.code} ${event.reason}`)); // Reject on close
            };

            this.ws.onerror = (error: Event) => {
                console.error("WebSocket error:", error);
                this.isConnecting = false;
                this.connectionPromise = null; // Clear the promise on close/error
                this.cleanupOnClose();
                this.reconnect(); // Treat errors like a close event and attempt reconnect
                reject(error); // Reject the promise on error.
            };
        });

        return this.connectionPromise;
    }

    private cleanupOnClose(): void {
        // Clean up inflight requests
        for (const id in this.inflightRequests) {
            if (this.inflightRequests.hasOwnProperty(id)) {
                console.warn(`Request ${id} timed out due to disconnection.`);
                // You could also reject the promises here if using them,
                //  or provide an error handling strategy.
                delete this.inflightRequests[id];
            }
        }
    }

    private async send<T>(data: WebSocketMessage): Promise<T> {
        try {
            await this.connect();
        } catch (error) {
            return Promise.reject(new Error("Failed to connect before sending: " + (error as Error).message)); // Reject send if connect fails.
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error("WebSocket not connected."));
        }

        const messageId = this.generateId();

        return new Promise((resolve, reject) => {
            this.inflightRequests[messageId] = (response: T) => {
                resolve(response);
            };
            try {
                this.ws!.send(
                    JSON.stringify({
                        id: messageId,
                        type: data.type,
                        data: data.data,
                    })
                );
            } catch (error) {
                delete this.inflightRequests[messageId]; // Clean up if send fails
                console.error("Error sending message:", error);
                reject(error);
            }
        });
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2, 15);
    }

    public close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.cleanupOnClose();
        if (this.connectionPromise) {
            // If the connection promise exists, we'll reject it.
            this.connectionPromise = null;
        }
    }

    private reconnect(): void {
        if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
            return; // Prevent concurrent reconnects and stop if max attempts reached
        }

        this.isReconnecting = true;
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.connect();
            this.isReconnecting = false;
        }, this.reconnectInterval);
    }

    /************************************************************
    Database looks like this:
    
    where a collection is temperature, humidity, etc.
    where a document is an array of records, identified by the device_id

    {
        "temperature": {
            "device_id_1": [
                { "ts": 1747604423, "data": { "temperature": 22.5 }
                { "ts": 1747604424, "data": { "temperature": 22.6 }
            ],
            "device_id_2": [
                { "ts": 1747604425, "data": { "temperature": 22.7 }
                { "ts": 1747604426, "data": { "temperature": 22.8 }
            ],
            "device_id_3": [
                { "ts": 1747604427, "data": { "temperature": 22.9 }
                { "ts": 1747604428, "data": { "temperature": 23.0 }
            ],
        },
        "humidity": {
            "device_id_1": [
                { "ts": 1747604423, "data": { "humidity": 45.5 }
                { "ts": 1747604424, "data": { "humidity": 45.6 }
            ],
            "device_id_2": [
                { "ts": 1747604425, "data": { "humidity": 45.7 }
                { "ts": 1747604426, "data": { "humidity": 45.8 }
            ],
        }
    }
    ************************************************************/

    public async fetchCollections() {
        const resp = await this.send<LTDBCollectionsResponse>({
            type: MESSAGE_TYPES.QUERY_COLLECTIONS,
            data: "{}",
        });
        return resp.collections;
    }

    public async deleteCollection(params: LTDBDeleteCollectionParams) {
        await this.send<LTDBInsertMessageResponse>({
            type: MESSAGE_TYPES.DELETE_COLLECTION,
            data: JSON.stringify({ collection: params.collection }),
        });
    }

    /**
     * Fetch the latest records for a given collection. If device_id is provided, fetch the latest records for that device_id only
     * if "from" is provided, fetch the records only starting from that timestamp and always up to the "ts" timestamp.
     */
    public async fetchLatestDocumentRecords(params: LTDBFetchSessionsParams) {
        const resp = await this.send<LTDBQueryResponse>({
            type: MESSAGE_TYPES.QUERY_SESSIONS,
            data: JSON.stringify({ collection: params.collection, ts: params.ts, key: params.key || "", from: params.from || 0 }),
        });
        return resp.records;
    }

    public async insertMultipleDocumentRecords(items: LTDBInsertMessageRequest[]) {
        return this.send({ data: JSON.stringify(items), type: MESSAGE_TYPES.INSERT });
    }

    public async insertSingleDocumentRecord(items: LTDBInsertMessageRequest) {
        return this.send({ data: JSON.stringify([items]), type: MESSAGE_TYPES.INSERT });
    }

    public async fetchDocument(params: LTDBFetchRecordsParams) {
        const resp = await this.send<LTDBQueryCollectionResponse>({
            type: MESSAGE_TYPES.QUERY_DOCUMENT,
            data: JSON.stringify(params),
        });
        return resp.records;
    }

    public async deleteDocument(params: LTDBDeleteDocumentParams) {
        await this.send<LTDBInsertMessageResponse>({
            type: MESSAGE_TYPES.DELETE_DOCUMENT,
            data: JSON.stringify(params),
        });
    }

    public async deleteDocumentRecord(params: LTDBDeleteRecord) {
        await this.send<LTDBInsertMessageResponse>({
            type: MESSAGE_TYPES.DELETE_RECORD,
            data: JSON.stringify(params),
        });
    }

    public async deleteMultipleDocumentRecords(params: LTDBDeleteRecord[]) {
        await this.send<LTDBInsertMessageResponse>({
            type: MESSAGE_TYPES.DELETE_MULTIPLE_RECORDS,
            data: JSON.stringify(params),
        });
    }

    // Key Value API
    public async setValue(params: LTDBSetValueParams) {
        await this.send<LTDBInsertMessageResponse>({
            type: MESSAGE_TYPES.SET_VALUE,
            data: JSON.stringify(params),
        });
    }

    public async getValue(params: LTDBGetValueParams) {
        const resp = await this.send<LTDBKeyValueResponse>({
            type: MESSAGE_TYPES.GET_VALUE,
            data: JSON.stringify(params),
        });
        return resp.value;
    }

    public async getKeys(params: LTDBCollectionParam) {
        const resp = await this.send<LTDBKeyValueAllKeysResponse>({
            type: MESSAGE_TYPES.GET_ALL_KEYS,
            data: JSON.stringify(params),
        });
        return resp.keys;
    }

    public async getValues(params: LTDBCollectionParam) {
        const resp = await this.send<LTDBKeyValueAllValuesResponse>({
            type: MESSAGE_TYPES.GET_ALL_VALUES,
            data: JSON.stringify(params),
        });
        return resp.values;
    }

    public async deleteValue(params: LTDBDeleteValueParams) {
        await this.send<LTDBInsertMessageResponse>({
            type: MESSAGE_TYPES.REMOVE_VALUE,
            data: JSON.stringify(params),
        });
    }
}

export default LTDBClient;
