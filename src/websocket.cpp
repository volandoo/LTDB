#include "websocket.h"
#include <QDebug>
#include <QList>
#include <QJsonObject>
#include <QJsonArray>
#include <QJsonDocument>
#include <QDir>
#include <QTime>
#include <QElapsedTimer>
#include <QUuid>
#include "insertrequest.h"
#include "querysessions.h"
#include "queryuser.h"
#include "deleteuser.h"
#include "deletecollection.h"
#include "keyvalue.h"
#include "deleterecord.h"
#include "deletemultiplerecords.h"


WebSocket::WebSocket(const QString &secretKey, const QString &dataFolder, int flushIntervalSeconds, QObject *parent) : QObject(parent)
{
    m_secretKey = secretKey;
    m_dataFolder = dataFolder;
    m_server = new QWebSocketServer(QStringLiteral("WebSocket Server"), QWebSocketServer::NonSecureMode, this);
    
    if (m_dataFolder.isEmpty()) {
        qInfo() << "Running in non-persistent mode (no data folder specified)";
        return;
    }
    qInfo() << "Running in persistent mode (data folder specified):" << m_dataFolder;
    qInfo() << "Flush interval set to" << flushIntervalSeconds << "seconds";
    m_flushTimer.start(flushIntervalSeconds * 1000);
    connect(&m_flushTimer, &QTimer::timeout, this, &WebSocket::flushToDisk);

    // get collections from data folder
    QDir dir(m_dataFolder);
    if (dir.exists())
    {
        foreach (const QString &collection, dir.entryList(QDir::Dirs | QDir::NoDotAndDotDot))
        {
            m_databases[collection] = std::make_unique<Collection>(collection, m_dataFolder);
            m_databases[collection]->loadFromDisk();
        }
    }
}

WebSocket::~WebSocket()
{
    m_server->close();
    qDeleteAll(m_clients.begin(), m_clients.end());
}

void WebSocket::flushToDisk()
{
    if (m_dataFolder.isEmpty()) {
        return; // Skip persistence if no data folder specified
    }
    
    for (auto &[key, value] : m_databases)
    {
        value->flushToDisk();
    }
}

void WebSocket::start(quint16 port)
{
    if (m_server->listen(QHostAddress::Any, port))
    {
        qInfo() << QTime::currentTime().toString() << "WebSocket server listening on port" << port;
        connect(m_server, &QWebSocketServer::newConnection, this, &WebSocket::onNewConnection);
    }
    else
    {
        qFatal("Failed to start WebSocket server");
    }
}

void WebSocket::onNewConnection()
{
    QWebSocket *socket = m_server->nextPendingConnection();
    socket->setObjectName(QUuid::createUuid().toString());
    qInfo() << QTime::currentTime().toString() << "New client connected:" << socket->peerAddress().toString() << "ID" << socket->objectName();
    connect(socket, &QWebSocket::textMessageReceived, this, &WebSocket::processMessage);
    connect(socket, &QWebSocket::disconnected, this, &WebSocket::socketDisconnected);
    m_clients << socket;
}

void WebSocket::processMessage(const QString &message)
{
    QWebSocket *client = qobject_cast<QWebSocket *>(sender());
    if (!client) { return; }
        
    bool ok;
    MessageRequest msg = MessageRequest::fromJson(message, &ok);

    if (!ok)
    {
        qWarning() << QTime::currentTime().toString() << "Invalid message" << message;
        client->sendTextMessage("");
        client->close();
        return;
    }

    if (msg.type == "api-key")
    {
        bool isAuthenticated = msg.data == m_secretKey;
        m_isAuthenticated[client->objectName()] = isAuthenticated;
        if (!isAuthenticated)
        {
            qWarning() << QTime::currentTime().toString() << "Unauthenticated client:" << client->peerAddress().toString();
            client->close();
            return;
        }
        QJsonObject obj;
        obj["id"] = msg.id;
        QJsonDocument doc(obj);
        client->sendTextMessage(doc.toJson(QJsonDocument::Compact));
        return;
    }

    if (!m_isAuthenticated[client->objectName()])
    {
        qWarning() << QTime::currentTime().toString() << "Unauthenticated client:" << client->peerAddress().toString();
        client->close();
        return;
    }

    handleMessage(client, msg);
}

void WebSocket::handleMessage(QWebSocket *client, const MessageRequest &message)
{
    QString response;
       
    if (message.type == "insert")
    {
        response = handleInsert(client, message);
    }
    else if (message.type == "query")
    {
        response = handleQuerySessions(client, message);
    }
    else if (message.type == "collections")
    {
        response = handleQueryCollections(client, message);
    }
    else if (message.type == "query-user")
    {
        response = handleQueryUser(client, message);
    }
    else if (message.type == "delete-user")
    {
        response = handleDeleteUser(client, message);
    }
    else if (message.type == "delete-collection")
    {
        response = handleDeleteCollection(client, message);
    }
    else if (message.type == "delete-record")
    {
        response = handleDeleteRecord(client, message);
    }
    else if (message.type == "delete-multiple-records")
    {
        response = handleDeleteMultipleRecords(client, message);
    }
    else if (message.type == "set-value")
    {
        response = handleSetValue(client, message);
    }
    else if (message.type == "get-value")
    {
        response = handleGetValue(client, message);
    }
    else if (message.type == "remove-value")
    {
        response = handleRemoveValue(client, message);
    }
    else if (message.type == "get-all-values")
    {
        response = handleGetAllValues(client, message);
    }
    else if (message.type == "get-all-keys")
    {
        response = handleGetAllKeys(client, message);
    }
    else
    {
        qWarning() << "Unknown message type:" << message.type;
        client->sendTextMessage("{\"error\": \"Unknown message type\"}");
        client->close();
        return;
    }
    if (!response.isEmpty()) {
        if (client->state() != QAbstractSocket::ConnectedState)
        {
            qWarning() << QTime::currentTime().toString() << "Client disconnected:" << client->peerAddress().toString() << "ID" << client->objectName();
            return;
        }
        client->sendTextMessage(response);
    }
}

QString WebSocket::handleInsert(QWebSocket *client, const MessageRequest &message)
{
    bool ok;
    QList<InsertRequest> payloads = InsertRequest::fromJson(message.data, &ok);
    if (!ok)
    {
        qWarning() << "Invalid insert message format from" << client->peerAddress().toString();
        client->close();
        return "";
    }

    foreach (InsertRequest payload, payloads)
    {
        auto database = m_databases[payload.collection].get();
        if (database == nullptr)
        {
            m_databases[payload.collection] = std::make_unique<Collection>(payload.collection, m_dataFolder);
            database = m_databases[payload.collection].get();
        }
        database->insert(payload.ts, payload.key, payload.data);
    }

    QJsonObject obj;
    obj["id"] = message.id;
    QJsonDocument doc(obj);
    return doc.toJson(QJsonDocument::Compact);
}

QString WebSocket::handleQuerySessions(QWebSocket *client, const MessageRequest &message)
{
    bool ok;
    QuerySessions query = QuerySessions::fromJson(message.data, &ok);
    if (!ok)
    {
        qWarning() << "Invalid query sessions message format from" << client->peerAddress().toString();
        client->close();
        return "";
    }
    auto database = m_databases[query.collection].get();
    QJsonObject dataObj;
    QJsonObject obj;
    obj["id"] = message.id;
    if (database == nullptr)
    {
        m_databases.erase(query.collection);   
        obj["records"] = QJsonObject();
        QJsonDocument doc(obj);
        return doc.toJson(QJsonDocument::Compact);
    }
    auto records = database->getAllRecords(query.ts, query.key, query.from);

    foreach (const QString &key, records.keys())
    {
        dataObj[key] = records[key]->toJson();
    }

    obj["records"] = dataObj;

    QJsonDocument doc(obj);
    auto resp = doc.toJson(QJsonDocument::Compact);
    return resp;
}

QString WebSocket::handleQueryCollections(QWebSocket *client, const MessageRequest &message)
{
    QJsonObject obj;
    obj["id"] = message.id;

    QJsonArray recordsArray;
    for( auto &[key, value] : m_databases)
    {
        recordsArray.append(key);
    }
    obj["collections"] = recordsArray;
    QJsonDocument doc(obj);
    return doc.toJson(QJsonDocument::Compact);

}

QString WebSocket::handleQueryUser(QWebSocket *client, const MessageRequest &message)
{
    bool ok;
    QueryUser queryUser = QueryUser::fromJson(message.data, &ok);
    if (!ok)
    {
        qWarning() << "Invalid query user message format from" << client->peerAddress().toString();
        client->close();
        return "";
    }

    QJsonObject dataObj;
    auto database = m_databases[queryUser.collection].get();
    QJsonArray recordsArray;

    dataObj["id"] = message.id;
    if (database == nullptr)
    {
        m_databases.erase(queryUser.collection);   
        dataObj["records"] = recordsArray;
        QJsonDocument doc(dataObj);
        return doc.toJson(QJsonDocument::Compact);
    }
    auto records = database->getAllRecordsForUser(queryUser.key, queryUser.from, queryUser.to, queryUser.reverse, queryUser.limit);

    foreach (const DataRecord *record, records)
    {
        recordsArray.append(record->toJson());
    }
    dataObj["records"] = recordsArray;

    QJsonDocument doc(dataObj);
    return doc.toJson(QJsonDocument::Compact);
}

QString WebSocket::handleDeleteUser(QWebSocket *client, const MessageRequest &message)
{
    bool ok;
    DeleteUser query = DeleteUser::fromJson(message.data  , &ok);
    if (!ok)
    {
        qWarning() << "Invalid delete user message format from" << client->peerAddress().toString();
        client->close();
        return "";
    }
    QJsonObject obj;
    obj["id"] = message.id;
    QJsonDocument doc(obj);

    if (query.collection.isEmpty())
    {
        // delete from all collections
        QVector<QString> toErase;
        
        for (auto &[key, value] : m_databases)
        {
            value->clearUser(query.key);
            if (value->isEmpty())
            {
                toErase.append(key);
            }
        }
        
        // Now erase the empty collections
        foreach (const QString &key, toErase)
        {            
            qInfo() << "Deleting collection (1) since there are no more users:" << key;
            m_databases.erase(key);
        }
    }
    else
    {
        auto database = m_databases[query.collection].get();
        if (database == nullptr)
        {
            m_databases.erase(query.collection);   
            qWarning() << "Collection not found for collection:" << query.collection;
            return doc.toJson(QJsonDocument::Compact);
        }
        database->clearUser(query.key);
        
        if (database->isEmpty())
        {
            qInfo() << "Deleting collection (2) since there are no more users:" << query.collection;
            m_databases.erase(query.collection);
        }
    }
    return doc.toJson(QJsonDocument::Compact);
}

QString WebSocket::handleDeleteCollection(QWebSocket *client, const MessageRequest &message)
{
    bool ok;
    DeleteCollection query = DeleteCollection::fromJson(message.data, &ok);
    if (!ok)
    {
        qWarning() << "Invalid delete collection message format from" << client->peerAddress().toString();
        client->close();
        return "";
    }
    if (m_databases.find(query.collection) != m_databases.end())
    {
        m_databases.erase(query.collection);
    }

    QJsonObject obj;
    obj["id"] = message.id;
    QJsonDocument doc(obj);
    return doc.toJson(QJsonDocument::Compact);
}

QString WebSocket::handleDeleteRecord(QWebSocket *client, const MessageRequest &message)
{
    bool ok;
    DeleteRecord query = DeleteRecord::fromJson(message.data, &ok);
    if (!ok)
    {
        qWarning() << "Invalid delete record message format from" << client->peerAddress().toString();
        client->close();
        return "";
    }
    QJsonObject obj;
    obj["id"] = message.id;
    QJsonDocument doc(obj);

    auto database = m_databases[query.collection].get();
    if (database == nullptr)
    {        m_databases.erase(query.collection);
        return doc.toJson(QJsonDocument::Compact);
    }
    database->deleteRecord(query.key, query.ts);    
    return doc.toJson(QJsonDocument::Compact);
}

QString WebSocket::handleDeleteMultipleRecords(QWebSocket *client, const MessageRequest &message)
{
    bool ok;
    DeleteMultipleRecords query = DeleteMultipleRecords::fromJson(message.data, &ok);
    if (!ok)
    {
        qWarning() << "Invalid delete multiple records message format from" << client->peerAddress().toString();
        client->close();
        return "";
    }

    QJsonObject obj;
    obj["id"] = message.id;
    QJsonDocument doc(obj);
    foreach (const DeleteRecord &record, query.records)
    {
        auto database = m_databases[record.collection].get();
        if (database == nullptr)
        {
            m_databases.erase(record.collection);   
        } else {
            database->deleteRecord(record.key, record.ts);
        }
    }
    return doc.toJson(QJsonDocument::Compact);
}

QString WebSocket::handleSetValue(QWebSocket *client, const MessageRequest &message)
{
    bool ok;
    KeyValue kv = KeyValue::fromJson(message.data, &ok);
    if (!ok || !kv.isValid() || !kv.hasKey() || !kv.hasValue())
    {
        qWarning() << "Invalid set value message format from" << client->peerAddress().toString();
        client->close();
        return "";
    }

    auto collection = kv.collection;
    auto database = m_databases[collection].get();
    if (database == nullptr)
    {
        m_databases[collection] = std::make_unique<Collection>(collection, m_dataFolder);
        database = m_databases[collection].get();
    }
    
    database->setValueForKey(kv.key, kv.value);

    QJsonObject obj;
    obj["id"] = message.id;
    QJsonDocument doc(obj);
    return doc.toJson(QJsonDocument::Compact);
}

QString WebSocket::handleGetValue(QWebSocket *client, const MessageRequest &message)
{
    bool ok;
    KeyValue kv = KeyValue::fromJson(message.data, &ok);
    if (!ok || !kv.isValid() || !kv.hasKey())
    {
        qWarning() << "Invalid get value message format from" << client->peerAddress().toString();
        client->close();
        return "";
    }

    QJsonObject obj;
    obj["id"] = message.id;
    obj["value"] = "";

    auto collection = kv.collection;
    auto database = m_databases[collection].get();
    
    if (database == nullptr) {
        m_databases.erase(collection);
    } else {
        obj["value"] = database->getValueForKey(kv.key);
    }
    QJsonDocument doc(obj);
    return doc.toJson(QJsonDocument::Compact);
}

QString WebSocket::handleRemoveValue(QWebSocket *client, const MessageRequest &message)
{
    bool ok;
    KeyValue kv = KeyValue::fromJson(message.data, &ok);
    if (!ok || !kv.isValid() || !kv.hasKey())
    {
        qWarning() << "Invalid remove value message format from" << client->peerAddress().toString();
        client->close();
        return "";
    }

    auto collection = kv.collection;
    auto database = m_databases[collection].get();
    if (database == nullptr) {
        m_databases.erase(collection);        
    } else {
        database->removeValueForKey(kv.key);
    }

    QJsonObject obj;
    obj["id"] = message.id;
    QJsonDocument doc(obj);
    return doc.toJson(QJsonDocument::Compact);
}

QString WebSocket::handleGetAllValues(QWebSocket *client, const MessageRequest &message)
{
    bool ok;
    KeyValue kv = KeyValue::fromJson(message.data, &ok);
    if (!ok || !kv.isValid())
    {
        qWarning() << "Invalid get all values message format from" << client->peerAddress().toString();
        client->close();
        return "";
    }

    auto collection = kv.collection;
    auto database = m_databases[collection].get();
    QJsonObject valuesObj;
    
    if (database == nullptr) {
        m_databases.erase(collection);
    } else {
        auto values = database->getAllValues();
        for (auto it = values.begin(); it != values.end(); ++it)
        {
            valuesObj[it.key()] = it.value();
        }
    }

    QJsonObject obj;
    obj["id"] = message.id;
    obj["values"] = valuesObj;
    QJsonDocument doc(obj);
    return doc.toJson(QJsonDocument::Compact);
}

QString WebSocket::handleGetAllKeys(QWebSocket *client, const MessageRequest &message)
{
    bool ok;
    KeyValue kv = KeyValue::fromJson(message.data, &ok);
    if (!ok || !kv.isValid())
    {
        qWarning() << "Invalid get all keys message format from" << client->peerAddress().toString();
        client->close();
        return "";
    }

    auto collection = kv.collection;
    auto database = m_databases[collection].get();
    QJsonArray keysArray;
    
    if (database == nullptr) {
        m_databases.erase(collection);
    } else {
        auto keys = database->getAllKeys();
        foreach (const QString &key, keys)
        {
            keysArray.append(key);
        }
    }

    QJsonObject obj;
    obj["id"] = message.id;
    obj["keys"] = keysArray;
    QJsonDocument doc(obj);
    return doc.toJson(QJsonDocument::Compact);
}

void WebSocket::socketDisconnected()
{
    QWebSocket *client = qobject_cast<QWebSocket *>(sender());
    if (client)
    {
        qInfo() << QTime::currentTime().toString() << "Client disconnected:" 
                 << client->peerAddress().toString() << "ID" << client->objectName();
        m_isAuthenticated.erase(client->objectName());
        m_clients.removeAll(client);
        client->deleteLater();
    }
}
