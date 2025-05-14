#ifndef DELETERECORD_H
#define DELETERECORD_H

#include <QString>
#include <QJsonObject>
struct DeleteRecord {
    QString key;
    QString collection;
    qint64 ts;
    
    static DeleteRecord fromJson(const QString& jsonString, bool* ok = nullptr);
    static DeleteRecord fromJsonObject(const QJsonObject& jsonObject, bool* ok = nullptr);
    bool isValid() const;
};

#endif // DELETERECORD_H