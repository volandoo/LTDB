#include "messagerequest.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonParseError>
#include <QDebug>

MessageRequest MessageRequest::fromJson(const QString& jsonString, bool* ok)
{
    MessageRequest msg;
    QJsonParseError error;
    QJsonDocument doc = QJsonDocument::fromJson(jsonString.toUtf8(), &error);
    
    if (error.error != QJsonParseError::NoError) {
        qWarning() << "JSON parse error:" << error.errorString();
        if (ok) *ok = false;
        return msg;
    }

    if (!doc.isObject()) {
        qWarning() << "JSON is not an object";
        if (ok) *ok = false;
        return msg;
    }

    QJsonObject obj = doc.object();
    
    // Extract fields
    msg.id = obj["id"].toString();
    msg.type = obj["type"].toString();
    msg.data = obj["data"].toString();

    if (ok) *ok = msg.isValid();
    return msg;
}

bool MessageRequest::isValid() const
{
    return !id.isEmpty() && !type.isEmpty() && !data.isEmpty();
}