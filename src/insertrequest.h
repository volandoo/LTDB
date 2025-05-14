#ifndef INSERTREQUEST_H
#define INSERTREQUEST_H

#include <QString>
#include <QList>
struct InsertRequest {
    qint64 ts;
    QString key;
    QString data;
    QString collection;
    
    static QList<InsertRequest> fromJson(const QString& jsonString, bool* ok = nullptr);
    bool isValid() const;
};

#endif // INSERTREQUEST_H 