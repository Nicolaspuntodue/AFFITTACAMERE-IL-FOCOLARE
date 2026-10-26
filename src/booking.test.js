// node src/booking.test.js
import assert from 'node:assert/strict';
import { quote } from './booking.js';

assert.deepEqual(quote('bilocale', '2026-11-12', '2026-11-14', 2), { nights: 2, perNight: 70, total: 140 });
assert.equal(quote('bilocale', '2026-11-12', '2026-11-14', 4).total, 2 * (70 + 2 * 15));
assert.equal(quote('superior', '2026-11-12', '2026-11-13', 6).total, 95 + 2 * 15);
// DST change in late March must not change the night count
assert.equal(quote('superior', '2027-03-27', '2027-03-29', 4).nights, 2);
assert.ok(quote('bilocale', '2026-11-12', '2026-11-13', 5).error);
assert.ok(quote('bilocale', '2026-11-14', '2026-11-14').error);
assert.ok(quote('bilocale', '', '2026-11-14').error);
assert.ok(quote('villa', '2026-11-12', '2026-11-14').error);
console.log('booking ok');
