#include "querysessionsresponse.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>

QJsonObject  QuerySessionsResponse::toJson() const
{
    QJsonObject dataObj;
    foreach (const QString& key, records.keys()) {
        dataObj[key] = records[key]->toJson();
    }
    
    QJsonObject obj;
    obj["id"] = id;
    obj["records"] = dataObj;

    return obj;
}

QString QuerySessionsResponse::toString() const
{
    QJsonDocument doc(toJson());
    return doc.toJson(QJsonDocument::Compact);
}