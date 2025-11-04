#include "keyvalue.h"
#include <QJsonDocument>
#include <QJsonObject>

KeyValue KeyValue::fromJson(const QString& jsonString, bool* ok)
{
    KeyValue kv;
    QJsonDocument doc = QJsonDocument::fromJson(jsonString.toUtf8());
    if (!doc.isObject()) {
        if (ok) *ok = false;
        return kv;
    }
    QJsonObject obj = doc.object();
    kv.key = obj["key"].toString();
    kv.value = obj["value"].toString();
    kv.col = obj["col"].toString();
    if (ok) *ok = kv.isValid();
    return kv;
}

bool KeyValue::isValid() const
{
    return !col.isEmpty();
}

bool KeyValue::hasKey() const
{
    return !key.isEmpty();
}

bool KeyValue::hasValue() const
{
    return !value.isEmpty();
}