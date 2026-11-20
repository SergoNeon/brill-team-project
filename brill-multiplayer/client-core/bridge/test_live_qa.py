import ctypes,time,json
p='/opt/brill-multiplayer/client-core/build/linux-amd64/libbrillprotocol.so'
lib=ctypes.CDLL(p)
lib.BrillStart.argtypes=[ctypes.c_char_p,ctypes.c_char_p]
lib.BrillStart.restype=ctypes.c_int
lib.BrillNextEvent.restype=ctypes.c_void_p
lib.BrillState.restype=ctypes.c_void_p
lib.BrillRelease.argtypes=[ctypes.c_void_p]
def fetch(f):
  ptr=f()
  if not ptr:return ''
  try:return ctypes.string_at(ptr).decode('utf-8','replace')
  finally:lib.BrillRelease(ptr)
start=lib.BrillStart(b'127.0.0.1:27878',b'Brill_Verify')
print('BRILL_NATIVE_BRIDGE_START',start,flush=True)
if start:raise SystemExit(1)
found=False
for tick in range(18):
  time.sleep(1)
  event=fetch(lib.BrillNextEvent)
  if event:
    print('BRILL_EVENT',event[:330],flush=True)
    try:
      if json.loads(event)['type']=='joined':found=True
    except Exception:pass
  if tick in (0,10,15,17):print('SESSION_SECOND',tick+1,'STATE',fetch(lib.BrillState),flush=True)
lib.BrillStop()
print('GOT_JOIN',found,flush=True)
if not found:raise SystemExit(2)