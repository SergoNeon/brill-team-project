#!/usr/bin/env python3
import os, re, json, time, hmac, hashlib, secrets, sqlite3, socket, subprocess, threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
ROOT='/opt/nexus-city-web'
DB=ROOT+'/portal.sqlite3'
PREFIX='/nexus-city/api/'
LOCK=threading.Lock()
def connect():
    db=sqlite3.connect(DB,timeout=8)
    db.row_factory=sqlite3.Row
    db.execute('PRAGMA busy_timeout=8000')
    return db
def init():
    os.makedirs(ROOT,exist_ok=True)
    with connect() as db:
        db.executescript("""PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE NOT NULL, passhash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'player',created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(tokenhash TEXT PRIMARY KEY,user_id INTEGER NOT NULL,expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS applications(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,faction TEXT NOT NULL,character_name TEXT NOT NULL,experience TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'На рассмотрении',created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS news(id INTEGER PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS support_tickets(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,topic TEXT NOT NULL,subject TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Открыто',staff_reply TEXT NOT NULL DEFAULT '',created INTEGER NOT NULL,updated INTEGER NOT NULL);
        """)
        db.execute('INSERT OR IGNORE INTO settings(k,v) VALUES(?,?)',('rules',json.dumps(['Уважайте других игроков и администрацию.','Запрещены читы и эксплуатация ошибок.','Соблюдайте правила RolePlay.','Запрещены оскорбления и дискриминация.','Решения администрации можно обжаловать установленным порядком.'],ensure_ascii=False)))
        if not db.execute('SELECT 1 FROM news').fetchone():
            db.execute('INSERT INTO news(title,body,created) VALUES(?,?,?)',('Официальный сайт NEXUS BRILL CITY','Запущен портал проекта. Работают регистрация на сайте и заявки во фракции. Игровая авторизация и статистика персонажей пока не подключены.',int(time.time())))
def pwd_hash(p):
    salt=secrets.token_bytes(16)
    digest=hashlib.scrypt(p.encode(),salt=salt,n=16384,r=8,p=1)
    return salt.hex()+':'+digest.hex()
def pwd_ok(p,stored):
    try:
        salt,hashv=stored.split(':')
        return hmac.compare_digest(hashlib.scrypt(p.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1),bytes.fromhex(hashv))
    except Exception: return False
def session_user(cookie):
    match=re.search(r'(?:^|;\s*)nexus_session=([0-9a-f]{64})(?:;|$)',cookie)
    if not match:return None
    th=hashlib.sha256(match.group(1).encode()).hexdigest()
    with connect() as db:
        r=db.execute('SELECT u.id,u.username,u.role FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.tokenhash=? AND s.expires>?',(th,int(time.time()))).fetchone()
        return dict(r) if r else None
RATE={}
class Handler(BaseHTTPRequestHandler):
    server_version='NexusWeb/1.0'
    def log_message(self,fmt,*args):pass
    def send(self,status=200,data=None,cookie=None):
        out=json.dumps(data if data is not None else {},ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(out)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('X-Frame-Options','DENY')
        if cookie:self.send_header('Set-Cookie',cookie)
        self.end_headers()
        self.wfile.write(out)
    def payload(self):
        n=int(self.headers.get('Content-Length','0'))
        if n<1 or n>8192:raise ValueError('Неверный размер запроса')
        return json.loads(self.rfile.read(n))
    def endpoint(self):return urlparse(self.path).path.removeprefix(PREFIX)
    def require(self):
        u=session_user(self.headers.get('Cookie',''))
        if not u:raise PermissionError('Сначала войдите в кабинет')
        return u
    def rate(self):
        ip=self.headers.get('X-Real-IP','') or self.client_address[0]
        now=time.monotonic()
        with LOCK:
            history=[x for x in RATE.get(ip,[]) if now-x<60]
            if len(history)>=25:raise RuntimeError('Слишком много запросов. Повторите позже.')
            history.append(now)
            RATE[ip]=history
    def do_GET(self):
        try:
            path=self.endpoint()
            if path=='health':return self.send(data={'ok':True})
            if path=='status':
                p=subprocess.run(['pgrep','-f','^/opt/nexus-rpv-qa/ragemp-server$'],capture_output=True,text=True,timeout=3)
                with open('/proc/net/udp',encoding='utf-8') as ports:
                    port_bound=any(line.split()[1].endswith(':'+format(22205,'04X')) for line in ports if ':' in line)
                active=(p.returncode==0 and port_bound)
                return self.send(data={'process_active':active,'address':'77.42.93.209:22205','players':None,'players_available':False,'checked_at':int(time.time())})
            if path=='news':
                with connect() as db:rows=[dict(r) for r in db.execute('SELECT id,title,body,created FROM news ORDER BY id DESC LIMIT 20')]
                return self.send(data={'news':rows})
            if path=='rules':
                with connect() as db:row=db.execute('SELECT v FROM settings WHERE k=?',('rules',)).fetchone()
                return self.send(data={'rules':json.loads(row['v']) if row else [],'notice':'Правила проекта. Редактируются администрацией сайта.'})
            if path=='me':
                u=session_user(self.headers.get('Cookie',''))
                return self.send(data={'user':u,'linked_to_game':False})
            if path=='tickets':
                u=self.require()
                with connect() as db: rows=[dict(x) for x in db.execute('SELECT id,topic,subject,message,status,staff_reply,created,updated FROM support_tickets WHERE user_id=? ORDER BY updated DESC LIMIT 60',(u['id'],))]
                return self.send(data={'tickets':rows})
            if path=='admin/tickets':
                u=self.require()
                if u['role']!='admin':raise PermissionError('Только администрация')
                with connect() as db: rows=[dict(x) for x in db.execute('SELECT t.id,t.topic,t.subject,t.message,t.status,t.staff_reply,t.created,t.updated,u.username FROM support_tickets t JOIN users u ON u.id=t.user_id ORDER BY t.updated DESC LIMIT 150')]
                return self.send(data={'tickets':rows})
            if path=='applications':
                u=self.require()
                with connect() as db:
                    rows=[dict(r) for r in db.execute('SELECT id,faction,character_name,experience,status,created FROM applications WHERE user_id=? ORDER BY id DESC',(u['id'],))]
                return self.send(data={'applications':rows})
            if path=='ranking':
                try:
                    with open(ROOT+'/game_snapshot.json',encoding='utf-8') as f:snapshot=json.load(f)
                    fresh=int(time.time())-snapshot['updated_at']<180
                    return self.send(data={'ranking':snapshot['ranking'] if fresh else [],'connected':fresh,'updated_at':snapshot['updated_at']})
                except (OSError,KeyError,ValueError):
                    return self.send(data={'ranking':[],'connected':False,'notice':'Игровая статистика временно недоступна.'})
            if path=='admin/overview':
                u=self.require()
                if u['role']!='admin':raise PermissionError('Только администрация')
                with connect() as db:
                    counts={'users':db.execute('SELECT COUNT(*) FROM users').fetchone()[0],'applications':db.execute('SELECT COUNT(*) FROM applications').fetchone()[0],'pending':db.execute("SELECT COUNT(*) FROM applications WHERE status='На рассмотрении'").fetchone()[0],'news':db.execute('SELECT COUNT(*) FROM news').fetchone()[0],'tickets':db.execute("SELECT COUNT(*) FROM support_tickets WHERE status!='Закрыто'").fetchone()[0]}
                return self.send(data={'counts':counts})
            if path=='admin/applications':
                u=self.require()
                if u['role']!='admin':raise PermissionError('Только администрация')
                with connect() as db:
                    rows=[dict(r) for r in db.execute('SELECT a.id,a.faction,a.character_name,a.experience,a.status,a.created,u.username FROM applications a JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100')]
                return self.send(data={'applications':rows})
            return self.send(404,{'error':'Не найдено'})
        except PermissionError as e:self.send(401,{'error':str(e)})
        except Exception as e:self.send(500,{'error':'Ошибка обработки'})
    def do_POST(self):
        try:
            self.rate()
            origin=self.headers.get('Origin','')
            host=self.headers.get('Host','')
            if origin and urlparse(origin).netloc!=host:raise PermissionError('Запрещённый источник')
            path=self.endpoint()
            data=self.payload()
            if path=='register':
                name=str(data.get('username','')).strip()
                password=str(data.get('password',''))
                if not re.fullmatch('[A-Za-z0-9_]{3,24}',name):raise ValueError('Логин: 3–24 латинских символа, цифры или _')
                if len(password)<10 or len(password)>128:raise ValueError('Пароль: минимум 10 символов')
                with connect() as db:
                    if db.execute('SELECT 1 FROM users WHERE username=? COLLATE NOCASE',(name,)).fetchone():raise ValueError('Такой логин уже занят')
                    db.execute('INSERT INTO users(username,passhash,created) VALUES(?,?,?)',(name,pwd_hash(password),int(time.time())))
                return self.send(201,{'ok':True})
            if path=='login':
                name=str(data.get('username','')).strip()
                password=str(data.get('password',''))
                with connect() as db:r=db.execute('SELECT id,username,passhash,role FROM users WHERE username=? COLLATE NOCASE',(name,)).fetchone()
                if not r or not pwd_ok(password,r['passhash']):raise ValueError('Неверный логин или пароль')
                token=secrets.token_hex(32)
                with connect() as db:db.execute('INSERT INTO sessions(tokenhash,user_id,expires) VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),r['id'],int(time.time())+604800))
                return self.send(data={'ok':True,'username':r['username']},cookie='nexus_session='+token+'; HttpOnly; Secure; SameSite=Strict; Path=/nexus-city; Max-Age=604800')
            if path=='change-password':
                u=self.require()
                old=str(data.get('old_password',''))
                new=str(data.get('new_password',''))
                if not 10<=len(new)<=128:raise ValueError('Новый пароль: от 10 до 128 символов')
                with connect() as db:
                    row=db.execute('SELECT passhash FROM users WHERE id=?',(u['id'],)).fetchone()
                    if not row or not pwd_ok(old,row['passhash']):raise ValueError('Неверный текущий пароль')
                    db.execute('UPDATE users SET passhash=? WHERE id=?',(pwd_hash(new),u['id']))
                    db.execute('DELETE FROM sessions WHERE user_id=?',(u['id'],))
                return self.send(data={'ok':True,'relogin':True},cookie='nexus_session=; HttpOnly; Secure; SameSite=Strict; Path=/nexus-city; Max-Age=0')
            if path=='logout':
                cookie=self.headers.get('Cookie','')
                match=re.search(r'nexus_session=([0-9a-f]{64})',cookie)
                if match:
                    with connect() as db:db.execute('DELETE FROM sessions WHERE tokenhash=?',(hashlib.sha256(match.group(1).encode()).hexdigest(),))
                return self.send(data={'ok':True},cookie='nexus_session=; HttpOnly; Secure; SameSite=Strict; Path=/nexus-city; Max-Age=0')
            if path=='applications':
                u=self.require()
                faction=str(data.get('faction',''))
                name=str(data.get('character_name','')).strip()
                experience=str(data.get('experience','')).strip()
                if faction not in ('Police','FIB','EMS','Army','Mayor','News'):raise ValueError('Выберите структуру')
                if not (3<=len(name)<=70 and 15<=len(experience)<=1500):raise ValueError('Укажите имя персонажа и информацию о себе (минимум 15 символов)')
                with connect() as db:db.execute('INSERT INTO applications(user_id,faction,character_name,experience,created) VALUES(?,?,?,?,?)',(u['id'],faction,name,experience,int(time.time())))
                return self.send(201,{'ok':True})
            if path=='tickets':
                u=self.require()
                topic=str(data.get('topic','')).strip()
                subject=str(data.get('subject','')).strip()
                message=str(data.get('message','')).strip()
                if topic not in ('Техническая проблема','Жалоба','Апелляция','Вопрос по игре','Другое'):raise ValueError('Укажите тему обращения')
                if not 5<=len(subject)<=130 or not 20<=len(message)<=3500:raise ValueError('Заголовок от 5 символов, описание от 20 символов')
                with connect() as db:
                    recent=db.execute('SELECT COUNT(*) FROM support_tickets WHERE user_id=? AND created>?',(u['id'],int(time.time())-3600)).fetchone()[0]
                    if recent>=5:raise RuntimeError('Не более 5 обращений в час')
                    db.execute('INSERT INTO support_tickets(user_id,topic,subject,message,created,updated) VALUES(?,?,?,?,?,?)',(u['id'],topic,subject,message,int(time.time()),int(time.time())))
                return self.send(201,{'ok':True})
            if path=='admin/ticket/reply':
                u=self.require()
                if u['role']!='admin':raise PermissionError('Только администрация')
                status=str(data.get('status','')).strip()
                reply=str(data.get('staff_reply','')).strip()
                if status not in ('Открыто','В работе','Закрыто') or len(reply)>3500:raise ValueError('Недопустимые данные')
                with connect() as db:
                    cur=db.execute('UPDATE support_tickets SET status=?,staff_reply=?,updated=? WHERE id=?',(status,reply,int(time.time()),int(data.get('id',0))))
                    if cur.rowcount==0:raise ValueError('Обращение не найдено')
                return self.send(data={'ok':True})
            if path=='admin/decision':
                u=self.require()
                if u['role']!='admin':raise PermissionError('Только администрация')
                status=str(data.get('status',''))
                if status not in ('Одобрено','Отклонено'):raise ValueError('Недопустимое решение')
                with connect() as db:db.execute('UPDATE applications SET status=? WHERE id=?',(status,int(data.get('id',0))))
                return self.send(data={'ok':True})
            if path=='admin/rules':
                u=self.require()
                if u['role']!='admin':raise PermissionError('Только администрация')
                rules=data.get('rules')
                if not isinstance(rules,list) or len(rules)>100 or any(not isinstance(x,str) or not 5<=len(x.strip())<=1500 for x in rules):raise ValueError('Неверный формат правил')
                with connect() as db:db.execute('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v',('rules',json.dumps(rules,ensure_ascii=False)))
                return self.send(data={'ok':True})
            if path=='admin/news/delete':
                u=self.require()
                if u['role']!='admin':raise PermissionError('Только администрация')
                with connect() as db:db.execute('DELETE FROM news WHERE id=?',(int(data.get('id',0)),))
                return self.send(data={'ok':True})
            if path=='admin/news':
                u=self.require()
                if u['role']!='admin':raise PermissionError('Только администрация')
                title=str(data.get('title','')).strip()
                body=str(data.get('body','')).strip()
                if not(4<=len(title)<=140 and 10<=len(body)<=3000):raise ValueError('Заполните заголовок и текст')
                with connect() as db:db.execute('INSERT INTO news(title,body,created) VALUES(?,?,?)',(title,body,int(time.time())))
                return self.send(201,{'ok':True})
            return self.send(404,{'error':'Не найдено'})
        except ValueError as e:self.send(400,{'error':str(e)})
        except PermissionError as e:self.send(403,{'error':str(e)})
        except RuntimeError as e:self.send(429,{'error':str(e)})
        except (TypeError,KeyError,json.JSONDecodeError):self.send(400,{'error':'Некорректный запрос'})
        except Exception as e:self.send(500,{'error':'Ошибка обработки'})
if __name__=='__main__':
    init()
    ThreadingHTTPServer(('127.0.0.1',18852),Handler).serve_forever()