#ifndef DELETERECORDSRANGE_H
#define DELETERECORDSRANGE_H

#include <QString>
#include <QJsonObject>

struct DeleteRecordsRange {
    QString doc;
    QString col;
    qint64 fromTs;
    qint64 toTs;
    
    static DeleteRecordsRange fromJson(const QString& jsonString, bool* ok = nullptr);
    static DeleteRecordsRange fromJsonObject(const QJsonObject& jsonObject, bool* ok = nullptr);
    bool isValid() const;
};

#endif // DELETERECORDSRANGE_H

