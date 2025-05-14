
#include "deleterecord.h"
#include <QJsonDocument>
#include <QJsonObject>



DeleteRecord DeleteRecord::fromJsonObject(const QJsonObject& jsonObject, bool* ok) {

    DeleteRecord query;
    query.key = jsonObject["key"].toString();
    query.collection = jsonObject["collection"].toString();
    query.ts = jsonObject["ts"].toInt();
    if (ok) *ok = true;
    return query;
}

DeleteRecord DeleteRecord::fromJson(const QString& jsonString, bool* ok) {

    DeleteRecord query;
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

    return fromJsonObject(doc.object(), ok);

}
bool DeleteRecord::isValid() const {
    if (key.isEmpty()) {
        qWarning() << "key is empty";
        return false;
    }
    if (collection.isEmpty()) {
        qWarning() << "collection is empty";
        return false;
    }
    if (ts <= 0) {
        qWarning() << "ts is not positive";
        return false;
    }
    return true;
}