package city.brill.multiplayer;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.net.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

public class MainActivity extends Activity {
    private final int BG=Color.rgb(12,13,17), CARD=Color.rgb(25,25,31), INPUT=Color.rgb(35,34,41), FG=Color.rgb(248,247,245), MUTED=Color.rgb(155,154,165), RED=Color.rgb(205,47,70), GOLD=Color.rgb(220,178,106), GREEN=Color.rgb(113,215,150);
    private LinearLayout page, bottom, root;
    private final ExecutorService workers=Executors.newSingleThreadExecutor();
    private final ArrayList<Server> servers=new ArrayList<>();
    private String tab="servers";
    private boolean syncing=false;
    private TextView statusText;
    private static final String API="https://nexus.brill.city:28912/multiplayer/api/v1/servers";
    private static class Server {String id,name,ip,description;int port,online,max;boolean available,official;Server(String a,String b,String c,int d){id=a;name=b;ip=c;port=d;max=0;}}

    @Override public void onCreate(Bundle b){super.onCreate(b);getWindow().setStatusBarColor(BG);getWindow().setNavigationBarColor(BG);getWindow().getDecorView().setSystemUiVisibility(0);build();refresh();}
    @Override protected void onResume(){super.onResume();if(!syncing) refresh();}
    @Override protected void onDestroy(){workers.shutdownNow();super.onDestroy();}
    private int dp(float n){return (int)(n*getResources().getDisplayMetrics().density+0.5f);}
    private GradientDrawable shape(int bg,int radius,int stroke){GradientDrawable d=new GradientDrawable();d.setColor(bg);d.setCornerRadius(dp(radius));if(stroke!=0)d.setStroke(dp(1),stroke);return d;}
    private LinearLayout vertical(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private LinearLayout horizontal(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
    private TextView label(String text,int size,int color,boolean bold){TextView t=new TextView(this);t.setText(text);t.setTextColor(color);t.setTextSize(size);if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);t.setIncludeFontPadding(false);return t;}
    private LinearLayout.LayoutParams lp(int w,int h){return new LinearLayout.LayoutParams(w<0?w:dp(w),h<0?h:dp(h));}
    private void gap(LinearLayout into,int v){View spacer=new View(this);into.addView(spacer,lp(1,v));}
    private LinearLayout pad(LinearLayout l,int v){l.setPadding(dp(v),dp(v),dp(v),dp(v));return l;}
    private void build(){
        root=vertical();root.setBackgroundColor(BG);setContentView(root);
        LinearLayout head=horizontal();head.setPadding(dp(20),dp(19),dp(20),dp(17));root.addView(head,lp(-1,-2));
        TextView emblem=label("B",24,FG,true);emblem.setGravity(Gravity.CENTER);emblem.setBackground(shape(RED,10,0));head.addView(emblem,lp(46,46));
        LinearLayout word=vertical();word.setPadding(dp(12),dp(1),0,0);head.addView(word,new LinearLayout.LayoutParams(0,-2,1));word.addView(label("BRILL",18,FG,true));word.addView(label("MULTIPLAYER",12,GOLD,true));
        TextView refresh=label("⟳",26,GOLD,true);refresh.setGravity(Gravity.CENTER);refresh.setContentDescription("Обновить список серверов");refresh.setOnClickListener(v->refresh());head.addView(refresh,lp(44,46));
        View rule=new View(this);rule.setBackgroundColor(Color.rgb(44,42,48));root.addView(rule,lp(-1,1));
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(false);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));page=vertical();page.setPadding(dp(20),dp(20),dp(20),dp(20));scroll.addView(page);
        bottom=horizontal();bottom.setGravity(Gravity.CENTER);bottom.setPadding(dp(10),dp(12),dp(10),dp(12));bottom.setBackgroundColor(Color.rgb(19,19,24));root.addView(bottom,lp(-1,72));
        render();
    }
    private void render(){
        if(page==null)return;
        page.removeAllViews();bottom.removeAllViews();
        if(tab.equals("servers"))renderServers(false);else if(tab.equals("favorites"))renderServers(true);else renderProject();
        nav("⌂","СЕРВЕРЫ","servers");nav("★","ИЗБРАННОЕ","favorites");nav("◈","ПРОЕКТ","project");
    }
    private void nav(String icon,String name,String dest){LinearLayout item=vertical();item.setGravity(Gravity.CENTER);TextView i=label(icon,24,tab.equals(dest)?GOLD:MUTED,true);i.setGravity(Gravity.CENTER);item.addView(i);gap(item,4);TextView t=label(name,10,tab.equals(dest)?FG:MUTED,true);t.setGravity(Gravity.CENTER);item.addView(t);item.setOnClickListener(v->{tab=dest;render();});bottom.addView(item,new LinearLayout.LayoutParams(0,-1,1));}
    private void renderServers(boolean favorites){
        page.addView(label(favorites?"ИЗБРАННЫЕ СЕРВЕРЫ":"КАТАЛОГ СЕРВЕРОВ",23,FG,true));gap(page,8);
        page.addView(label(favorites?"Сохранённые тобой игровые серверы":"Живой статус и прямое подключение",13,MUTED,false));gap(page,24);
        if(!favorites){LinearLayout summary=vertical();summary.setBackground(shape(Color.rgb(37,24,31),15,Color.rgb(87,43,53)));pad(summary,18);page.addView(summary,lp(-1,-2));summary.addView(label("BRILL MULTIPLAYER",13,GOLD,true));gap(summary,8);summary.addView(label("Твоя игра начинается здесь",20,FG,true));gap(summary,6);summary.addView(label("Свой каталог. Русский интерфейс. Развитие игровой платформы.",13,MUTED,false));gap(page,25);}
        LinearLayout heading=horizontal();page.addView(heading,lp(-1,-2));heading.addView(label(favorites?"СОХРАНЕНО":"ДОСТУПНЫЕ СЕРВЕРЫ",12,GOLD,true),new LinearLayout.LayoutParams(0,-2,1));statusText=label(syncing?"ОБНОВЛЕНИЕ…":"",11,MUTED,true);heading.addView(statusText);gap(page,15);
        int shown=0;for(Server s:servers){if(favorites&&!isFav(s.id))continue;serverCard(s);shown++;}
        if(shown==0){LinearLayout empty=vertical();pad(empty,23);empty.setBackground(shape(CARD,14,0));page.addView(empty,lp(-1,-2));empty.addView(label(favorites?"Пока нет избранных серверов":"Каталог загружается",18,FG,true));gap(empty,8);empty.addView(label(favorites?"Нажми ★ на карточке сервера, чтобы сохранить его":"Проверяем состояние первого игрового сервера",13,MUTED,false));}
        gap(page,16);TextView add=label("＋  ДОБАВИТЬ СЕРВЕР ПО IP",13,GOLD,true);add.setGravity(Gravity.CENTER);add.setBackground(shape(INPUT,11,Color.rgb(89,75,59)));add.setPadding(dp(10),dp(18),dp(10),dp(18));add.setOnClickListener(v->addServerDialog());page.addView(add,lp(-1,-2));gap(page,16);page.addView(label("BRILL умеет подключаться к SA-MP через свой код. Для отображения и управления миром GTA San Andreas необходима отдельная интеграция игрового движка.",12,MUTED,false));
    }
    private void serverCard(Server s){
        LinearLayout card=vertical();pad(card,17);card.setBackground(shape(CARD,14,Color.rgb(56,53,61)));page.addView(card,lp(-1,-2));
        LinearLayout top=horizontal();card.addView(top,lp(-1,-2));LinearLayout names=vertical();top.addView(names,new LinearLayout.LayoutParams(0,-2,1));names.addView(label(s.official?"● ОФИЦИАЛЬНЫЙ СЕРВЕР":"● ЛИЧНЫЙ СЕРВЕР",10,s.official?GOLD:MUTED,true));gap(names,9);names.addView(label(s.name,19,FG,true));gap(names,5);names.addView(label("ROLEPLAY   •   SAN ANDREAS",11,MUTED,false));
        TextView star=label(isFav(s.id)?"★":"☆",28,isFav(s.id)?GOLD:MUTED,false);star.setGravity(Gravity.CENTER);star.setOnClickListener(v->{toggleFav(s.id);render();});top.addView(star,lp(42,50));gap(card,14);
        LinearLayout status=horizontal();card.addView(status,lp(-1,-2));String txt=s.official?(s.available?"● В СЕТИ":"● НЕДОСТУПЕН"):"● СТАТУС НЕ ПРОВЕРЕН";TextView badge=label(txt,11,s.available&&s.official?GREEN:MUTED,true);status.addView(badge,new LinearLayout.LayoutParams(0,-2,1));status.addView(label(s.official?(s.available?(s.online+" / "+s.max):("— / "+s.max)):"ПО IP",13,FG,true));gap(card,14);
        TextView addr=label(s.ip+":"+s.port,18,FG,true);addr.setGravity(Gravity.CENTER_VERTICAL);addr.setPadding(dp(13),dp(15),dp(12),dp(15));addr.setBackground(shape(Color.rgb(13,13,18),9,Color.rgb(57,53,62)));addr.setOnClickListener(v->copyAddress(s));card.addView(addr,lp(-1,-2));gap(card,13);
        LinearLayout buttons=horizontal();card.addView(buttons,lp(-1,50));TextView copy=action("КОПИРОВАТЬ",false);copy.setOnClickListener(v->copyAddress(s));buttons.addView(copy,new LinearLayout.LayoutParams(0,-1,1));View space=new View(this);buttons.addView(space,lp(10,1));TextView connect=action("СЕТЕВОЙ КЛИЕНТ",true);connect.setOnClickListener(v->launchGame(s));buttons.addView(connect,new LinearLayout.LayoutParams(0,-1,1));gap(page,13);
    }
    private TextView action(String text,boolean strong){TextView t=label(text,12,strong?FG:GOLD,true);t.setGravity(Gravity.CENTER);t.setBackground(shape(strong?RED:INPUT,9,strong?0:Color.rgb(80,67,52)));return t;}
    private void renderProject(){page.addView(label("BRILL MULTIPLAYER",26,FG,true));gap(page,9);page.addView(label("Собственная платформа Brill Team Project",15,GOLD,true));gap(page,30);section("ВЕРСИЯ ПРИЛОЖЕНИЯ","0.2.0 · Android · собственный SA-MP-протокол");section("ЧТО УЖЕ РАБОТАЕТ","Русский интерфейс, каталог и проверенный сетевой протокол 0.3.DL-R1: подключение, игровые диалоги и команды.");section("ИГРОВОЙ ДВИЖОК","Сетевой клиент создан. Визуальный движок GTA San Andreas не входит в BRILL и должен использовать законно установленную игру. Полноценная интеграция и запуск мира ещё не готовы.");section("КАТАЛОГ","BRILL MOBILE RP — первый официальный сервер. Адрес: 77.42.93.209:27877.");TextView web=action("ОТКРЫТЬ САЙТ",true);web.setOnClickListener(v->openUrl("https://nexus.brill.city:28912/multiplayer/"));page.addView(web,lp(-1,52));}
    private void section(String name,String description){LinearLayout item=vertical();pad(item,18);item.setBackground(shape(CARD,12,Color.rgb(53,51,57)));page.addView(item,lp(-1,-2));item.addView(label(name,12,GOLD,true));gap(item,9);item.addView(label(description,14,FG,false));gap(page,14);}
    private void refresh(){if(syncing)return;syncing=true;if(statusText!=null)statusText.setText("ОБНОВЛЕНИЕ…");workers.execute(()->{
      ArrayList<Server> updated=new ArrayList<>();boolean ok=false;
      try{
        HttpURLConnection c=(HttpURLConnection)new URL(API).openConnection();c.setConnectTimeout(6500);c.setReadTimeout(6500);c.setRequestProperty("Accept","application/json");if(c.getResponseCode()!=200)throw new IOException("Server returned "+c.getResponseCode());
        ByteArrayOutputStream buff=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1&&buff.size()<128000)buff.write(b,0,n);}c.disconnect();JSONObject root=new JSONObject(buff.toString("UTF-8"));JSONArray list=root.getJSONArray("servers");
        for(int i=0;i<list.length();i++){JSONObject s=list.getJSONObject(i);Server item=new Server(s.optString("id"),s.optString("name"),s.getString("address"),s.getInt("port"));item.official=s.optBoolean("featured");item.online=s.optInt("online");item.max=s.optInt("maxPlayers",500);item.available=s.optBoolean("available");item.description=s.optString("description");updated.add(item);}ok=true;
      }catch(Exception ignored){}
      final boolean success=ok;runOnUiThread(()->{syncing=false;servers.clear();if(success)servers.addAll(updated);else{Server seed=new Server("brill-mobile-rp","BRILL MOBILE RP","77.42.93.209",27877);seed.official=true;seed.max=500;servers.add(seed);}loadCustom();render();if(statusText!=null)statusText.setText(success?"ОБНОВЛЕНО":"НЕТ СЕТИ");});
    });}
    private android.content.SharedPreferences prefs(){return getSharedPreferences("brill_catalog_v1",MODE_PRIVATE);}
    private boolean isFav(String id){return prefs().getStringSet("favorites",Collections.emptySet()).contains(id);}
    private void toggleFav(String id){Set<String> list=new HashSet<>(prefs().getStringSet("favorites",Collections.emptySet()));if(!list.add(id))list.remove(id);prefs().edit().putStringSet("favorites",list).apply();}
    private void loadCustom(){try{JSONArray values=new JSONArray(prefs().getString("custom_servers","[]"));for(int i=0;i<values.length();i++){JSONObject x=values.getJSONObject(i);String ip=x.getString("ip");int port=x.getInt("port");Server s=new Server("custom:"+ip+":"+port,x.optString("name","Мой сервер"),ip,port);servers.add(s);}}catch(Exception ignored){}}
    private void addServerDialog(){LinearLayout form=vertical();form.setPadding(dp(20),dp(8),dp(20),0);EditText name=new EditText(this);name.setSingleLine(true);name.setHint("Название сервера");name.setTextColor(Color.BLACK);form.addView(name);EditText address=new EditText(this);address.setSingleLine(true);address.setHint("IP:порт, например 1.2.3.4:7777");address.setTextColor(Color.BLACK);form.addView(address);new AlertDialog.Builder(this).setTitle("Добавить сервер").setView(form).setNegativeButton("Отмена",(a,b)->{}).setPositiveButton("Добавить",(a,b)->{
       String value=address.getText().toString().trim();String[] parts=value.split(":");if(parts.length!=2){toast("Укажи адрес в формате IP:порт");return;}
       try{String ip=parts[0];int port=Integer.parseInt(parts[1]);if(port<1||port>65535||!ip.matches("([0-9]{1,3}\\.){3}[0-9]{1,3}"))throw new Exception();for(String oct:ip.split("\\."))if(Integer.parseInt(oct)>255)throw new Exception();JSONArray list=new JSONArray(prefs().getString("custom_servers","[]"));for(int i=0;i<list.length();i++){JSONObject el=list.getJSONObject(i);if(el.getString("ip").equals(ip)&&el.getInt("port")==port){toast("Сервер уже добавлен");return;}}JSONObject item=new JSONObject();item.put("ip",ip);item.put("port",port);item.put("name",name.getText().toString().trim().isEmpty()?"Мой сервер":name.getText().toString().trim());list.put(item);prefs().edit().putString("custom_servers",list.toString()).apply();refresh();toast("Сервер сохранён");}catch(Exception e){toast("Неверный IP или порт");}
    }).show();}
    private String address(Server s){return s.ip+":"+s.port;}
    private void copyAddress(Server s){android.content.ClipboardManager clipboard=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);clipboard.setPrimaryClip(ClipData.newPlainText("BRILL SERVER",address(s)));toast("Адрес сервера скопирован");}
    private void launchGame(Server s){
        new AlertDialog.Builder(this).setTitle("BRILL — сетевой клиент")
            .setMessage("Запустить настоящую сессию SA-MP 0.3.DL-R1 внутри BRILL MULTIPLAYER?\n\nДоступны соединение, игровые сообщения и диалоги. Сам мир GTA San Andreas пока не отображается: игровой движок ещё не интегрирован.")
            .setPositiveButton("Подключить",(dialog,which)->{
                Intent i=new Intent(this,NetworkSessionActivity.class);
                i.putExtra("address",address(s));startActivity(i);
            }).setNegativeButton("Отмена",(dialog,which)->{}).show();
    }
    private void openUrl(String u){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(u)));}catch(Exception e){toast("Не удалось открыть ссылку");}}
    private void toast(String t){Toast.makeText(this,t,Toast.LENGTH_SHORT).show();}
}