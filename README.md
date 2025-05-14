# LTDB

LTDB is a custom-built, high-performance in-memory time series database designed to run as a server. It is optimized for speed and efficiency, making it ideal for scenarios where fast time series data ingestion and retrieval are critical. LTDB exposes a WebSocket API for client interaction and can be easily deployed using Docker.

## Features

- In-memory time series storage for ultra-fast reads and writes
- WebSocket API for real-time data interaction
- Optional persistent storage
- Simple deployment with Docker
- Official Node.js client library

---

## Quick Start

### Run with Docker

You can run LTDB using Docker in two ways:

#### 1. Pull the pre-built image

```sh
docker pull volandoo/ltdb:latest
docker run --init --rm -it -p 8080:8080 -v $(pwd)/tmp_data:/app/data volandoo/ltdb:latest --secret-key=YOUR_SECRET_KEY --data=/app/data
```

#### 2. Build the image locally

```sh
docker build -t lttdb .
docker run --init --rm -it -p 8080:8080 -v $(pwd)/tmp_data:/app/data lttdb --secret-key=YOUR_SECRET_KEY --data=/app/data
```

- The server will listen on port `8080` by default.
- Replace `YOUR_SECRET_KEY` with your desired API key.

---

## Node.js Client Library

An official Node.js client is available in the `clients/node` folder and can be installed via npm:

```sh
npm install ltdb-client
```

### Example Usage

> **Note:** Timestamps must always be in seconds. In Node.js, use `Math.floor(Date.now() / 1000)` to get the current time in seconds.

```js
const { LTDBClient } = require('ltdb-client');

const client = new LTDBClient({
  url: 'ws://localhost:8080', // LTDB server WebSocket URL
  apiKey: 'YOUR_SECRET_KEY',  // The same key used to start the server
});

async function main() {
  // Insert a time series record
  await client.insert([
    {
      ts: Math.floor(Date.now() / 1000), // Timestamp in seconds
      key: 'user123',
      data: JSON.stringify({ temperature: 22.5 }),
      collection: 'sensors',
    },
  ]);

  // Fetch all collections
  const collections = await client.fetchCollections();
  console.log('Collections:', collections);

  // Fetch records for a user in a collection
  const now = Math.floor(Date.now() / 1000);
  const records = await client.fetchRecords({
    collection: 'sensors',
    key: 'user123',
    from: now - 3600, // 1 hour ago
    to: now,
  });
  console.log('Records:', records);

  client.close();
}

main();
```

---

## License

This project is licensed under the Apache-2.0 License. 