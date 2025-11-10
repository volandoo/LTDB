"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// Lazy load WebSocket implementation
var MESSAGE_TYPES = {
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
};
var Client = /** @class */ (function () {
    function Client(_a) {
        var url = _a.url, apiKey = _a.apiKey;
        this.ws = null;
        this.inflightRequests = {};
        this.isConnecting = false; // Track if we're currently attempting to connect
        this.isReconnecting = false; // Flag to prevent concurrent reconnect attempts
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000; // milliseconds
        this.connectionPromise = null; // Promise to track connection status
        this.shouldReconnect = true; // Flag to track if reconnection should happen
        this.url = url;
        this.apiKey = apiKey;
    }
    Client.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                // Load WebSocket implementation first
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    return [2 /*return*/];
                }
                if (this.isConnecting) {
                    console.warn("WebSocket connection already in progress.");
                    return [2 /*return*/, this.connectionPromise]; // Return existing promise
                }
                if (this.connectionPromise) {
                    return [2 /*return*/, this.connectionPromise]; // Return existing promise
                }
                this.isConnecting = true;
                this.connectionPromise = new Promise(function (resolve, reject) {
                    var isAuthenticated = false; // Track if we received the "ready" message from server
                    try {
                        // Append API key as query parameter instead of header
                        // (Qt 6.4 doesn't support reading custom headers from handshake)
                        var urlWithKey = "".concat(_this.url).concat(_this.url.includes('?') ? '&' : '?', "api-key=").concat(encodeURIComponent(_this.apiKey));
                        console.log('Connecting to:', urlWithKey);
                        _this.ws = new WebSocket(urlWithKey);
                        console.log('WebSocket created, readyState:', _this.ws);
                    }
                    catch (error) {
                        _this.isConnecting = false;
                        _this.connectionPromise = null;
                        reject(error);
                        return;
                    }
                    // Handle open event - don't resolve yet, wait for "ready" message
                    var onOpen = function () {
                        console.log("WebSocket connected, awaiting authentication...");
                        // Don't resolve here - wait for server to send "ready" message
                    };
                    // Handle message event
                    var onMessage = function (event) {
                        try {
                            // In browser, event is MessageEvent with event.data
                            // In Node.js ws, event is the data directly
                            var data_1 = event.data;
                            var payload = (function () {
                                if (typeof data_1 === "string") {
                                    return data_1;
                                }
                                if (data_1 instanceof Blob) {
                                    // Handle Blob in browser (we'll read it as text)
                                    var reader_1 = new FileReader();
                                    reader_1.onload = function () {
                                        var text = reader_1.result;
                                        // Check if this is the ready message during connection
                                        if (!isAuthenticated && _this.isConnecting) {
                                            try {
                                                var msg = JSON.parse(text);
                                                if (msg.type === "ready") {
                                                    console.log("Authentication successful");
                                                    isAuthenticated = true;
                                                    _this.isConnecting = false;
                                                    _this.reconnectAttempts = 0;
                                                    _this.isReconnecting = false;
                                                    _this.shouldReconnect = true;
                                                    resolve();
                                                    return;
                                                }
                                            }
                                            catch (e) {
                                                // Not JSON or not ready message, handle normally below
                                            }
                                        }
                                        _this.handleMessage(text);
                                    };
                                    reader_1.readAsText(data_1);
                                    return null; // Skip processing below, will be handled in onload
                                }
                                if (data_1 instanceof ArrayBuffer) {
                                    return new TextDecoder().decode(data_1);
                                }
                                return String(data_1);
                            })();
                            if (payload !== null) {
                                // Check if this is the "ready" message from server during authentication
                                if (!isAuthenticated && _this.isConnecting) {
                                    console.log("Received message during authentication:", payload.substring(0, 100));
                                    try {
                                        var msg = JSON.parse(payload);
                                        console.log("Parsed message type:", msg.type);
                                        if (msg.type === "ready") {
                                            console.log("Authentication successful");
                                            isAuthenticated = true;
                                            _this.isConnecting = false;
                                            _this.reconnectAttempts = 0;
                                            _this.isReconnecting = false;
                                            _this.shouldReconnect = true;
                                            resolve();
                                            return; // Don't pass ready message to handleMessage
                                        }
                                    }
                                    catch (e) {
                                        console.log("Failed to parse message during auth:", e);
                                        // Not JSON or not ready message, handle normally
                                    }
                                }
                                _this.handleMessage(payload);
                            }
                        }
                        catch (error) {
                            console.error("Error parsing WebSocket message:", error);
                        }
                    };
                    // Handle close event
                    var onClose = function (event) {
                        var code = event.code;
                        var reason = event.reason ? String(event.reason) : '';
                        var reasonText = reason || "no reason";
                        console.log("WebSocket disconnected:", code, reasonText);
                        _this.isConnecting = false;
                        _this.connectionPromise = null; // Clear the promise on close/error
                        _this.ws = null;
                        _this.cleanupOnClose();
                        // If closed before authentication, it's an auth failure
                        if (!isAuthenticated) {
                            reject(new Error("Authentication failed: ".concat(reasonText || "code ".concat(code))));
                        }
                        else if (_this.shouldReconnect) {
                            _this.reconnect();
                        }
                    };
                    // Handle error event
                    var onError = function (error) {
                        console.error("WebSocket error:", error);
                        _this.isConnecting = false;
                        _this.connectionPromise = null; // Clear the promise on close/error
                        _this.ws = null;
                        _this.cleanupOnClose();
                        // If error before authentication, reject the connection promise
                        if (!isAuthenticated) {
                            reject(error || new Error('WebSocket connection error'));
                        }
                        else if (_this.shouldReconnect) {
                            _this.reconnect(); // Treat errors like a close event and attempt reconnect
                        }
                    };
                    // Attach event listeners based on environment
                    if (!_this.ws) {
                        reject(new Error('Failed to create WebSocket'));
                        return;
                    }
                    _this.ws.addEventListener('open', onOpen);
                    _this.ws.addEventListener('message', onMessage);
                    _this.ws.addEventListener('close', onClose);
                    _this.ws.addEventListener('error', onError);
                });
                return [2 /*return*/, this.connectionPromise];
            });
        });
    };
    Client.prototype.handleMessage = function (payload) {
        var response = JSON.parse(payload);
        var callback = this.inflightRequests[response.id];
        if (callback) {
            callback(response);
            delete this.inflightRequests[response.id];
        }
        else if (response.error) {
            console.warn("Received error response: ".concat(response.error));
        }
        else {
            console.warn("Received unexpected message with id: ".concat(response.id), response);
        }
    };
    Client.prototype.cleanupOnClose = function () {
        // Clean up inflight requests
        for (var id in this.inflightRequests) {
            if (this.inflightRequests.hasOwnProperty(id)) {
                console.warn("Request ".concat(id, " timed out due to disconnection."));
                // You could also reject the promises here if using them,
                //  or provide an error handling strategy.
                delete this.inflightRequests[id];
            }
        }
    };
    Client.prototype.send = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var error_1, messageId;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.connect()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        return [2 /*return*/, Promise.reject(new Error("Failed to connect before sending: " + error_1.message))]; // Reject send if connect fails.
                    case 3:
                        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                            return [2 /*return*/, Promise.reject(new Error("WebSocket not connected."))];
                        }
                        messageId = this.generateId();
                        return [2 /*return*/, new Promise(function (resolve, reject) {
                                _this.inflightRequests[messageId] = function (response) {
                                    resolve(response);
                                };
                                try {
                                    _this.ws.send(JSON.stringify({
                                        id: messageId,
                                        type: data.type,
                                        data: data.data,
                                    }));
                                }
                                catch (error) {
                                    delete _this.inflightRequests[messageId]; // Clean up if send fails
                                    console.error("Error sending message:", error);
                                    reject(error);
                                }
                            })];
                }
            });
        });
    };
    Client.prototype.generateId = function () {
        return Math.random().toString(36).substring(2, 15);
    };
    Client.prototype.close = function () {
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
    };
    Client.prototype.reconnect = function () {
        var _this = this;
        if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
            return; // Prevent concurrent reconnects and stop if max attempts reached
        }
        this.isReconnecting = true;
        this.reconnectAttempts++;
        console.log("Attempting to reconnect... (Attempt ".concat(this.reconnectAttempts, "/").concat(this.maxReconnectAttempts, ")"));
        setTimeout(function () {
            _this.connect();
            _this.isReconnecting = false;
        }, this.reconnectInterval);
    };
    Client.prototype.fetchCollections = function () {
        return __awaiter(this, void 0, void 0, function () {
            var resp;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send({
                            type: MESSAGE_TYPES.QUERY_COLLECTIONS,
                            data: "{}",
                        })];
                    case 1:
                        resp = _a.sent();
                        return [2 /*return*/, resp.collections];
                }
            });
        });
    };
    Client.prototype.deleteCollection = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send({
                            type: MESSAGE_TYPES.DELETE_COLLECTION,
                            data: JSON.stringify(params),
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetch the latest records for a given collection. If device_id is provided, fetch the latest records for that device_id only
     * if "from" is provided, fetch the records only starting from that timestamp and always up to the "ts" timestamp.
     */
    Client.prototype.fetchLatestRecords = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var resp;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send({
                            type: MESSAGE_TYPES.QUERY_RECORDS,
                            data: JSON.stringify({ col: params.col, ts: params.ts, doc: params.doc || "", from: params.from || 0 }),
                        })];
                    case 1:
                        resp = _a.sent();
                        return [2 /*return*/, resp.records];
                }
            });
        });
    };
    Client.prototype.insertMultipleRecords = function (items) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.send({ data: JSON.stringify(items), type: MESSAGE_TYPES.INSERT })];
            });
        });
    };
    Client.prototype.insertSingleRecord = function (items) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.send({ data: JSON.stringify([items]), type: MESSAGE_TYPES.INSERT })];
            });
        });
    };
    Client.prototype.fetchDocument = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var resp;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send({
                            type: MESSAGE_TYPES.QUERY_DOCUMENT,
                            data: JSON.stringify(params),
                        })];
                    case 1:
                        resp = _a.sent();
                        return [2 /*return*/, resp.records];
                }
            });
        });
    };
    Client.prototype.deleteDocument = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send({
                            type: MESSAGE_TYPES.DELETE_DOCUMENT,
                            data: JSON.stringify(params),
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Client.prototype.deleteRecord = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send({
                            type: MESSAGE_TYPES.DELETE_RECORD,
                            data: JSON.stringify(params),
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Client.prototype.deleteMultipleRecords = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send({
                            type: MESSAGE_TYPES.DELETE_MULTIPLE_RECORDS,
                            data: JSON.stringify(params),
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Client.prototype.deleteRecordsRange = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send({
                            type: MESSAGE_TYPES.DELETE_RECORDS_RANGE,
                            data: JSON.stringify(params),
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Key Value API
    Client.prototype.setValue = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send({
                            type: MESSAGE_TYPES.SET_VALUE,
                            data: JSON.stringify(params),
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Client.prototype.getValue = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var resp;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send({
                            type: MESSAGE_TYPES.GET_VALUE,
                            data: JSON.stringify(params),
                        })];
                    case 1:
                        resp = _a.sent();
                        return [2 /*return*/, resp.value];
                }
            });
        });
    };
    Client.prototype.getKeys = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var resp;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send({
                            type: MESSAGE_TYPES.GET_ALL_KEYS,
                            data: JSON.stringify(params),
                        })];
                    case 1:
                        resp = _a.sent();
                        return [2 /*return*/, resp.keys];
                }
            });
        });
    };
    Client.prototype.getValues = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var resp;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send({
                            type: MESSAGE_TYPES.GET_ALL_VALUES,
                            data: JSON.stringify(params),
                        })];
                    case 1:
                        resp = _a.sent();
                        return [2 /*return*/, resp.values];
                }
            });
        });
    };
    Client.prototype.deleteValue = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send({
                            type: MESSAGE_TYPES.REMOVE_VALUE,
                            data: JSON.stringify(params),
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Client.prototype.addApiKey = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.manageApiKey({
                        action: "add",
                        key: params.key,
                        scope: params.scope,
                    })];
            });
        });
    };
    Client.prototype.removeApiKey = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.manageApiKey({
                        action: "remove",
                        key: params.key,
                    })];
            });
        });
    };
    Client.prototype.manageApiKey = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.send({
                        type: MESSAGE_TYPES.MANAGE_API_KEYS,
                        data: JSON.stringify(params),
                    })];
            });
        });
    };
    return Client;
}());
exports.default = Client;
