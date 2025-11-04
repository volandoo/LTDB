import FluxionDBClient from "./client";
import {
    CollectionsResponse,
    FetchLatestRecordsParams,
    QueryResponse,
    DeleteCollectionParams,
    InsertMessageResponse,
    QueryCollectionResponse,
    DeleteRecord,
    DeleteDocumentParams,
    SetValueParams,
    GetValueParams,
    KeyValueResponse,
    KeyValueAllKeysResponse,
    KeyValueAllValuesResponse,
    CollectionParam,
    DeleteValueParams,
    InsertMessageRequest,
    FetchRecordsParams,
    ManageApiKeyResponse,
    AddApiKeyParams,
    RemoveApiKeyParams,
    ApiKeyScope,
} from "./types";

const Client = FluxionDBClient;

export default FluxionDBClient;

export {
    FluxionDBClient,
    Client,
    CollectionsResponse,
    FetchLatestRecordsParams,
    QueryResponse,
    DeleteCollectionParams,
    InsertMessageResponse,
    QueryCollectionResponse,
    DeleteRecord,
    DeleteDocumentParams,
    SetValueParams,
    GetValueParams,
    KeyValueResponse,
    KeyValueAllKeysResponse,
    KeyValueAllValuesResponse,
    CollectionParam,
    DeleteValueParams,
    InsertMessageRequest,
    FetchRecordsParams,
    ManageApiKeyResponse,
    AddApiKeyParams,
    RemoveApiKeyParams,
    ApiKeyScope,
};
