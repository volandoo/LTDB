#include "collection.h"
#include <QJsonObject>
#include <QJsonArray>
#include <QJsonDocument>
#include <QDir>
#include <QFile>
#include <QDebug>
#include <algorithm>
#include <iterator>
#include <utility>

#include "json/json.hpp"

#ifdef __linux__ 
#include <malloc.h>
#endif

using json = nlohmann::json_abi_v3_11_3::json;

Collection::Collection(const QString &name, const QString &dataFolder)
{
    m_name = name;
    m_dataFolder = dataFolder;
    m_key_vaue_updated = 0;
    m_flushed = 0;
}

Collection::~Collection() {
    m_data.clear();
    m_data.rehash(0);
#ifdef __linux__
    malloc_trim(0);
#endif
    if (!m_dataFolder.isEmpty()) {
        QDir dir(m_dataFolder + "/" + m_name);
        if (dir.exists()) {
            dir.removeRecursively();
        }
    }
    qInfo() << "Collection deleted from memory" << m_name;    
}

void Collection::insert(qint64 timestamp, const QString &key, const QString &data)
{
    insert(timestamp, key, data, true);
}

void Collection::insert(qint64 timestamp, const QString &key, const QString &data, bool isNew)
{
    // Create new record
    auto record = std::make_unique<DataRecord>();
    record->timestamp = timestamp;
    record->data = data.toStdString();
    record->isNew = isNew;

    // Get or create vector for this key
    auto it = m_data.find(key);
    if (it == m_data.end())
    {
        std::vector<std::unique_ptr<DataRecord>> newVector;
        newVector.push_back(std::move(record));
        m_data.emplace(key, std::move(newVector));
        return;
    }

    auto &records = it->second;
    if (records.empty())
    {
        records.push_back(std::move(record));
        return;
    }

    // Find the position to insert using binary search
    auto vecIt = std::lower_bound(records.begin(), records.end(), timestamp,
                                  [](const std::unique_ptr<DataRecord> &a, qint64 b)
                                  {
                                      return a->timestamp < b;
                                  });

    // Check if we found a record with the same timestamp
    if (vecIt != records.end() && (*vecIt)->timestamp == timestamp)
    {
        *vecIt = std::move(record); // Replace existing record
    }
    else
    {
        records.insert(vecIt, std::move(record)); // Insert at the correct position
    }
}

DataRecord *Collection::getLatestRecordForDocument(const QString &key, qint64 timestamp)
{
    auto it = m_data.find(key);
    if (it == m_data.end())
    {
        return nullptr;
    }

    const int index = getLatestRecordIndex(it->second, timestamp);
    if (index == -1)
    {
        return nullptr;
    }

    return it->second[index].get();
}

DataRecord *Collection::getEarliestRecordForDocument(const QString &key, qint64 timestamp)
{
    auto it = m_data.find(key);
    if (it == m_data.end())
    {
        return nullptr;
    }

    const int index = getEarliestRecordIndex(it->second, timestamp);
    if (index == -1)
    {
        return nullptr;
    }

    return it->second[index].get();
}

QHash<QString, DataRecord *> Collection::getAllRecords(qint64 timestamp, const QString &key, qint64 from)
{
    QHash<QString, DataRecord *> result;
    if (key.isEmpty())
    {
        for (const auto &[key, records] : m_data)
        {
            const int index = getLatestRecordIndex(records, timestamp);
            if (index != -1)
            {
                auto record = records[index].get();
                if (from == 0 || record->timestamp >= from) {
                    result.insert(key, record);
                }
            }
        }
    }
    else
    {
        auto it = m_data.find(key);
        if (it == m_data.end())
        {
            return result;
        }
        const int index = getLatestRecordIndex(it->second, timestamp);
        if (index != -1)
        {
            auto record = it->second[index].get();
            if (from == 0 || record->timestamp >= from) {
                result.insert(key, record);
            }
        }
    }
    return result;
}

QHash<QString, QList<DataRecord *>> Collection::getSessionData(qint64 from, qint64 to)
{
    QHash<QString, QList<DataRecord *>> result;
    for (const auto &[key, records] : m_data)
    {
        if (from > to)
        {
            continue;
        }
        const int startIndex = getEarliestRecordIndex(records, from);
        if (startIndex == -1)
        {
            continue;
        }
        const int endIndex = getLatestRecordIndex(records, to);
            if (endIndex == -1)
        {
            continue;
        }
        for (int i = startIndex; i <= endIndex; ++i)
        {
            result[key].append(records[i].get());
        }
    }
    return result;
}

QList<DataRecord *> Collection::getAllRecordsForDocument(const QString &key, qint64 from, qint64 to, bool reverse, qint64 limit)
{
    QList<DataRecord *> result;
    auto it = m_data.find(key);
    if (it == m_data.end())
    {
        return result;
    }

    if (from > to)
    {
        return result;
    }

    const int startIndex = getEarliestRecordIndex(it->second, from);
    if (startIndex == -1)
    {
        return result;
    }

    const int endIndex = getLatestRecordIndex(it->second, to);
    if (endIndex == -1)
    {
        return result;
    }

    for (int i = startIndex; i <= endIndex; ++i)
    {
        result.append(it->second[i].get());
    }

    if (reverse)
    {
        std::reverse(result.begin(), result.end());
    }

    if (limit > 0 && result.size() > limit)
    {
        result.resize(limit);
    }

    return result;
}

void Collection::clearDocument(const QString &key)
{
    auto it = m_data.find(key);
    if (it != m_data.end())
    {
        std::vector<std::unique_ptr<DataRecord>>{}.swap(it->second);
        m_data.erase(it);
        m_data.rehash(0);
#ifdef __linux__
        malloc_trim(0);
#endif
        // delete from disc if persistence is enabled
        if (!m_dataFolder.isEmpty()) {
            QDir dir(m_dataFolder + "/" + m_name + "/" + key);
            if (dir.exists()) {
                dir.removeRecursively();
            }
        }

        qInfo() << "Document deleted from memory" << m_name << ":" << key;
    }
}

void Collection::deleteRecord(const QString &key, qint64 ts)
{
    auto it = m_data.find(key);
    if (it == m_data.end()) {
        return;
    }
    auto &records = it->second;
    auto vecIt = std::lower_bound(records.begin(), records.end(), ts,
                                  [](const std::unique_ptr<DataRecord> &a, qint64 b)
                                  {
                                      return a->timestamp < b;
                                  });   
    if (vecIt == records.end() || (*vecIt)->timestamp != ts) {
        return;
    }
    records.erase(vecIt);
    if (records.empty()) {
        std::vector<std::unique_ptr<DataRecord>>{}.swap(records);
        m_data.erase(it);
        m_data.rehash(0);
#ifdef __linux__
        malloc_trim(0);
#endif
        return;
    }    

    const auto capacity = records.capacity();
    const auto size = records.size();
    if (capacity > 0 && size * 2 < capacity)
    {
        std::vector<std::unique_ptr<DataRecord>> compacted;
        compacted.reserve(size);
        std::move(records.begin(), records.end(), std::back_inserter(compacted));
        records.swap(compacted);
#ifdef __linux__
        malloc_trim(0);
#endif
    }
}

void Collection::deleteRecordsInRange(const QString &key, qint64 fromTs, qint64 toTs)
{
    auto it = m_data.find(key);
    if (it == m_data.end()) {
        return;
    }
    auto &records = it->second;
    
    // Find the first record >= fromTs
    auto beginIt = std::lower_bound(records.begin(), records.end(), fromTs,
                                    [](const std::unique_ptr<DataRecord> &a, qint64 b)
                                    {
                                        return a->timestamp < b;
                                    });
    
    // Find the first record > toTs
    auto endIt = std::upper_bound(records.begin(), records.end(), toTs,
                                  [](qint64 b, const std::unique_ptr<DataRecord> &a)
                                  {
                                      return b < a->timestamp;
                                  });
    
    if (beginIt == records.end() || beginIt >= endIt) {
        return;
    }
    
    records.erase(beginIt, endIt);
    
    if (records.empty()) {
        std::vector<std::unique_ptr<DataRecord>>{}.swap(records);
        m_data.erase(it);
        m_data.rehash(0);
#ifdef __linux__
        malloc_trim(0);
#endif
        return;
    }
    
    const auto capacity = records.capacity();
    const auto size = records.size();
    if (capacity > 0 && size * 2 < capacity)
    {
        std::vector<std::unique_ptr<DataRecord>> compacted;
        compacted.reserve(size);
        std::move(records.begin(), records.end(), std::back_inserter(compacted));
        records.swap(compacted);
#ifdef __linux__
        malloc_trim(0);
#endif
    }
}

int Collection::getLatestRecordIndex(const std::vector<std::unique_ptr<DataRecord>> &records, qint64 timestamp)
{
    if (records.empty())
    {
        return -1;
    }

    auto vecIt = std::upper_bound(records.begin(), records.end(), timestamp,
                                  [](qint64 b, const std::unique_ptr<DataRecord> &a)
                                  {
                                      return b < a->timestamp;
                                  });

    if (vecIt == records.begin())
    {
        if (records.front()->timestamp > timestamp)
        {
            return -1;
        }
    }
    else
    {
        --vecIt;
    }

    return vecIt - records.begin();
}

int Collection::getEarliestRecordIndex(const std::vector<std::unique_ptr<DataRecord>> &records, qint64 timestamp)
{
    if (records.empty())
    {
        return -1;
    }

    auto vecIt = std::lower_bound(records.begin(), records.end(), timestamp,
                                  [](const std::unique_ptr<DataRecord> &a, qint64 b)
                                  {
                                      return a->timestamp < b;
                                  });

    if (vecIt == records.end())
    {
        return -1;
    }

    return vecIt - records.begin();
}

// key value methods

void Collection::setValueForKey(const QString &key, const QString &value)
{
    m_key_vaue[key] = value.toStdString();
    m_key_vaue_updated = QDateTime::currentMSecsSinceEpoch();
}

QString Collection::getValueForKey(const QString &key)
{
    auto it = m_key_vaue.find(key);
    if (it == m_key_vaue.end())
    {
        return "";
    }
    return QString::fromStdString(it->second);
}

void Collection::removeValueForKey(const QString &key)
{
    m_key_vaue.erase(key);
    m_key_vaue.rehash(0);
#ifdef __linux__
    malloc_trim(0);
#endif
    m_key_vaue_updated = QDateTime::currentMSecsSinceEpoch();
}

QHash<QString, QString> Collection::getAllValues()
{
    QHash<QString, QString> result;
    for (auto &[key, value] : m_key_vaue)
    {
        result.insert(key, QString::fromStdString(value));
    }
    return result;
}

QList<QString> Collection::getAllKeys()
{
    QList<QString> result;
    for (auto &[key, value] : m_key_vaue)
    {
        result.append(key);
    }
    return result;
}

void Collection::flushToDisk()
{
    if (m_dataFolder.isEmpty()) {
        return; // Skip if persistence is disabled
    }
    
    qDebug() << "Flushing collection to disk" << m_name;
    // fluxiondb data
    QDir dir;
    dir.mkpath(m_dataFolder + "/" + m_name);
    for(auto & each : m_data) {
        auto key = each.first;
        auto &records = each.second;

        auto arr = json::array();
        for(auto & record : records) {
            if (!record->isNew) {
                continue;
            }
            auto obj = json::object();
            obj["ts"] = record->timestamp;
            obj["data"] = record->data;
            arr.push_back(obj);
            record->isNew = false;
        }
        if (arr.empty()) {
            continue;
        }
        dir.mkpath(m_dataFolder + "/" + m_name + "/" + key);
        auto now = QString::number(QDateTime::currentMSecsSinceEpoch());
        QFile file(m_dataFolder + "/" + m_name + "/" + key + "/"+ now + ".json");
        if (file.open(QIODevice::WriteOnly | QIODevice::Text)) {
            file.write(json(arr).dump().c_str());
            file.close();
        }
    }

    // if no key value update, skip next code:
    if (m_key_vaue_updated > m_flushed) {    
        // store key_value in data folder
        QFile file(m_dataFolder + "/" + m_name + "/key_value.json");
        qDebug() << "Flushing key_value to disk" << m_dataFolder + "/" + m_name + "/key_value.json";
        if (file.open(QIODevice::WriteOnly | QIODevice::Text)) {
            std::unordered_map<std::string, std::string> kv;
            for(auto &[key, value] : m_key_vaue) {
                kv[key.toStdString()] = value;
            }
            file.write(json(kv).dump().c_str());
            file.close();
        }
        qDebug() << "Done flushing collection to disk" << m_name;
    }
    m_flushed = QDateTime::currentMSecsSinceEpoch();
}

void Collection::loadFromDisk()
{
    if (m_dataFolder.isEmpty()) {
        return; // Skip if persistence is disabled
    }
    
    qDebug() << "Loading collection from disk" << m_name;
    QDir dir(m_dataFolder + "/" + m_name);
    if (!dir.exists()) {
        qDebug() << "Collection does not exist" << m_name;
        return;
    }
    for (const QFileInfo &info : dir.entryInfoList(QDir::Dirs | QDir::NoDotAndDotDot)) {
        auto key = info.fileName();
        QDir dir(m_dataFolder + "/" + m_name + "/" + key);
        if (!dir.exists()) {
            qDebug() << "Collection does not exist" << m_name << key;
            continue;
        }
        for (const QFileInfo &info : dir.entryInfoList(QDir::Files | QDir::NoDotAndDotDot, QDir::Time | QDir::Reversed)) {
            auto fileName = info.fileName();
            QFile file(m_dataFolder + "/" + m_name + "/" + key + "/" + fileName);
            if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
                qDebug() << "Failed to open file" << fileName;
                continue;
            }
            auto data = file.readAll();
            auto arr = json::parse(data.toStdString());
            for(auto & record : arr) {
                std::string data = record["data"];
                qint64 ts = record["ts"];
                insert(ts, key, QString(data.c_str()), false);
            }
            file.close();
        }
    }
    QFile file(m_dataFolder + "/" + m_name + "/key_value.json");
    if (file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        auto data = file.readAll();
        auto kv = json::parse(data.toStdString());
        for(auto &[key, value] : kv.items()) {
            m_key_vaue[QString(key.c_str())] = value;
        }
        file.close();
    }    
    qDebug() << "Done loading collection from disk" << m_name;
}
