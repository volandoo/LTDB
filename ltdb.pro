QT -= gui
QT += core websockets

CONFIG += c++17 console
CONFIG -= app_bundle

SOURCES += \
    src/insertrequest.cpp \
    src/datarecord.cpp \
    src/main.cpp \
    src/messagerequest.cpp \
    src/deleteuser.cpp \
    src/querysessions.cpp \
    src/queryuser.cpp \
    src/websocket.cpp \
    src/collection.cpp \
    src/deletecollection.cpp \
    src/keyvalue.cpp \
    src/deleterecord.cpp \
    src/deletemultiplerecords.cpp

HEADERS += \
    src/insertrequest.h \
    src/datarecord.h \
    src/datarecordheader.h \
    src/message.h \
    src/messagerequest.h \
    src/deleteuser.h \
    src/querysessions.h \
    src/queryuser.h \
    src/websocket.h \
    src/collection.h \
    src/deletecollection.h \ 
    src/keyvalue.h \
    src/deleterecord.h \
    src/deletemultiplerecords.h \
    src/json/json.hpp

