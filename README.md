# FluxionDB

FluxionDB is an in-memory time series database exposed over WebSockets. The server keeps hot data in RAM, can optionally persist to disk, and speaks a compact protocol that is shared by the official Node.js and Go client SDKs shipped in this repository.

## Highlights

-   Millisecond inserts and queries backed by an in-memory collection store
-   Compact WebSocket protocol with query-parameter auth and tokenised message types (`ins`, `qry`, …)
-   Optional persistence when a data folder is supplied
-   First-party clients:
    -   Node.js SDK (`clients/node`) published as `@volandoo/fluxiondb-client`
    -   Go SDK (`clients/go`) with examples and docs
-   Docker image (`volandoo/fluxiondb`) for single-command deployment

---

## Running the Server

### Docker (recommended)

```sh
# Pull the upstream image
docker pull volandoo/fluxiondb:latest

# Run the server
docker run --init --rm -it \
  -p 8080:8080 \
  -v $(pwd)/tmp_data:/app/data \
  volandoo/fluxiondb:latest \
  --secret-key=YOUR_SECRET_KEY \
  --data=/app/data
```

To build the image from source:

```sh
make build
SECRET_KEY=YOUR_SECRET_KEY make run
```

### Native Build (Qt 6)

```sh
qmake6 fluxiondb.pro
make
./fluxiondb --secret-key=YOUR_SECRET_KEY --data=/path/to/data
```

Arguments:

-   `--secret-key` (required) secures client connections.
-   `--data` (optional) enables persistence by pointing to a writable directory. Omit to run fully in-memory.

---

### Helm Chart

FluxionDB ships with a Helm chart under `deploy/helm/fluxiondb`. To install it from the repository root:

```sh
helm install fluxiondb ./deploy/helm/fluxiondb \
  --set secret.secretKey=YOUR_SECRET_KEY \
  --set persistence.enabled=true
```

Key values you may want to override:

-   `secret.secretKey` – master key used for client authentication (required).
-   `image.tag` – pin to a specific FluxionDB image digest or tag.
-   `persistence.*` – control volume size, storage class, or use an existing claim.

Set `ingress.enabled=true` and configure `ingress.hosts`/`ingress.tls` to expose the WebSocket service externally.

---

## WebSocket Protocol Overview

All requests are JSON documents. Clients authenticate during the WebSocket handshake by providing an `api-key` query parameter in the connection URL (e.g., `ws://localhost:8080?api-key=YOUR_KEY`). Supply the master key for full access, or a scoped key that you created with the `keys` management message. The legacy `auth` message is no longer accepted by the server.

| Type    | Purpose                                  |
| ------- | ---------------------------------------- |
| `ins`   | Insert one or more records               |
| `qry`   | Fetch latest record per document         |
| `cols`  | List collections                         |
| `qdoc`  | Fetch records for a document             |
| `ddoc`  | Delete a document                        |
| `dcol`  | Delete a collection                      |
| `drec`  | Delete a single record                   |
| `dmrec` | Delete multiple records                  |
| `drrng` | Delete records within a timestamp range  |
| `sval`  | Set key-value entry                      |
| `gval`  | Get key-value entry                      |
| `rval`  | Remove key-value entry                   |
| `gvals` | Fetch all key-value entries              |
| `gkeys` | Fetch all keys                           |
| `keys`  | Manage API keys (add/remove scoped keys) |

### API Key Scopes

The built-in master key always has full access, cannot be removed, and is the only credential allowed to create or revoke other keys. Scoped keys created via the `keys` message support three levels:

-   `readonly` – query-only access.
-   `read_write` – read and insert/update operations.
-   `read_write_delete` – full access, including destructive operations.

Both clients handle the JSON marshalling for you, as well as appending the API key to the connection URL.

### Managing API Keys Manually

To create or revoke scoped keys without an SDK, send a `keys` message after the socket is established (using the master key in the handshake):

```json
{
    "id": "create-1",
    "type": "keys",
    "data": "{\"action\":\"add\",\"key\":\"analytics-reader\",\"scope\":\"readonly\"}"
}
```

Removing a key works the same way:

```json
{
    "id": "remove-1",
    "type": "keys",
    "data": "{\"action\":\"remove\",\"key\":\"analytics-reader\"}"
}
```

Responses include the original `id` plus a `"status": "ok"` field on success, or `"error"` when the operation is rejected. The master key always retains `read_write_delete` scope and cannot be removed.

---

## Node.js Client

Install from npm:

```sh
npm install @volandoo/fluxiondb-client
```

Example:

```js
import FluxionDBClient from "@volandoo/fluxiondb-client";

const client = new FluxionDBClient({ url: "ws://localhost:8080", apiKey: "YOUR_SECRET_KEY" });

const now = Math.floor(Date.now() / 1000);
await client.insertMultipleDocumentRecords([
    { ts: now, doc: "device-1", data: JSON.stringify({ temperature: 22.5 }), col: "sensors" },
]);

const collections = await client.fetchCollections();
console.log(collections);

const latest = await client.fetchLatestDocumentRecords({ col: "sensors", ts: now });
console.log(latest);

const history = await client.fetchDocument({
    col: "sensors",
    doc: "device-1",
    from: now - 3600,
    to: now,
});
console.log(history);

await client.close();
```

Scoped access can be provisioned at runtime:

```ts
await client.addApiKey({ key: "sensor-reader", scope: "readonly" });
await client.removeApiKey({ key: "sensor-reader" });
```

The full TypeScript source, tests, and build tooling live under `clients/node/`.

---

## Go Client

Add the module:

```sh
go get github.com/volandoo/fluxiondb/clients/go
```

Example:

```go
client := fluxiondb.NewClient("ws://localhost:8080", "YOUR_SECRET_KEY")
if err := client.Connect(); err != nil {
    log.Fatal(err)
}
defer client.Close()

now := time.Now().Unix()
_ = client.InsertSingleDocumentRecord(fluxiondb.InsertMessageRequest{
    TS:   now,
    Doc:  "device-1",
    Data: `{"temperature":22.5}`,
    Col:  "sensors",
})

latest, _ := client.FetchLatestDocumentRecords(fluxiondb.FetchLatestRecordsParams{
    Col: "sensors",
    TS:  now,
})

fmt.Println(latest)
```

See `clients/go/README.md` and the example app in `clients/go/example/` for more.

---

## Development

-   `make build` – build the Docker image
-   `SECRET_KEY=dev make run` – run the server in Docker with persistence mounted at `tmp_data/`
-   `qmake6 fluxiondb.pro && make` – native build (requires Qt 6 Core + WebSockets)
-   `cd clients/node && npm install && npm run build` – build Node client bundle
-   `cd clients/go && go test ./...` – run Go client tests

### Repository Layout

-   `src/` – Qt/C++17 server sources
-   `clients/node/` – Node.js SDK (TypeScript)
-   `clients/go/` – Go SDK
-   `tmp_data/` – sample data mount point when running locally

---

## License

Apache-2.0
