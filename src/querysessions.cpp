#include "querysessions.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonParseError>
#include <QDebug>

QuerySessions QuerySessions::fromJson(const QString& jsonString, bool* ok)
{
    QuerySessions payload;
    QJsonParseError error;
    QJsonDocument doc = QJsonDocument::fromJson(jsonString.toUtf8(), &error);
    
    if (error.error != QJsonParseError::NoError) {
        qWarning() << "JSON parse error:" << error.errorString();
        if (ok) *ok = false;
        return payload;
    }

    if (!doc.isObject()) {
        qWarning() << "JSON is not an object";
        if (ok) *ok = false;
        return payload;
    }

    QJsonObject obj = doc.object();
    
    payload.ts = obj["ts"].toVariant().toLongLong();
    payload.key = obj["key"].toString();
    payload.collection = obj["collection"].toString();

    if (ok) *ok = payload.isValid();
    return payload;
}

bool QuerySessions::isValid() const
{
    return ts > 0 && !collection.isEmpty();
} 