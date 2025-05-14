#ifndef QUERYDELETEUSER_H
#define QUERYDELETEUSER_H

#include <QString>

struct DeleteUser {
    QString key;
    QString collection;
    
    static DeleteUser fromJson(const QString& jsonString, bool* ok = nullptr);
    bool isValid() const;
};

#endif // QUERYDELETEUSER_H 