#include "deletecollection.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonParseError>
#include <QDebug>

DeleteCollection DeleteCollection::fromJson(const QString& jsonString, bool* ok)
{
    DeleteCollection query;
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
    query.collection = obj["collection"].toString();
    if (ok) *ok = query.isValid();
    return query;
}

bool DeleteCollection::isValid() const
{
    return !collection.isEmpty();
} 