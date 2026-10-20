import crypto from 'node:crypto';
import { scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
export function hashPassword(password,salt=randomBytes(16).toString('hex')){
 if(typeof password!=='string'||password.length<12) throw new Error('Password must have at least 12 characters');
 return salt+':'+scryptSync(password,salt,64).toString('hex');
}
export function verifyPassword(password,stored){
 if(typeof password!=='string'||typeof stored!=='string') return false;
 const [salt,hex]=stored.split(':');if(!/^[a-f0-9]{32}$/.test(salt||'')||!/^[a-f0-9]{128}$/.test(hex||''))return false;
 const actual=scryptSync(password,salt,64),expected=Buffer.from(hex,'hex');
 return timingSafeEqual(actual,expected);
}
export function createSessionToken(){return randomBytes(32).toString('base64url')}
export function tokenDigest(token){return crypto.createHash('sha256').update(token).digest('hex')}
export function parseCookie(header,name){
 return String(header||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
}
export function secureSessionCookie(token,ttl=28800){return 'brill_session='+token+'; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age='+ttl}
