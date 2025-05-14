#ifndef KEYVALUE_H
#define KEYVALUE_H

#include <QString>

struct KeyValue {
    QString key;
    QString value;
    QString collection;
    
    static KeyValue fromJson(const QString& jsonString, bool* ok = nullptr);
    bool isValid() const;
    bool hasValue() const;
    bool hasKey() const;
};

#endif // KEYVALUE_H 