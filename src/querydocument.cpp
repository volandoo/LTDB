#include "querydocument.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonParseError>
#include <QDebug>

QueryDocument QueryDocument::fromJson(const QString& jsonString, bool* ok)
{
    QueryDocument query;
    QJsonParseError error;
    QJsonDocument doc = QJsonDocument::fromJson(jsonString.toUtf8(), &error);
    
    if (error.error != QJsonParseError::NoError) {
        qWarning() << "JSON parse error:" << error.errorString();
        if (ok) *ok = false;
        return query;
    }

    if (!doc.isObject()) {
        qWarning() << "JSON is not an object";
        if (ok) *ok = false;
        return query;
    }

    QJsonObject obj = doc.object();    
    // Extract fields
    query.from = obj["from"].toVariant().toLongLong();
    query.to = obj["to"].toVariant().toLongLong();
    query.key = obj["key"].toString();
    query.collection = obj["collection"].toString();
    query.limit = obj["limit"].toVariant().toLongLong();
    query.reverse = obj["reverse"].toVariant().toBool();

    if (ok) *ok = query.isValid();
    return query;
}

bool QueryDocument::isValid() const
{
    return to > 0 && from <= to && !key.isEmpty() && !collection.isEmpty();
} 
