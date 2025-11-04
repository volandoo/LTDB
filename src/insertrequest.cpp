#include "insertrequest.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QJsonParseError>
#include <QDebug>

QList<InsertRequest> InsertRequest::fromJson(const QString& jsonString, bool* ok)
{       
    QList<InsertRequest> payloads;
    QJsonParseError error;
    QJsonDocument doc = QJsonDocument::fromJson(jsonString.toUtf8(), &error);
    
    if (error.error != QJsonParseError::NoError) {
        qWarning() << "JSON parse error:" << error.errorString();
        if (ok) *ok = false;
        return payloads;
    }

    if (!doc.isArray()) {
        qWarning() << "JSON is not an array";
        if (ok) *ok = false;
        return payloads;
    }

    QJsonArray array = doc.array();
    foreach (const QJsonValue& value, array) {
        if (!value.isObject()) {
            qWarning() << "JSON is not an object";
            if (ok) *ok = false;
            return payloads;
        }
    
        QJsonObject obj = value.toObject();
        InsertRequest payload;
        payload.ts = obj["ts"].toVariant().toLongLong();
        payload.doc = obj["doc"].toString();
        payload.data = obj["data"].toString();
        payload.col = obj["col"].toString();
        payloads.append(payload);
    }

    if (ok) *ok = true;
    return payloads;
}

bool InsertRequest::isValid() const
{
    return ts > 0 && !doc.isEmpty() && !data.isEmpty() && !col.isEmpty();
} 
