#ifndef QUERYSESSIONSRESPONSE_H
#define QUERYSESSIONSRESPONSE_H

#include <QString>
#include <QHash>
#include <QJsonObject>
#include "datarecord.h"

struct QuerySessionsResponse {
    QString id;
    QHash<QString, DataRecord*> records;

    QJsonObject toJson() const;
    QString toString() const;
};

#endif // QUERYSESSIONSRESPONSE_H 