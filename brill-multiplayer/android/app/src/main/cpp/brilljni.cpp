#include <jni.h>
#include <string>
#include "libbrillprotocol.h"

namespace {
class UTFChars {
  JNIEnv *env;
  jstring value;
  const char *chars;
public:
  UTFChars(JNIEnv *env, jstring value):env(env),value(value),chars(value?env->GetStringUTFChars(value,nullptr):nullptr){}
  ~UTFChars(){if(chars)env->ReleaseStringUTFChars(value,chars);}
  const char *get()const{return chars?chars:"";}
};
std::string getAndRelease(char *(*cb)()) {
    char *p=cb(); if(!p) return "";
    std::string result(p);BrillRelease(p);return result;
}
}
extern "C" JNIEXPORT jint JNICALL
Java_city_brill_multiplayer_NativeBridge_nativeConnect(JNIEnv *env,jobject,jstring addr,jstring nick){
 UTFChars a(env,addr),n(env,nick);
 return BrillStart((char*)a.get(),(char*)n.get());
}
extern "C" JNIEXPORT void JNICALL
Java_city_brill_multiplayer_NativeBridge_nativeDisconnect(JNIEnv *,jobject){BrillStop();}
extern "C" JNIEXPORT jstring JNICALL
Java_city_brill_multiplayer_NativeBridge_nativeState(JNIEnv *env,jobject){return env->NewStringUTF(getAndRelease(BrillState).c_str());}
extern "C" JNIEXPORT jstring JNICALL
Java_city_brill_multiplayer_NativeBridge_nativeNextEvent(JNIEnv *env,jobject){return env->NewStringUTF(getAndRelease(BrillNextEvent).c_str());}
extern "C" JNIEXPORT jint JNICALL
Java_city_brill_multiplayer_NativeBridge_nativeCommand(JNIEnv *env,jobject,jstring str){UTFChars s(env,str);return BrillCommand((char*)s.get());}
extern "C" JNIEXPORT jint JNICALL
Java_city_brill_multiplayer_NativeBridge_nativeChat(JNIEnv *env,jobject,jstring str){UTFChars s(env,str);return BrillChat((char*)s.get());}
extern "C" JNIEXPORT jint JNICALL
Java_city_brill_multiplayer_NativeBridge_nativeDialog(JNIEnv *env,jobject,jshort id,jint button,jshort item,jstring input){UTFChars s(env,input);return BrillRespondDialog(id,(unsigned char)button,item,(char*)s.get());}