// BRILL MULTIPLAYER — Android GTA SA game-process native protocol bridge.
// No GTA engine binaries or assets are embedded in this module.
// The AML interfaces are MIT licensed; see vendor/aml/LICENSE_MIT.txt.
#include <mod/amlmod.h>
#include <android/log.h>
#include <dlfcn.h>
#include <cstring>
#include <mutex>

MYMOD(net.brill.multiplayer, BRILL Multiplayer GTA Integration, 0.1, Brill Team Project)
NEEDGAME(com.rockstargames.gtasa)

namespace {
using StartFn = int (*)(char *,char *);
using StopFn = void (*)();
using StateFn = char* (*)();
using ReleaseFn = void (*)(char*);

std::mutex lock;
void *core = nullptr;
StartFn start = nullptr;
StopFn stop = nullptr;
StateFn state = nullptr;
ReleaseFn release = nullptr;
bool gtaLoaded = false;
constexpr const char *TAG = "BRILL GTA Bridge";
void log(int priority,const char *message) {
    __android_log_print(priority,TAG,"%s",message);
}
void clearProtocol() {
    start = nullptr;stop = nullptr;state = nullptr;release = nullptr;
    if(core != nullptr) { dlclose(core);core=nullptr; }
}
bool loadProtocol() {
    if (core != nullptr) return start && stop && state && release;
    core = dlopen("libbrillprotocol.so",RTLD_NOW | RTLD_LOCAL);
    if(!core) {log(ANDROID_LOG_WARN,"BRILL protocol library not in GTA game process");return false;}
    start = reinterpret_cast<StartFn>(dlsym(core,"BrillStart"));
    stop = reinterpret_cast<StopFn>(dlsym(core,"BrillStop"));
    state = reinterpret_cast<StateFn>(dlsym(core,"BrillState"));
    release = reinterpret_cast<ReleaseFn>(dlsym(core,"BrillRelease"));
    if(start && stop && state && release) return true;
    log(ANDROID_LOG_ERROR,"BRILL protocol exports unavailable");
    clearProtocol();return false;
}
}

ON_MOD_LOAD() {
    std::lock_guard<std::mutex> guard(lock);
    if (aml == nullptr) {
        log(ANDROID_LOG_ERROR,"AndroidModLoader API is not available");return;
    }
    gtaLoaded = aml->GetLib("libGTASA.so") != 0;
    if(!gtaLoaded) {
        log(ANDROID_LOG_WARN,"GTA San Andreas native library not yet loaded");return;
    }
    log(ANDROID_LOG_INFO,"GTA San Andreas native library detected. BRILL integration bridge ready.");
    // Intentionally do not auto-connect: wait for explicit game-side UI action
    // after legitimate account login and the game-rendering input hooks exist.
}

// Extension points for game-side UI calls. Does NOT hook game rendering.
extern "C" JNIEXPORT bool BrillGtaReady() {
    std::lock_guard<std::mutex> guard(lock);
    return gtaLoaded && aml != nullptr;
}

extern "C" JNIEXPORT int BrillGtaConnect(const char *ipPort,const char *nickname) {
    if(!ipPort || !nickname || std::strlen(ipPort)>64 || std::strlen(nickname)>24) return -1;
    std::lock_guard<std::mutex> guard(lock);
    if(!gtaLoaded || aml==nullptr) return -2;
    if(!loadProtocol()) return -3;
    return start(const_cast<char*>(ipPort),const_cast<char*>(nickname));
}

extern "C" JNIEXPORT void BrillGtaDisconnect() {
    std::lock_guard<std::mutex> guard(lock);
    if(stop) stop();
}

extern "C" JNIEXPORT bool BrillGtaStatus(char* destination,size_t bytes) {
    if(!destination || bytes<2) return false;
    std::lock_guard<std::mutex> guard(lock);
    destination[0]='\0';
    if (!state || !release) return false;
    char *text = state();
    if(!text) return false;
    std::strncpy(destination,text,bytes-1);destination[bytes-1]='\0';
    release(text);return true;
}

ON_MOD_UNLOAD() {
    std::lock_guard<std::mutex> guard(lock);
    if(stop) stop();
    clearProtocol();
    gtaLoaded = false;
}