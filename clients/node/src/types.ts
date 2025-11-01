export type LTDBInsertMessageRequest = {
    ts: number;
    key: string;
    data: string;
    collection: string;
};

export type LTDBApiKeyScope = "readonly" | "read_write" | "read_write_delete";

export type LTDBManageApiKeyParams = {
    action: "add" | "remove";
    key: string;
    scope?: LTDBApiKeyScope;
};

export type LTDBAddApiKeyParams = {
    key: string;
    scope: LTDBApiKeyScope;
};

export type LTDBRemoveApiKeyParams = {
    key: string;
};

export type LTDBManageApiKeyResponse = {
    id: string;
    status?: string;
    error?: string;
    scope?: string;
};

export type LTDBInsertMessageResponse = {
    id: string;
};

export type LTDBQueryResponse = {
    id: string;
    records: {
        [key: string]: {
            ts: number;
            data: string;
        };
    };
};

export type LTDBQueryCollectionResponse = {
    id: string;
    records: {
        ts: number;
        data: string;
    }[];
};

export type LTDBCollectionsResponse = {
    id: string;
    collections: string[];
};

// key value response

export type LTDBKeyValueResponse = {
    id: string;
    value: string;
};

export type LTDBKeyValueAllKeysResponse = {
    id: string;
    keys: string[];
};

export type LTDBKeyValueAllValuesResponse = {
    id: string;
    values: { [key: string]: string; };
};

export type LTDBCollectionParam = {
    collection: string;
};

export type LTDBFetchLatestRecordsParams = {
    collection: string;
    ts: number;
    key?: string;
    from?: number;
};

export type LTDBDeleteCollectionParams = {
    collection: string;
};

export type LTDBFetchRecordsParams = {
    collection: string;
    key: string;
    from: number;
    to: number;
    limit?: number;
    reverse?: boolean;
};

export type LTDBDeleteDocumentParams = {
    key: string;
    collection: string;
};

export type LTDBDeleteRecord = {
    key: string;
    collection: string;
    ts: number;
};

export type LTDBSetValueParams = {
    collection: string;
    key: string;
    value: string;
};

export type LTDBGetValueParams = {
    collection: string;
    key: string;
};

export type LTDBDeleteValueParams = {
    collection: string;
    key: string;
};
