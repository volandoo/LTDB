#ifndef QUERYDELETECOLLECTION_H
#define QUERYDELETECOLLECTION_H

#include <QString>

struct DeleteCollection {
    QString col;
    
    static DeleteCollection fromJson(const QString& jsonString, bool* ok = nullptr);
    bool isValid() const;
};

#endif // QUERYDELETECOLLECTION_H 