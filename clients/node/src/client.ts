import {
    LTDBCollectionsResponse,
    LTDBFetchSessionsParams,
    LTDBQueryResponse,
    LTDBDeleteCollectionParams,
    LTDBInsertMessageResponse,
    LTDBQueryUserResponse,
    LTDBDeleteRecord,
    LTDBDeleteUserParams,
    LTDBSetValueParams,
    LTDBGetValueParams,
    LTDBKeyValueResponse,
    LTDBKeyValueAllKeysResponse,
    LTDBKeyValueAllValuesResponse,
    LTDBCollectionParam,
    LTDBDeleteValueParams,
    LTDBInsertMessageRequest,
    LTDBFetchRecordsParams,
} from "./types";

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
    private inflightRequests: { [id: string]: (response: any) => void } = {};
    private isConnecting: boolean = false; // Track if we're currently attempting to connect
    private isReconnecting: boolean = false; // Flag to prevent concurrent reconnect attempts
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private readonly reconnectInterval: number = 5000; // milliseconds
    private connectionPromise: Promise<void> | null = null; // Promise to track connection status
    private apiKey: string;

    constructor({ url, apiKey }: { url: string; apiKey: string }) {
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
                        type: "api-key",
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

    public async fetchCollections() {
        const resp = await this.send<LTDBCollectionsResponse>({
            type: "collections",
            data: "{}",
        });
        return resp.collections;
    }

    // can throw error
    public async fetchSessions(params: LTDBFetchSessionsParams) {
        const resp = await this.send<LTDBQueryResponse>({
            type: "query",
            data: JSON.stringify({ collection: params.collection, ts: params.ts, key: params.key || "", from: params.from || 0 }),
        });
        return resp.records;
    }

    public async deleteCollection(params: LTDBDeleteCollectionParams) {
        await this.send<LTDBInsertMessageResponse>({
            type: "delete-collection",
            data: JSON.stringify({ collection: params.collection }),
        });
    }

    public async insert(items: LTDBInsertMessageRequest[]) {
        return this.send({ data: JSON.stringify(items), type: "insert" });
    }

    public async fetchRecords(params: LTDBFetchRecordsParams) {
        const resp = await this.send<LTDBQueryUserResponse>({
            type: "query-user",
            data: JSON.stringify(params),
        });
        return resp.records;
    }

    public async deleteRecord(params: LTDBDeleteRecord) {
        await this.send<LTDBInsertMessageResponse>({
            type: "delete-record",
            data: JSON.stringify(params),
        });
    }

    public async deleteMultipleRecords(params: LTDBDeleteRecord[]) {
        await this.send<LTDBInsertMessageResponse>({
            type: "delete-multiple-records",
            data: JSON.stringify(params),
        });
    }

    // can throw error
    public async deleteUser(params: LTDBDeleteUserParams) {
        await this.send<LTDBInsertMessageResponse>({
            type: "delete-user",
            data: JSON.stringify(params),
        });
    }
    public async setValue(params: LTDBSetValueParams) {
        await this.send<LTDBInsertMessageResponse>({
            type: "set-value",
            data: JSON.stringify(params),
        });
    }

    public async getValue(params: LTDBGetValueParams) {
        const resp = await this.send<LTDBKeyValueResponse>({
            type: "get-value",
            data: JSON.stringify(params),
        });
        return resp.value;
    }

    public async getKeys(params: LTDBCollectionParam) {
        const resp = await this.send<LTDBKeyValueAllKeysResponse>({
            type: "get-all-keys",
            data: JSON.stringify(params),
        });
        return resp.keys;
    }

    public async getValues(params: LTDBCollectionParam) {
        const resp = await this.send<LTDBKeyValueAllValuesResponse>({
            type: "get-all-values",
            data: JSON.stringify(params),
        });
        return resp.values;
    }

    public async deleteValue(params: LTDBDeleteValueParams) {
        await this.send<LTDBInsertMessageResponse>({
            type: "remove-value",
            data: JSON.stringify(params),
        });
    }
}

export default LTDBClient;
