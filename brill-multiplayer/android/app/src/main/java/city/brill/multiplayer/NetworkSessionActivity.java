package city.brill.multiplayer;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * BRILL 0.3.DL-R1 protocol session. Not a GTA renderer. This screen is a
 * development diagnostic for real server handshake, login, chat and dialogs.
 * It intentionally does NOT claim to start the GTA San Andreas game world.
 */
public final class NetworkSessionActivity extends Activity {
    private static final int BG = 0xff101115, PANEL = 0xff202127, GOLD = 0xffd8b06e, TEXT = 0xfff5f3ed, MUTED = 0xffa9a9b1;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final AtomicBoolean closed = new AtomicBoolean(false);
    private NativeBridge bridge;
    private TextView title, status, events, warning;
    private EditText nick, message;
    private Button joinButton;
    private ScrollView eventScroll;
    private String address;
    private boolean started, joined;
    private int count;
    private final Runnable poll = new Runnable() {
        @Override public void run() {
            if (closed.get()) return;
            if (started && bridge != null) {
                try {
                    String value = bridge.nativeState();
                    status.setText(value == null ? "Нет статуса" : value);
                    for (int i = 0; i < 14; i++) {
                        String raw = bridge.nativeNextEvent();
                        if (raw == null || raw.isEmpty()) break;
                        processEvent(raw);
                    }
                } catch (Throwable err) { showLine("Ошибка библиотеки: " + err.getClass().getSimpleName()); started = false; }
            }
            handler.postDelayed(this, 300);
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        address = getIntent().getStringExtra("address");
        if (address == null || !address.matches("[0-9.]{7,15}:[0-9]{1,5}")) address = "77.42.93.209:27877";
        build();
        handler.post(poll);
    }

    private int dp(int x) { return (int) (x * getResources().getDisplayMetrics().density + .5f); }
    private GradientDrawable background(int color) {
        GradientDrawable d = new GradientDrawable(); d.setColor(color); d.setCornerRadius(dp(12)); return d;
    }
    private TextView label(String text, int size, int color, boolean strong) {
        TextView v = new TextView(this); v.setText(text); v.setTextColor(color); v.setTextSize(size);
        if (strong) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return v;
    }
    private Button button(String text) {
        Button b = new Button(this); b.setText(text); b.setTextColor(Color.WHITE);
        b.setAllCaps(false); b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xffb9334d));
        return b;
    }
    private void build() {
        ScrollView mainScroll = new ScrollView(this); mainScroll.setFillViewport(true); mainScroll.setBackgroundColor(BG);
        LinearLayout root = new LinearLayout(this); root.setPadding(dp(18), dp(22), dp(18), dp(22));
        root.setOrientation(LinearLayout.VERTICAL); mainScroll.addView(root); setContentView(mainScroll);
        title = label("BRILL MULTIPLAYER", 24, TEXT, true); root.addView(title);
        root.addView(label("НАСТОЯЩИЙ ПРОТОКОЛ SA-MP 0.3.DL-R1", 11, GOLD, true));
        TextView target = label(address, 18, TEXT, true); target.setPadding(0, dp(16), 0, dp(12)); root.addView(target);
        warning = label("Техническая сессия: проверка подключения, игровых сообщений и диалогов. Отображение GTA San Andreas пока не подключено.", 13, MUTED, false);
        warning.setPadding(0, dp(4), 0, dp(15)); root.addView(warning);
        nick = new EditText(this); nick.setSingleLine(true); nick.setTextColor(TEXT); nick.setHintTextColor(MUTED);
        nick.setHint("Ник персонажа"); nick.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        nick.setText(getPreferences(MODE_PRIVATE).getString("nickname", ""));
        root.addView(nick);
        joinButton = button("ПОДКЛЮЧИТЬ ПРОТОКОЛ"); root.addView(joinButton);
        status = label("Отключено", 15, GOLD, true); status.setPadding(0, dp(13), 0, dp(13)); root.addView(status);
        joinButton.setOnClickListener(v -> connect());
        Button leave = button("ОТКЛЮЧИТЬСЯ"); leave.setBackgroundTintList(android.content.res.ColorStateList.valueOf(PANEL));
        leave.setOnClickListener(v -> stopNetwork()); root.addView(leave);
        root.addView(label("СОБЫТИЯ ИГРОВОГО СЕРВЕРА", 12, GOLD, true));
        eventScroll = new ScrollView(this); eventScroll.setFillViewport(false); eventScroll.setBackground(background(PANEL));
        LinearLayout.LayoutParams scrollLp = new LinearLayout.LayoutParams(-1, dp(230)); scrollLp.setMargins(0, dp(7), 0, dp(15));
        root.addView(eventScroll, scrollLp);
        events = label("Ожидание подключения...", 12, TEXT, false); events.setPadding(dp(13), dp(13), dp(13), dp(13));
        eventScroll.addView(events);
        message = new EditText(this); message.setSingleLine(true); message.setTextColor(TEXT); message.setHintTextColor(MUTED);
        message.setHint("Текст сообщения или /команда"); root.addView(message);
        Button send = button("ОТПРАВИТЬ НА СЕРВЕР"); send.setOnClickListener(v -> sendMessage()); root.addView(send);
    }
    private void connect() {
        final String name = nick.getText().toString().trim();
        if (!name.matches("[A-Za-z0-9_]{3,24}")) {
            status.setText("Укажи ник: латиница, 3–24 символа"); return;
        }
        if (started) { status.setText("Сессия уже создана"); return; }
        getPreferences(MODE_PRIVATE).edit().putString("nickname", name).apply();
        started = true; joined = false;
        nick.setEnabled(false); joinButton.setEnabled(false);
        status.setText("Подключение к " + address + "...");
        io.execute(() -> {
            int code = -99;
            try {
                if (!closed.get()) {
                    if (bridge == null) bridge = new NativeBridge();
                    code = bridge.nativeConnect(address, name);
                }
            } catch (Throwable problem) {
                final String error = problem.getClass().getSimpleName() + ": " + problem.getMessage();
                runOnUiThread(() -> showLine("Ошибка: " + error));
            }
            int result = code;
            runOnUiThread(() -> {
                if (closed.get()) return;
                if (result != 0) {
                    started = false; nick.setEnabled(true); joinButton.setEnabled(true);
                    status.setText("Ошибка соединения (" + result + ")");
                } else {
                    showLine("RakNet соединён; ожидаем сообщения сервера...");
                }
            });
        });
    }
    private void stopNetwork() {
        if (bridge == null) return;
        io.execute(() -> {
            try { bridge.nativeDisconnect(); } catch (Throwable ignored) {}
            runOnUiThread(() -> {
                if (closed.get()) return;
                started = false; joined = false;
                nick.setEnabled(true); joinButton.setEnabled(true); status.setText("Отключено");
                showLine("Соединение закрыто");
            });
        });
    }
    private void sendMessage() {
        if (!started || bridge == null) { showLine("Нет соединения с сервером"); return; }
        String text = message.getText().toString().trim();
        if (text.isEmpty() || text.length() > 250) return;
        message.setText("");
        io.execute(() -> {
            int code;
            try { code = text.startsWith("/") ? bridge.nativeCommand(text) : bridge.nativeChat(text); }
            catch (Throwable err) { code = -99; }
            if (code != 0) { int failed = code; runOnUiThread(() -> showLine("Ошибка отправки: " + failed)); }
        });
    }
    private void processEvent(String raw) {
        try {
            JSONObject msg = new JSONObject(raw);
            String type = msg.optString("type", "event");
            JSONObject data = msg.optJSONObject("data");
            if (type.equals("dialog") && data != null) { serverDialog(data); return; }
            if (type.equals("joined")) { joined = true; showLine("Сервер подтвердил SA-MP-соединение"); return; }
            if (type.equals("chat") && data != null) { showLine(data.optString("Text", "")); return; }
            if (type.equals("player.state") && data != null) { showLine("Состояние персонажа: " + data.optString("State")); return; }
            if (type.equals("protocol.error") || type.equals("error")) {
                showLine("Ошибка протокола: " + (data == null ? msg.optString("message") : data.toString())); return;
            }
            if (type.equals("disconnected")) { joined = false; started = false; nick.setEnabled(true); joinButton.setEnabled(true); showLine("Сервер отключил соединение"); return; }
            if (type.equals("transport.connected")) return;
            if (type.equals("appearance") || type.equals("position") || type.equals("player.sync") || type.equals("textdraw.show")) return;
            if (count < 70) showLine("Событие: " + type);
        } catch (Exception e) { showLine("Некорректное событие"); }
    }
    private void serverDialog(JSONObject data) {
        if (bridge == null || isFinishing() || closed.get()) return;
        int id = data.optInt("ID", -1);
        int style = data.optInt("Style", 0);
        String caption = data.optString("Title", "Диалог сервера");
        String body = data.optString("Message", "");
        String affirmative = data.optString("Button1", "Продолжить");
        String negative = data.optString("Button2", "Отмена");
        if (id < 0 || id > Short.MAX_VALUE) return;
        // Prevent server-supplied HTML and excessively long dialog payloads from
        // exhausting the Android UI; SA-MP dialog content remains plain text.
        if (body.length() > 3500) body = body.substring(0, 3500);
        if (caption.length() > 100) caption = caption.substring(0, 100);
        boolean isPassword = style == 3;
        if (style == 1 || style == 3) {
            EditText entry = new EditText(this); entry.setSingleLine(true);
            if (isPassword) entry.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
            LinearLayout wrap = new LinearLayout(this); wrap.setOrientation(LinearLayout.VERTICAL);
            wrap.setPadding(dp(22), dp(8), dp(22), 0);
            TextView prompt = label(body, 15, Color.DKGRAY, false); wrap.addView(prompt); wrap.addView(entry);
            new AlertDialog.Builder(this).setTitle(caption).setView(wrap)
                .setPositiveButton(affirmative,(dialog,which) -> respond(id,1,0,entry.getText().toString()))
                .setNegativeButton(negative,(dialog,which) -> respond(id,0,-1,""))
                .setCancelable(false).show();
        } else if (style == 2 || style == 4 || style == 5) {
            String[] allRows = body.split("\\n",-1);
            int offset = style == 5 && allRows.length > 0 ? 1 : 0;
            String[] rows = new String[allRows.length - offset];
            for (int i=0; i<rows.length; i++) {
                rows[i]=allRows[i+offset].replace('\t',' ')
                    .replaceAll("\\{[0-9a-fA-F]{6,8}\\}", "").trim();
            }
            new AlertDialog.Builder(this).setTitle(caption).setItems(rows,(dialog,selected) -> respond(id,1,selected,""))
                .setNegativeButton(negative,(dialog,which) -> respond(id,0,-1,""))
                .setCancelable(false).show();
        } else {
            new AlertDialog.Builder(this).setTitle(caption).setMessage(body)
                .setPositiveButton(affirmative,(dialog,which) -> respond(id,1,0,""))
                .setNegativeButton(negative,(dialog,which) -> respond(id,0,-1,""))
                .setCancelable(false).show();
        }
        showLine("Диалог сервера: " + caption);
    }
    private void respond(int id,int button,int selected,String answer) {
        if (bridge == null || !started) return;
        // Never put password dialog responses into logs or on-screen history.
        io.execute(() -> {
            try { bridge.nativeDialog((short)id,button,(short)selected,answer); }
            catch (Throwable err) { runOnUiThread(() -> showLine("Ошибка ответа на диалог")); }
        });
    }
    private void showLine(String text) {
        if (closed.get() || events == null || text == null) return;
        String cleaned = text.replaceAll("\\{[0-9A-Fa-f]{6,8}\\}", "");
        if (cleaned.length() > 400) cleaned = cleaned.substring(0,400);
        if (count++ > 95) { events.setText(""); count = 0; }
        events.append("\n" + cleaned);
        eventScroll.post(() -> eventScroll.fullScroll(View.FOCUS_DOWN));
    }
    @Override protected void onDestroy() {
        closed.set(true);
        handler.removeCallbacks(poll);
        if (bridge != null) {
            io.execute(() -> { try { bridge.nativeDisconnect(); } catch (Throwable ignored) {} });
        }
        io.shutdown();
        super.onDestroy();
    }
}