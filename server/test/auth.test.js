import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,createSessionToken,tokenDigest,parseCookie,secureSessionCookie} from '../src/auth.js';
test('password hash verifies valid password and rejects incorrect one',()=>{const h=hashPassword('a long test password 2026');assert.equal(verifyPassword('a long test password 2026',h),true);assert.equal(verifyPassword('wrong password',h),false)});
test('short passwords rejected',()=>assert.throws(()=>hashPassword('short')));
test('session tokens are unique and hashed',()=>{const a=createSessionToken(),b=createSessionToken();assert.notEqual(a,b);assert.equal(tokenDigest(a).length,64)});
test('session cookie has security flags',()=>{const c=secureSessionCookie(createSessionToken());assert.match(c,/HttpOnly/);assert.match(c,/Secure/);assert.match(c,/SameSite=Strict/);assert.equal(parseCookie('foo=bar; brill_session=abc','brill_session'),'abc')});
