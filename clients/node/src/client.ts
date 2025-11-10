import {
    CollectionsResponse,
    FetchLatestRecordsParams,
    QueryResponse,
    DeleteCollectionParams,
    InsertMessageResponse,
    QueryCollectionResponse,
    DeleteRecord,
    DeleteRecordsRange,
    SetValueParams,
    GetValueParams,
    KeyValueResponse,
    KeyValueAllKeysResponse,
    KeyValueAllValuesResponse,
    CollectionParam,
    DeleteValueParams,
    InsertMessageRequest,
    FetchRecordsParams,
    DeleteDocumentParams,
    ManageApiKeyResponse,
    AddApiKeyParams,
    RemoveApiKeyParams,
    ManageApiKeyParams,
} from "./types";

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

// Lazy load WebSocket implementation
let WebSocketImpl: any = null;
let wsLoadPromise: Promise<any> | null = null;

async function getWebSocketImpl(): Promise<any> {
    if (WebSocketImpl) {
        return WebSocketImpl;
    }

    if (wsLoadPromise) {
        return wsLoadPromise;
    }

    wsLoadPromise = (async () => {
        if (isBrowser || typeof WebSocket !== 'undefined') {
            // Browser or environment with global WebSocket
            if (typeof WebSocket === 'undefined') {
                throw new Error('Browser clients must use the native WebSocket object');
            }
            WebSocketImpl = WebSocket;
            return WebSocket;
        } else {
            // Node.js - dynamically import ws
            try {
                const ws = await import('ws');
                WebSocketImpl = ws.default || ws.WebSocket || ws;
                return WebSocketImpl;
            } catch (e) {
                throw new Error('ws package is required for Node.js environments. Install it with: npm install ws');
            }
        }
    })();

    return wsLoadPromise;
}

const MESSAGE_TYPES = {
    INSERT: "ins",
    QUERY_RECORDS: "qry",
    QUERY_COLLECTIONS: "cols",
    QUERY_DOCUMENT: "qdoc",
    DELETE_DOCUMENT: "ddoc",
    DELETE_COLLECTION: "dcol",
    DELETE_RECORD: "drec",
    DELETE_MULTIPLE_RECORDS: "dmrec",
    DELETE_RECORDS_RANGE: "drrng",
    SET_VALUE: "sval",
    GET_VALUE: "gval",
    REMOVE_VALUE: "rval",
    GET_ALL_VALUES: "gvals",
    GET_ALL_KEYS: "gkeys",
    MANAGE_API_KEYS: "keys",
} as const;

type WebSocketResponse = {
    id: string;
    [key: string]: string;
};

type WebSocketMessage = {
    type: string;
    data: string;
};

class Client {
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
    private shouldReconnect: boolean = true; // Flag to track if reconnection should happen

    constructor({ url, apiKey }: { url: string; apiKey: string; }) {
        this.url = url;
        this.apiKey = apiKey;
    }

    public async connect(): Promise<void> {
        // Load WebSocket implementation first
        const WS = await getWebSocketImpl();

        if (this.ws && this.ws.readyState === WS.OPEN) {
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
            let isAuthenticated = false; // Track if we received the "ready" message from server

            try {
                // Append API key as query parameter instead of header
                // (Qt 6.4 doesn't support reading custom headers from handshake)
                const urlWithKey = `${this.url}${this.url.includes('?') ? '&' : '?'}api-key=${encodeURIComponent(this.apiKey)}`;
                this.ws = new WS(urlWithKey);
            } catch (error) {
                this.isConnecting = false;
                this.connectionPromise = null;
                reject(error as Error);
                return;
            }

            // Handle open event - don't resolve yet, wait for "ready" message
            const onOpen = () => {
                console.log("WebSocket connected, awaiting authentication...");
                // Don't resolve here - wait for server to send "ready" message
            };

            // Handle message event
            const onMessage = (event: any) => {
                try {
                    // In browser, event is MessageEvent with event.data
                    // In Node.js ws, event is the data directly
                    const data = isBrowser ? event.data : event;
                    const payload = (() => {
                        if (typeof data === "string") {
                            return data;
                        }
                        if (isBrowser && data instanceof Blob) {
                            // Handle Blob in browser (we'll read it as text)
                            const reader = new FileReader();
                            reader.onload = () => {
                                const text = reader.result as string;
                                // Check if this is the ready message during connection
                                if (!isAuthenticated && this.isConnecting) {
                                    try {
                                        const msg = JSON.parse(text);
                                        if (msg.type === "ready") {
                                            console.log("Authentication successful");
                                            isAuthenticated = true;
                                            this.isConnecting = false;
                                            this.reconnectAttempts = 0;
                                            this.isReconnecting = false;
                                            this.shouldReconnect = true;
                                            resolve();
                                            return;
                                        }
                                    } catch (e) {
                                        // Not JSON or not ready message, handle normally below
                                    }
                                }
                                this.handleMessage(text);
                            };
                            reader.readAsText(data);
                            return null; // Skip processing below, will be handled in onload
                        }
                        if (data instanceof ArrayBuffer) {
                            if (isBrowser) {
                                return new TextDecoder().decode(data);
                            } else {
                                return Buffer.from(data).toString();
                            }
                        }
                        if (!isBrowser && Array.isArray(data)) {
                            return Buffer.concat(data).toString();
                        }
                        if (!isBrowser && typeof data.toString === 'function') {
                            return data.toString();
                        }
                        return String(data);
                    })();

                    if (payload !== null) {
                        // Check if this is the "ready" message from server during authentication
                        if (!isAuthenticated && this.isConnecting) {
                            console.log("Received message during authentication:", payload.substring(0, 100));
                            try {
                                const msg = JSON.parse(payload);
                                console.log("Parsed message type:", msg.type);
                                if (msg.type === "ready") {
                                    console.log("Authentication successful");
                                    isAuthenticated = true;
                                    this.isConnecting = false;
                                    this.reconnectAttempts = 0;
                                    this.isReconnecting = false;
                                    this.shouldReconnect = true;
                                    resolve();
                                    return; // Don't pass ready message to handleMessage
                                }
                            } catch (e) {
                                console.log("Failed to parse message during auth:", e);
                                // Not JSON or not ready message, handle normally
                            }
                        }
                        this.handleMessage(payload);
                    }
                } catch (error) {
                    console.error("Error parsing WebSocket message:", error);
                }
            };

            // Handle close event
            const onClose = (event: any) => {
                const code = isBrowser ? event.code : event;
                const reason = isBrowser ? event.reason : (event ? String(event) : '');
                const reasonText = reason || "no reason";
                console.log("WebSocket disconnected:", code, reasonText);
                this.isConnecting = false;
                this.connectionPromise = null; // Clear the promise on close/error
                this.ws = null;
                this.cleanupOnClose();

                // If closed before authentication, it's an auth failure
                if (!isAuthenticated) {
                    reject(new Error(`Authentication failed: ${reasonText || `code ${code}`}`));
                } else if (this.shouldReconnect) {
                    this.reconnect();
                }
            };

            // Handle error event
            const onError = (error: any) => {
                console.error("WebSocket error:", error);
                this.isConnecting = false;
                this.connectionPromise = null; // Clear the promise on close/error
                this.ws = null;
                this.cleanupOnClose();

                // If error before authentication, reject the connection promise
                if (!isAuthenticated) {
                    reject(error || new Error('WebSocket connection error'));
                } else if (this.shouldReconnect) {
                    this.reconnect(); // Treat errors like a close event and attempt reconnect
                }
            };

            // Attach event listeners based on environment
            if (!this.ws) {
                reject(new Error('Failed to create WebSocket'));
                return;
            }

            if (isBrowser) {
                this.ws.addEventListener('open', onOpen);
                this.ws.addEventListener('message', onMessage);
                this.ws.addEventListener('close', onClose);
                this.ws.addEventListener('error', onError);
            } else {
                // Node.js ws uses .on() method
                (this.ws as any).on('open', onOpen);
                (this.ws as any).on('message', onMessage);
                (this.ws as any).on('close', onClose);
                (this.ws as any).on('error', onError);
            }
        });

        return this.connectionPromise;
    }

    private handleMessage(payload: string): void {
        const response: WebSocketResponse = JSON.parse(payload);
        const callback = this.inflightRequests[response.id];
        if (callback) {
            callback(response);
            delete this.inflightRequests[response.id];
        } else if (response.error) {
            console.warn(`Received error response: ${response.error}`);
        } else {
            console.warn(`Received unexpected message with id: ${response.id}`, response);
        }
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

        const WS = await getWebSocketImpl();
        if (!this.ws || this.ws.readyState !== WS.OPEN) {
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
        this.shouldReconnect = false; // Prevent automatic reconnection
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

    public async fetchCollections() {
        const resp = await this.send<CollectionsResponse>({
            type: MESSAGE_TYPES.QUERY_COLLECTIONS,
            data: "{}",
        });
        return resp.collections;
    }

    public async deleteCollection(params: DeleteCollectionParams) {
        await this.send<InsertMessageResponse>({
            type: MESSAGE_TYPES.DELETE_COLLECTION,
            data: JSON.stringify(params),
        });
    }

    /**
     * Fetch the latest records for a given collection. If device_id is provided, fetch the latest records for that device_id only
     * if "from" is provided, fetch the records only starting from that timestamp and always up to the "ts" timestamp.
     */
    public async fetchLatestRecords(params: FetchLatestRecordsParams) {
        const resp = await this.send<QueryResponse>({
            type: MESSAGE_TYPES.QUERY_RECORDS,
            data: JSON.stringify({ col: params.col, ts: params.ts, doc: params.doc || "", from: params.from || 0 }),
        });
        return resp.records;
    }

    public async insertMultipleRecords(items: InsertMessageRequest[]) {
        return this.send({ data: JSON.stringify(items), type: MESSAGE_TYPES.INSERT });
    }

    public async insertSingleRecord(items: InsertMessageRequest) {
        return this.send({ data: JSON.stringify([items]), type: MESSAGE_TYPES.INSERT });
    }

    public async fetchDocument(params: FetchRecordsParams) {
        const resp = await this.send<QueryCollectionResponse>({
            type: MESSAGE_TYPES.QUERY_DOCUMENT,
            data: JSON.stringify(params),
        });
        return resp.records;
    }

    public async deleteDocument(params: DeleteDocumentParams) {
        await this.send<InsertMessageResponse>({
            type: MESSAGE_TYPES.DELETE_DOCUMENT,
            data: JSON.stringify(params),
        });
    }

    public async deleteRecord(params: DeleteRecord) {
        await this.send<InsertMessageResponse>({
            type: MESSAGE_TYPES.DELETE_RECORD,
            data: JSON.stringify(params),
        });
    }

    public async deleteMultipleRecords(params: DeleteRecord[]) {
        await this.send<InsertMessageResponse>({
            type: MESSAGE_TYPES.DELETE_MULTIPLE_RECORDS,
            data: JSON.stringify(params),
        });
    }

    public async deleteRecordsRange(params: DeleteRecordsRange) {
        await this.send<InsertMessageResponse>({
            type: MESSAGE_TYPES.DELETE_RECORDS_RANGE,
            data: JSON.stringify(params),
        });
    }

    // Key Value API
    public async setValue(params: SetValueParams) {
        await this.send<InsertMessageResponse>({
            type: MESSAGE_TYPES.SET_VALUE,
            data: JSON.stringify(params),
        });
    }

    public async getValue(params: GetValueParams) {
        const resp = await this.send<KeyValueResponse>({
            type: MESSAGE_TYPES.GET_VALUE,
            data: JSON.stringify(params),
        });
        return resp.value;
    }

    public async getKeys(params: CollectionParam) {
        const resp = await this.send<KeyValueAllKeysResponse>({
            type: MESSAGE_TYPES.GET_ALL_KEYS,
            data: JSON.stringify(params),
        });
        return resp.keys;
    }

    public async getValues(params: CollectionParam) {
        const resp = await this.send<KeyValueAllValuesResponse>({
            type: MESSAGE_TYPES.GET_ALL_VALUES,
            data: JSON.stringify(params),
        });
        return resp.values;
    }

    public async deleteValue(params: DeleteValueParams) {
        await this.send<InsertMessageResponse>({
            type: MESSAGE_TYPES.REMOVE_VALUE,
            data: JSON.stringify(params),
        });
    }

    public async addApiKey(params: AddApiKeyParams): Promise<ManageApiKeyResponse> {
        return this.manageApiKey({
            action: "add",
            key: params.key,
            scope: params.scope,
        });
    }

    public async removeApiKey(params: RemoveApiKeyParams): Promise<ManageApiKeyResponse> {
        return this.manageApiKey({
            action: "remove",
            key: params.key,
        });
    }

    private async manageApiKey(params: ManageApiKeyParams): Promise<ManageApiKeyResponse> {
        return this.send<ManageApiKeyResponse>({
            type: MESSAGE_TYPES.MANAGE_API_KEYS,
            data: JSON.stringify(params),
        });
    }
}

export default Client;
