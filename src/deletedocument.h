#ifndef DELETE_DOCUMENT_H
#define DELETE_DOCUMENT_H

#include <QString>

struct DeleteDocument {
    QString doc;
    QString col;
    
    static DeleteDocument fromJson(const QString& jsonString, bool* ok = nullptr);
    bool isValid() const;
};

#endif // DELETE_DOCUMENT_H 
