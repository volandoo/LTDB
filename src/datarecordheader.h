#ifndef DATARECORDHEADER_H
#define DATARECORDHEADER_H

#include <QString>
#include <QList>
#include "datarecord.h"

struct DataRecordHeader {
    QList<DataRecord*> records;
    bool hasChanged;
};

#endif // DATARECORDHEADER_H 