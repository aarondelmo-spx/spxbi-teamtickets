const assert = require('node:assert/strict');

const RoleHelpers = require('../js/role-helpers.js');

function run() {
  assert.equal(RoleHelpers.normalizeUserRole('viewer'), 'viewer');
  assert.equal(RoleHelpers.normalizeUserRole('editor'), 'editor');
  assert.equal(RoleHelpers.normalizeUserRole('ADMIN'), 'admin');
  assert.equal(RoleHelpers.normalizeUserRole(''), 'admin');

  assert.equal(
    RoleHelpers.resolveUserRole('viewer', 'owner@spxexpress.com', 'owner@spxexpress.com'),
    'admin'
  );
  assert.equal(
    RoleHelpers.resolveUserRole('viewer', 'viewer@spxexpress.com', 'owner@spxexpress.com'),
    'viewer'
  );

  assert.equal(RoleHelpers.roleCanEditContent('viewer'), false);
  assert.equal(RoleHelpers.roleCanEditContent('editor'), true);
  assert.equal(RoleHelpers.roleCanManageUsers('editor'), false);
  assert.equal(RoleHelpers.roleCanManageUsers('admin'), true);
  assert.equal(RoleHelpers.roleIsAssignable('viewer'), false);
  assert.equal(RoleHelpers.roleIsAssignable('editor'), true);
  assert.equal(RoleHelpers.roleLabel('viewer'), 'Viewer');
}

run();
console.log('role-helpers tests passed');
