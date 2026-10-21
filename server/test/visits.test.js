import test from 'node:test';
import assert from 'node:assert/strict';
import {isVisitPayload,visitLimiter,validSubscription} from '../src/visit-notifications.js';
test('visit payload is bounded and relative',()=>{assert.equal(isVisitPayload({path:'/',referrer:''}),true);assert.equal(isVisitPayload({path:'//evil',referrer:''}),false);assert.equal(isVisitPayload({path:'https://evil',referrer:''}),false);assert.equal(isVisitPayload({path:'/',referrer:'x'.repeat(251)}),false)});
test('repeat visits are deduplicated',()=>{const allow=visitLimiter();assert.equal(allow('a'),true);assert.equal(allow('a'),false);assert.equal(allow('b'),true)});
test('invalid push subscriptions are rejected',()=>{assert.equal(validSubscription({endpoint:'http://evil',keys:{p256dh:'x',auth:'y'}}),false);assert.equal(validSubscription({endpoint:'https://push.example/sub',keys:{p256dh:'x',auth:'y'}}),true)});
