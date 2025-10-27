#ifndef COLLECTION_H
#define COLLECTION_H

#include <QString>
#include <unordered_map>
#include <vector>
#include <QHash>
#include <memory>
#include "datarecord.h"

class Collection {
public:
    explicit Collection(const QString& name, const QString& dataFolder);
    ~Collection();

    void insert(qint64 timestamp, const QString& key, const QString& data);
    DataRecord* getLatestRecordForDocument(const QString& key, qint64 timestamp);
    DataRecord* getEarliestRecordForDocument(const QString& key, qint64 timestamp);
    QHash<QString, DataRecord*> getAllRecords(qint64 timestamp, const QString& key, qint64 from = 0);
    QList<DataRecord*> getAllRecordsForDocument(const QString& key, qint64 from, qint64 to, bool reverse = false, qint64 limit = 0);
    QHash<QString, QList<DataRecord*>> getSessionData(qint64 from, qint64 to);
    
    void setValueForKey(const QString& key, const QString& value);
    QString getValueForKey(const QString& key);
    void removeValueForKey(const QString& key);
    QHash<QString, QString> getAllValues();
    QList<QString> getAllKeys();


    void clearDocument(const QString& key);
    void deleteRecord(const QString& key, qint64 ts);
    void flushToDisk();
    void loadFromDisk();
    bool isEmpty() const {
        return m_data.empty();
    }

private:
    void insert(qint64 timestamp, const QString& key, const QString& data, bool isNew);
    int getLatestRecordIndex(const std::vector<std::unique_ptr<DataRecord>>& records, qint64 timestamp);
    int getEarliestRecordIndex(const std::vector<std::unique_ptr<DataRecord>>& records, qint64 timestamp);
    
    QString m_name;
    std::unordered_map<QString, std::vector<std::unique_ptr<DataRecord>>> m_data;
    std::unordered_map<QString, std::string> m_key_vaue;
    qint64 m_key_vaue_updated;
    qint64 m_flushed;
    QString m_dataFolder;
};

#endif // COLLECTION_H 
