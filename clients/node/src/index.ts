import FluxionDBClient from "./client";
import {
    LTDBCollectionsResponse,
    LTDBFetchLatestRecordsParams,
    LTDBQueryResponse,
    LTDBDeleteCollectionParams,
    LTDBInsertMessageResponse,
    LTDBQueryCollectionResponse,
    LTDBDeleteRecord,
    LTDBDeleteDocumentParams,
    LTDBSetValueParams,
    LTDBGetValueParams,
    LTDBKeyValueResponse,
    LTDBKeyValueAllKeysResponse,
    LTDBKeyValueAllValuesResponse,
    LTDBCollectionParam,
    LTDBDeleteValueParams,
    LTDBInsertMessageRequest,
    LTDBFetchRecordsParams,
    LTDBManageApiKeyResponse,
    LTDBAddApiKeyParams,
    LTDBRemoveApiKeyParams,
    LTDBApiKeyScope,
} from "./types";

const LTDBClient = FluxionDBClient;

export default FluxionDBClient;

export {
    FluxionDBClient,
    LTDBClient,
    LTDBCollectionsResponse,
    LTDBFetchLatestRecordsParams,
    LTDBQueryResponse,
    LTDBDeleteCollectionParams,
    LTDBInsertMessageResponse,
    LTDBQueryCollectionResponse,
    LTDBDeleteRecord,
    LTDBDeleteDocumentParams,
    LTDBSetValueParams,
    LTDBGetValueParams,
    LTDBKeyValueResponse,
    LTDBKeyValueAllKeysResponse,
    LTDBKeyValueAllValuesResponse,
    LTDBCollectionParam,
    LTDBDeleteValueParams,
    LTDBInsertMessageRequest,
    LTDBFetchRecordsParams,
    LTDBManageApiKeyResponse,
    LTDBAddApiKeyParams,
    LTDBRemoveApiKeyParams,
    LTDBApiKeyScope,
};
