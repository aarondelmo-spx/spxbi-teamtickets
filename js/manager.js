function openManagerView(){
  if(!requireAdminAccess('manage users')) return;
  window.location.href = window.location.pathname + '?view=manager';
}

function exitManagerView(){
  window.location.href = window.location.pathname;
}

function isAccessAdmin(){
  return canManageUsers();
}

function showManagerView(){
  document.querySelector('.app').classList.add('app--manager-mode');

  document.querySelector('.main').innerHTML =
    '<div class="manager-view access-manager-view" id="manager-view">'
    + '<div class="manager-header">'
    +   '<div><div class="page-title">Users</div><div class="page-sub" id="manager-sub">Manage sign-in access, roles, and assignable display names.</div></div>'
    +   '<button class="manager-back" onclick="exitManagerView()">&#8592; Back to projects</button>'
    + '</div>'
    + '<div class="manager-stats" id="manager-stats-row">'
    +   '<div class="manager-stat"><div class="manager-stat-label">Users</div><div class="manager-stat-num" id="mgr-user-count">0</div></div>'
    +   '<div class="manager-stat"><div class="manager-stat-label">Admins</div><div class="manager-stat-num" id="mgr-admin-count">0</div></div>'
    +   '<div class="manager-stat"><div class="manager-stat-label">Assignable</div><div class="manager-stat-num" id="mgr-assignable-count">0</div></div>'
    +   '<div class="manager-stat"><div class="manager-stat-label">Signed in as</div><div class="manager-stat-text" id="mgr-current-user">-</div></div>'
    + '</div>'
    + '<div class="manager-grid manager-grid-users">'
    +   '<section class="manager-panel">'
    +     '<div class="manager-panel-head"><div><div class="manager-section-title">Whitelist users</div><p id="manager-access-note">Viewer = read-only with comments. Editor = can edit projects. Admin = editor + user management.</p></div></div>'
    +     '<div class="manager-error" id="manager-error" style="display:none"></div>'
    +     '<div id="manager-user-list"><div class="loading">Loading...</div></div>'
    +     '<div class="manager-add-row manager-user-add-row" id="manager-user-add-row">'
    +       '<input id="manager-user-name-input" placeholder="Display name" maxlength="30" onkeydown="if(event.key===\'Enter\')addManagerUser()" />'
    +       '<input id="manager-user-email-input" placeholder="approved-user@company.com" type="email" onkeydown="if(event.key===\'Enter\')addManagerUser()" />'
    +       '<select id="manager-user-role-input" aria-label="Role">'+managerRoleOptions('admin')+'</select>'
    +       '<button class="btn btn-primary btn-sm" onclick="addManagerUser()" type="button">Add</button>'
    +     '</div>'
    +   '</section>'
    +   '<section class="manager-panel" id="manager-legacy-panel">'
    +     '<div class="manager-panel-head"><div><div class="manager-section-title">Legacy assignable names</div><p>These names remain for old tickets but cannot sign in. Add a whitelist user with the same display name to convert one.</p></div></div>'
    +     '<div id="manager-legacy-list"><div class="loading">Loading...</div></div>'
    +   '</section>'
    + '</div>'
    + '<div class="manager-ts" id="manager-ts"></div>'
    + '</div>';

  renderManagerTeamAccessView();
}

function setManagerMessage(message){
  var el = document.getElementById('manager-error');
  if(!el) return;
  el.textContent = message || '';
  el.style.display = message ? 'block' : 'none';
}

function managerFieldId(field, id){
  return 'mgr-user-' + field + '-' + domId(id);
}

function managerRoleOptions(role){
  var roles = [
    {value:'viewer', label:'Viewer'},
    {value:'editor', label:'Editor'},
    {value:'admin', label:'Admin'}
  ];
  return roles.map(function(option){
    return '<option value="'+option.value+'"'+(role===option.value?' selected':'')+'>'+option.label+'</option>';
  }).join('');
}

function managerAdminCount(){
  return (App.users || []).filter(userIsEffectiveAdmin).length;
}

function isSelfUser(user){
  return !!user && user.email === String(App.currentUserEmail || '').toLowerCase();
}

function duplicateWhitelistEmail(email, excludeId){
  email = String(email || '').toLowerCase();
  return (App.users || []).some(function(user){
    return user.id !== excludeId && user.email === email;
  });
}

function duplicateWhitelistName(name, excludeId){
  var key = assignmentNameKey(name);
  return (App.users || []).some(function(user){
    return user.id !== excludeId && assignmentNameKey(user.name) === key;
  });
}

function managerRoleBadge(user){
  var role = normalizeUserRole(user && user.role);
  var cls = userRoleBadgeClass(role);
  return '<span class="manager-role-badge '+cls+'">'+safeText(RoleHelpers.roleLabel(role))+'</span>';
}

function renderManagerTeamAccessView(){
  var users = App.users || [];
  var legacyMembers = (App.teamMembers || []).filter(function(member){ return member.legacy; });
  var userCount = document.getElementById('mgr-user-count');
  var adminCount = document.getElementById('mgr-admin-count');
  var assignableCount = document.getElementById('mgr-assignable-count');
  var currentUser = document.getElementById('mgr-current-user');
  var accessNote = document.getElementById('manager-access-note');
  var addRow = document.getElementById('manager-user-add-row');
  var tsEl = document.getElementById('manager-ts');

  if(userCount) userCount.textContent = users.length;
  if(adminCount) adminCount.textContent = users.filter(userIsEffectiveAdmin).length;
  if(assignableCount) assignableCount.textContent = users.filter(userIsAssignable).length;
  if(currentUser) currentUser.textContent = (App.currentUser || 'Unknown') + ' / ' + (App.currentUserEmail || 'no email');
  if(accessNote) accessNote.textContent = isAccessAdmin()
    ? 'Viewer = read-only with comments. Editor = can edit projects. Admin = editor + user management.'
    : 'Your current role cannot manage users.';
  if(addRow) addRow.style.display = isAccessAdmin() ? 'grid' : 'none';
  if(tsEl) tsEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString();

  renderManagerUsersList(users);
  renderManagerLegacyList(legacyMembers);
}

function renderManagerUsersList(users){
  var el = document.getElementById('manager-user-list');
  if(!el) return;
  if(!users.length){
    el.innerHTML = '<div class="manager-empty">No users yet.</div>';
    return;
  }
  var canManage = isAccessAdmin();
  el.innerHTML = users.map(function(user){
    var self = isSelfUser(user);
    var c = colorFor(user.name || user.email);
    var nameId = managerFieldId('name', user.id);
    var emailId = managerFieldId('email', user.id);
    var roleId = managerFieldId('role', user.id);
    var disabled = canManage ? '' : ' disabled';
    var removeDisabled = (!canManage || (self && userIsEffectiveAdmin(user)) || (userIsEffectiveAdmin(user) && managerAdminCount() <= 1)) ? ' disabled' : '';
    return '<div class="manager-user-row">'
      + '<div class="manager-person-avatar" style="background:'+c+'22;color:'+c+'">'+safeText(initials(user.name || user.email))+'</div>'
      + '<input id="'+nameId+'" value="'+safeText(user.name)+'" maxlength="30" aria-label="Name"'+disabled+' />'
      + '<input id="'+emailId+'" value="'+safeText(user.email)+'" type="email" aria-label="Email"'+(self ? ' disabled' : disabled)+' />'
      + '<select id="'+roleId+'" aria-label="Role"'+disabled+'>'+managerRoleOptions(user.role)+'</select>'
      + managerRoleBadge(user)
      + (self ? '<span class="manager-self-tag">You</span>' : '')
      + (canManage ? '<button class="btn btn-sm" onclick="saveManagerUser(\''+jsArg(user.id)+'\')" type="button">Save</button>' : '')
      + (canManage ? '<button class="btn-icon" onclick="removeManagerUser(\''+jsArg(user.id)+'\')" title="Remove user"'+removeDisabled+'>x</button>' : '')
      + '</div>';
  }).join('');
}

function renderManagerLegacyList(legacyMembers){
  var el = document.getElementById('manager-legacy-list');
  if(!el) return;
  if(!legacyMembers.length){
    el.innerHTML = '<div class="manager-empty">No legacy names are currently needed.</div>';
    return;
  }
  el.innerHTML = legacyMembers.map(function(member){
    var c = colorFor(member.name);
    var source = member.source === 'assignment' ? 'Assigned on existing tickets' : 'Legacy /team roster';
    return '<div class="manager-person-row">'
      + '<div class="manager-person-avatar" style="background:'+c+'22;color:'+c+'">'+safeText(initials(member.name))+'</div>'
      + '<div class="manager-person-main"><div class="manager-person-name">'+safeText(member.name)+'</div><div class="manager-person-sub">'+source+'</div></div>'
      + '<span class="manager-role-badge legacy">Legacy</span>'
      + '</div>';
  }).join('');
}

window.addManagerUser = function(){
  if(!requireAdminAccess('manage users')) return;
  var nameInput = document.getElementById('manager-user-name-input');
  var emailInput = document.getElementById('manager-user-email-input');
  var roleInput = document.getElementById('manager-user-role-input');
  var name = nameInput ? nameInput.value.trim() : '';
  var email = emailInput ? emailInput.value.trim().toLowerCase() : '';
  var role = normalizeUserRole(roleInput && roleInput.value);
  setManagerMessage('');
  if(!name || !email){ setManagerMessage('Name and email are required.'); return; }
  if(email.indexOf('@') === -1){ setManagerMessage('Enter a valid email address.'); return; }
  if(duplicateWhitelistEmail(email)){ setManagerMessage('That email is already whitelisted.'); return; }
  if(duplicateWhitelistName(name)){ setManagerMessage('That display name is already used by another whitelist user.'); return; }
  App.whitelistRef.push({email:email, name:name, role:role});
  if(nameInput) nameInput.value = '';
  if(emailInput) emailInput.value = '';
  if(roleInput) roleInput.value = 'admin';
};

window.saveManagerUser = function(id){
  if(!requireAdminAccess('manage users') || !id) return;
  var user = (App.users || []).find(function(entry){ return entry.id === id; });
  if(!user) return;
  var nameEl = document.getElementById(managerFieldId('name', id));
  var emailEl = document.getElementById(managerFieldId('email', id));
  var roleEl = document.getElementById(managerFieldId('role', id));
  var name = nameEl ? nameEl.value.trim() : '';
  var email = emailEl ? emailEl.value.trim().toLowerCase() : user.email;
  var role = normalizeUserRole(roleEl && roleEl.value);
  var next = {id:id, name:name, email:email, role:role};
  setManagerMessage('');
  if(!name || !email){ setManagerMessage('Name and email are required.'); return; }
  if(email.indexOf('@') === -1){ setManagerMessage('Enter a valid email address.'); return; }
  if(isSelfUser(user) && email !== user.email){ setManagerMessage('You cannot change your own sign-in email.'); return; }
  if(duplicateWhitelistEmail(email, id)){ setManagerMessage('That email is already whitelisted.'); return; }
  if(duplicateWhitelistName(name, id)){ setManagerMessage('That display name is already used by another whitelist user.'); return; }
  if(isSelfUser(user) && userIsEffectiveAdmin(user) && user.role !== role && role !== 'admin'){ setManagerMessage('You cannot demote yourself.'); return; }
  if(userIsEffectiveAdmin(user) && !userIsEffectiveAdmin(next) && managerAdminCount() <= 1){ setManagerMessage('At least one admin must remain.'); return; }
  App.whitelistRef.child(id).update({email:email, name:name, role:role});
};

window.removeManagerUser = function(id){
  if(!requireAdminAccess('manage users') || !id) return;
  var user = (App.users || []).find(function(entry){ return entry.id === id; });
  if(!user) return;
  setManagerMessage('');
  if(isSelfUser(user) && userIsEffectiveAdmin(user)){ setManagerMessage('You cannot remove your own admin access.'); return; }
  if(userIsEffectiveAdmin(user) && managerAdminCount() <= 1){ setManagerMessage('At least one admin must remain.'); return; }
  if(!confirm('Remove sign-in access for '+(user.name || user.email)+'? Existing ticket assignments will keep the display name.')) return;
  App.whitelistRef.child(id).remove();
};
