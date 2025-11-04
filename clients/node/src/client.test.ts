/// <reference types="jest" />

// test the client

import FluxionDBClient from './client';
const testCollection = 'test_collection_2';

const createMockData = () => {
    const documentIds = [
        'document_1',
        'document_2',
        'document_3',
    ];
    const now = 1747604423;
    const records = [];
    for (const documentId of documentIds) {
        for (let i = 0; i < 1000; i++) {
            const ts = now + i;
            const data = JSON.stringify({ value: i });
            records.push({ ts, key: documentId, data, collection: testCollection });
        }
    }
    records.push({ ts: now - 1, key: 'collection_4', data: 'test', collection: testCollection });

    return records;
};


beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
});

afterAll(() => {
    // (console.log as jest.Mock).mockRestore();
    // (console.warn as jest.Mock).mockRestore();
    // (console.error as jest.Mock).mockRestore();
});

describe('FluxionDBClient Integration', () => {
    const url = 'ws://localhost:8080';
    const apiKey = 'my-secret-key';

    const client = new FluxionDBClient({ url, apiKey });

    beforeAll(async () => {
        const records = createMockData();
        await client.deleteCollection({ collection: testCollection });
        await client.insertMultipleRecords(records);
    }, 10000);

    afterAll(async () => {
        client.close();
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it('should fetch latest document records of all four', async () => {
        const result = await client.fetchLatestRecords({
            collection: testCollection,
            ts: Date.now(),
        });
        const keys = Object.keys(result);
        expect(keys.length).toBe(4);
        for (const key of keys) {
            if (key === 'collection_4') {
                expect(result[key].ts).toBe(1747604423 - 1);
            } else {
                expect(result[key].ts).toBe(1747604423 + 999);
            }
        }
    }, 10000);

    it('should fetch latest document records of only three', async () => {
        const result = await client.fetchLatestRecords({
            collection: testCollection,
            ts: Date.now(),
            from: 1747604423 + 1,
        });
        const keys = Object.keys(result);
        expect(keys.length).toBe(3);
        for (const key of keys) {
            expect(result[key].ts).toBe(1747604423 + 999);
        }
    }, 10000);

    it('should manage scoped API keys', async () => {
        const managedKey = `sdk-readonly-${Date.now()}`;
        const addResponse = await client.addApiKey({ key: managedKey, scope: "readonly" });
        expect(addResponse.error ?? "").toBe("");
        expect(addResponse.status).toBe("ok");

        const removeResponse = await client.removeApiKey({ key: managedKey });
        expect(removeResponse.error ?? "").toBe("");
        expect(removeResponse.status).toBe("ok");
    }, 10000);
});
