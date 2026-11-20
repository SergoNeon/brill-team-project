package city.brill.multiplayer;

/** Real SA-MP 0.3.DL-R1 transport. A game renderer must consume these events.
 *  NOT an implementation of GTA:SA graphics or asset loading.
 */
public final class NativeBridge {
    static {
        System.loadLibrary("brillprotocol");
        System.loadLibrary("brilljni");
    }
    public native int nativeConnect(String address, String nickname);
    public native void nativeDisconnect();
    public native String nativeState();
    public native String nativeNextEvent();
    public native int nativeCommand(String command);
    public native int nativeChat(String message);
    public native int nativeDialog(short dialogId, int button, short selectedRow, String text);
}