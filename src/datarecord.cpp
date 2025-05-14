#include "datarecord.h"
#include <QJsonDocument>
#include <QJsonObject>

QJsonObject DataRecord::toJson() const
{
    QJsonObject obj;
    obj["ts"] = timestamp;
    obj["data"] = QString::fromStdString(data);
    
    return obj;
} 


QString DataRecord::toString() const
{
    QJsonDocument doc(toJson());
    return doc.toJson(QJsonDocument::Compact);
} 

