export type InsertMessageRequest = {
    ts: number;
    key: string;
    data: string;
    collection: string;
};

export type ApiKeyScope = "readonly" | "read_write" | "read_write_delete";

export type ManageApiKeyParams = {
    action: "add" | "remove";
    key: string;
    scope?: ApiKeyScope;
};

export type AddApiKeyParams = {
    key: string;
    scope: ApiKeyScope;
};

export type RemoveApiKeyParams = {
    key: string;
};

export type ManageApiKeyResponse = {
    id: string;
    status?: string;
    error?: string;
    scope?: string;
};

export type InsertMessageResponse = {
    id: string;
};

export type QueryResponse = {
    id: string;
    records: {
        [key: string]: {
            ts: number;
            data: string;
        };
    };
};

export type QueryCollectionResponse = {
    id: string;
    records: {
        ts: number;
        data: string;
    }[];
};

export type CollectionsResponse = {
    id: string;
    collections: string[];
};

// key value response

export type KeyValueResponse = {
    id: string;
    value: string;
};

export type KeyValueAllKeysResponse = {
    id: string;
    keys: string[];
};

export type KeyValueAllValuesResponse = {
    id: string;
    values: { [key: string]: string; };
};

export type CollectionParam = {
    collection: string;
};

export type FetchLatestRecordsParams = {
    collection: string;
    ts: number;
    key?: string;
    from?: number;
};

export type DeleteCollectionParams = {
    collection: string;
};

export type FetchRecordsParams = {
    collection: string;
    key: string;
    from: number;
    to: number;
    limit?: number;
    reverse?: boolean;
};

export type DeleteDocumentParams = {
    key: string;
    collection: string;
};

export type DeleteRecord = {
    key: string;
    collection: string;
    ts: number;
};

export type SetValueParams = {
    collection: string;
    key: string;
    value: string;
};

export type GetValueParams = {
    collection: string;
    key: string;
};

export type DeleteValueParams = {
    collection: string;
    key: string;
};
