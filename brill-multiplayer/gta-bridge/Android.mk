LOCAL_PATH := $(call my-dir)
include $(CLEAR_VARS)
LOCAL_MODULE := brillgtabridge
LOCAL_SRC_FILES := src/main.cpp
LOCAL_C_INCLUDES := $(LOCAL_PATH)/vendor/aml
LOCAL_CPPFLAGS := -std=c++17 -O2 -Wall -Wextra -fvisibility=hidden
LOCAL_LDLIBS := -llog -ldl
include $(BUILD_SHARED_LIBRARY)