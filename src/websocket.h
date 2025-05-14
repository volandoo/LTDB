#ifndef WEBSOCKET_H
#define WEBSOCKET_H

#include <QObject>
#include <QString>
#include <QList>
#include <QWebSocketServer>
#include <QWebSocket>
#include <QTimer>
#include <QStringList>
#include <unordered_map>
#include <memory>
#include <QDateTime>

#include "messagerequest.h"
#include "collection.h"

class WebSocket : public QObject
{
    Q_OBJECT

public:
    explicit WebSocket(const QString& secretKey, const QString& dataFolder, int flushIntervalSeconds = 15, QObject *parent = nullptr);
    ~WebSocket();

    void start(quint16 port = 8080);

private slots:
    void onNewConnection();
    void processMessage(const QString &message);
    void socketDisconnected();
    void flushToDisk();

private:
    void handleMessage(QWebSocket* client, const MessageRequest& message);
    
    QString handleQueryUser(QWebSocket* client, const MessageRequest& message);
    QString handleQuerySessions(QWebSocket* client, const MessageRequest& message);
    QString handleQueryCollections(QWebSocket* client, const MessageRequest& message);
    QString handleDeleteUser(QWebSocket* client, const MessageRequest& message);
    QString handleDeleteCollection(QWebSocket* client, const MessageRequest& message);
    QString handleDeleteRecord(QWebSocket* client, const MessageRequest& message);
    QString handleDeleteMultipleRecords(QWebSocket* client, const MessageRequest& message);
    QString handleInsert(QWebSocket* client, const MessageRequest& message);

    // key value
    QString handleSetValue(QWebSocket* client, const MessageRequest& message);
    QString handleGetValue(QWebSocket* client, const MessageRequest& message);
    QString handleRemoveValue(QWebSocket* client, const MessageRequest& message);
    QString handleGetAllValues(QWebSocket* client, const MessageRequest& message);
    QString handleGetAllKeys(QWebSocket* client, const MessageRequest& message);
    

    QWebSocketServer *m_server;
    QList<QWebSocket *> m_clients;
    
    // Configuration
    QString m_secretKey;
    QString m_dataFolder;

    // In-memory databases
    std::unordered_map<QString, std::unique_ptr<Collection>> m_databases;
    std::unordered_map<QString, bool> m_isAuthenticated;

    // flush timer
    QTimer m_flushTimer;
};

#endif // WEBSOCKET_H 
