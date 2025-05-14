#ifndef DELETEMULTIPLERECORDS_H
#define DELETEMULTIPLERECORDS_H

#include <QString>
#include <QList>
#include "deleterecord.h"

struct DeleteMultipleRecords {
    QList<DeleteRecord> records;
    static DeleteMultipleRecords fromJson(const QString& jsonString, bool* ok);
    bool isValid() const;
};

#endif