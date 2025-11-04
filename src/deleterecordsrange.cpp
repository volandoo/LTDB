#include "deleterecordsrange.h"
#include <QJsonDocument>
#include <QJsonObject>

DeleteRecordsRange DeleteRecordsRange::fromJsonObject(const QJsonObject& jsonObject, bool* ok) {
    DeleteRecordsRange query;
    query.doc = jsonObject["doc"].toString();
    query.col = jsonObject["col"].toString();
    query.fromTs = jsonObject["fromTs"].toVariant().toLongLong();
    query.toTs = jsonObject["toTs"].toVariant().toLongLong();
    if (ok) *ok = true;
    return query;
}

DeleteRecordsRange DeleteRecordsRange::fromJson(const QString& jsonString, bool* ok) {
    DeleteRecordsRange query;
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

bool DeleteRecordsRange::isValid() const {
    if (doc.isEmpty()) {
        qWarning() << "doc is empty";
        return false;
    }
    if (col.isEmpty()) {
        qWarning() << "col is empty";
        return false;
    }
    if (fromTs <= 0) {
        qWarning() << "fromTs is not positive";
        return false;
    }
    if (toTs <= 0) {
        qWarning() << "toTs is not positive";
        return false;
    }
    if (fromTs > toTs) {
        qWarning() << "fromTs is greater than toTs";
        return false;
    }
    return true;
}

