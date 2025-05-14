#include "deletemultiplerecords.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>


DeleteMultipleRecords DeleteMultipleRecords::fromJson(const QString& jsonString, bool* ok) {
    DeleteMultipleRecords query;
    QJsonParseError error;
    QJsonDocument doc = QJsonDocument::fromJson(jsonString.toUtf8(), &error);

    if (error.error != QJsonParseError::NoError) {
        qWarning() << "JSON parse error:" << error.errorString();
        if (ok) *ok = false;
        return query;
    }

    if (!doc.isArray()) {
        qWarning() << "JSON is not an array";
        if (ok) *ok = false;
        return query;
    }

    QJsonArray array = doc.array();
    for (const QJsonValue& value : array) {
        if (!value.isObject()) {
            qWarning() << "JSON is not an object";
            if (ok) *ok = false;
            return query;
        }
        QJsonObject obj = value.toObject();
        DeleteRecord record = DeleteRecord::fromJsonObject(obj, ok);
        if (!ok || !record.isValid()) {
            qWarning() << "Invalid delete record object";
            if (ok) *ok = false;
            return query;
        }
        query.records.append(record);
    }
    if (ok) *ok = true;
    return query;
}

bool DeleteMultipleRecords::isValid() const {
    return !records.isEmpty();
}
