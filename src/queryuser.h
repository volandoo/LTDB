#ifndef QUERYUSER_H
#define QUERYUSER_H

#include <QString>

struct QueryUser {
    qint64 from;
    qint64 to;
    qint64 limit;
    bool reverse;
    QString key;
    QString collection;

    
    static QueryUser fromJson(const QString& jsonString, bool* ok = nullptr);
    bool isValid() const;
};

#endif // QUERYUSER_H 