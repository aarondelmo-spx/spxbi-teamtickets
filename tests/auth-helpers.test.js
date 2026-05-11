const assert = require('node:assert/strict');

const AuthHelpers = require('../js/auth-helpers.js');

function run() {
  let domains = AuthHelpers.collectAllowedLoginDomains([
    { email: 'karl.kue@spxexpress.com' },
    { email: 'aliya.galang@spxexpress.com' }
  ]);

  assert.deepEqual(domains, ['spxexpress.com']);
  assert.equal(AuthHelpers.getLoginHostedDomain(domains), 'spxexpress.com');
  assert.equal(
    AuthHelpers.getLoginSubtext(domains),
    'Sign in with your approved spxexpress.com Google account to continue.'
  );

  domains = AuthHelpers.collectAllowedLoginDomains([
    { email: 'karl.kue@spxexpress.com' },
    { email: 'juan.sanjuan@shopee.com' }
  ]);

  assert.deepEqual(domains, ['shopee.com', 'spxexpress.com']);
  assert.equal(AuthHelpers.getLoginHostedDomain(domains), '');
  assert.equal(
    AuthHelpers.getLoginSubtext(domains),
    'Sign in with your approved Google account to continue.'
  );
}

run();
console.log('auth-helpers tests passed');
