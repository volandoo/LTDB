#include "deletedocument.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonParseError>
#include <QDebug>

DeleteDocument DeleteDocument::fromJson(const QString& jsonString, bool* ok)
{
    DeleteDocument query;
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
    query.doc = obj["doc"].toString();
    query.col = obj["col"].toString();

    if (ok) *ok = query.isValid();
    return query;
}

bool DeleteDocument::isValid() const
{
    return !doc.isEmpty();
} 
