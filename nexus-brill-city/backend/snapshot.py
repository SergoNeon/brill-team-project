#!/usr/bin/env python3
import subprocess, json, os, time
root='/opt/nexus-city-web'
query="SELECT name,level,connected_seconds FROM nexus_rpv_qa.characters WHERE name IS NOT NULL AND name <> '' ORDER BY level DESC, connected_seconds DESC LIMIT 20"
script='MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N --batch --raw -e '+__import__('shlex').quote(query)
p=subprocess.run(['docker','exec','nexus-rpv-mysql8-qa','sh','-lc',script],capture_output=True,text=True,timeout=12,check=True)
ranking=[]
for line in p.stdout.splitlines():
    fields=line.split('\t')
    if len(fields)!=3:continue
    name,level,seconds=fields
    try:
        if not (1<=len(name)<=70):continue
        ranking.append({'name':name,'level':max(0,int(level)),'hours':max(0,int(seconds))//3600})
    except ValueError:continue
path=root+'/game_snapshot.json'
temp=path+'.tmp'
with open(temp,'w') as f:json.dump({'ranking':ranking,'updated_at':int(time.time()),'source':'nexus_rpv_qa.characters'},f,ensure_ascii=False)
os.chmod(temp,0o640)
os.chown(temp,__import__('pwd').getpwnam('nexusweb').pw_uid,__import__('grp').getgrnam('nexusweb').gr_gid)
os.replace(temp,path)
print('Exported '+str(len(ranking))+' public leaderboard rows')