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

  const whitelist = {
    a1: { email: 'karl.kue@spxexpress.com', name: 'Karl' },
    b2: { email: 'juan.sanjuan@shopee.com', name: 'Kai' }
  };

  assert.deepEqual(
    AuthHelpers.findWhitelistedUser(whitelist, 'JUAN.SANJUAN@SHOPEE.COM'),
    { email: 'juan.sanjuan@shopee.com', name: 'Kai' }
  );

  const duplicateWhitelist = {
    a1: { email: 'juan.sanjuan@shopee.com', name: 'Kai', role: 'editor' },
    b2: { email: 'juan.sanjuan@shopee.com', name: 'Kai', role: 'viewer' }
  };

  assert.deepEqual(
    AuthHelpers.findWhitelistedUsers(duplicateWhitelist, 'juan.sanjuan@shopee.com'),
    [
      { email: 'juan.sanjuan@shopee.com', name: 'Kai', role: 'editor' },
      { email: 'juan.sanjuan@shopee.com', name: 'Kai', role: 'viewer' }
    ]
  );

  assert.deepEqual(
    AuthHelpers.findWhitelistedUser(duplicateWhitelist, 'juan.sanjuan@shopee.com'),
    { email: 'juan.sanjuan@shopee.com', name: 'Kai', role: 'viewer' }
  );

  assert.equal(
    AuthHelpers.getWhitelistReadErrorMessage({ code: 'PERMISSION_DENIED' }),
    'Sign in succeeded, but app access data could not be read. Check Firebase Database rules for /whitelist.'
  );

  assert.equal(
    AuthHelpers.getWhitelistReadErrorMessage(new Error('Whitelist read timed out.')),
    'Sign in succeeded, but loading your access timed out. Check the database connection and /whitelist access.'
  );
}

run();
console.log('auth-helpers tests passed');
