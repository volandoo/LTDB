
#include "deleterecord.h"
#include <QJsonDocument>
#include <QJsonObject>



DeleteRecord DeleteRecord::fromJsonObject(const QJsonObject& jsonObject, bool* ok) {

    DeleteRecord query;
    query.doc = jsonObject["doc"].toString();
    query.col = jsonObject["col"].toString();
    query.ts = jsonObject["ts"].toVariant().toLongLong();
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
    if (doc.isEmpty()) {
        qWarning() << "doc is empty";
        return false;
    }
    if (col.isEmpty()) {
        qWarning() << "col is empty";
        return false;
    }
    if (ts <= 0) {
        qWarning() << "ts is not positive";
        return false;
    }
    return true;
}
