#ifndef MESSAGEREQUEST_H
#define MESSAGEREQUEST_H

#include <QString>

struct MessageRequest {
    QString id;
    QString type;
    QString data;
    
    static MessageRequest fromJson(const QString& jsonString, bool* ok = nullptr);
    bool isValid() const;
};

#endif // MESSAGEREQUEST_H 