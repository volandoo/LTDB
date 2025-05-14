#ifndef MESSAGE_H
#define MESSAGE_H

#include <QString>

struct Message {
    QString id;
    QString type;
    QString data;
    
    static Message fromJson(const QString& jsonString, bool* ok = nullptr);
    bool isValid() const;
};

#endif // MESSAGE_H 