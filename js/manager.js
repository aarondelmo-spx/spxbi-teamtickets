function openManagerView(){
  window.location.href = window.location.pathname + '?view=manager';
}

function exitManagerView(){
  window.location.href = window.location.pathname;
}

function isAccessAdmin(){
  return (App.currentUserEmail || '').toLowerCase() === (App.ADMIN_EMAIL || '').toLowerCase();
}

function showManagerView(){
  document.querySelector('.app').classList.add('app--manager-mode');

  document.querySelector('.main').innerHTML =
    '<div class="manager-view access-manager-view" id="manager-view">'
    + '<div class="manager-header">'
    +   '<div><div class="page-title">Team &amp; access</div><div class="page-sub" id="manager-sub">Manage contributor names and sign-in access.</div></div>'
    +   '<button class="manager-back" onclick="exitManagerView()">&#8592; Back to projects</button>'
    + '</div>'
    + '<div class="manager-stats" id="manager-stats-row">'
    +   '<div class="manager-stat"><div class="manager-stat-label">Team members</div><div class="manager-stat-num" id="mgr-team-count">0</div></div>'
    +   '<div class="manager-stat"><div class="manager-stat-label">Access entries</div><div class="manager-stat-num" id="mgr-access-count">0</div></div>'
    +   '<div class="manager-stat"><div class="manager-stat-label">Signed in as</div><div class="manager-stat-text" id="mgr-current-user">-</div></div>'
    + '</div>'
    + '<div class="manager-grid">'
    +   '<section class="manager-panel">'
    +     '<div class="manager-panel-head"><div><div class="manager-section-title">Team roster</div><p>These names appear in contributor and owner pickers.</p></div></div>'
    +     '<div id="manager-team-list"><div class="loading">Loading...</div></div>'
    +     '<div class="manager-add-row">'
    +       '<input id="manager-team-name-input" placeholder="Add team member name..." maxlength="30" onkeydown="if(event.key===\'Enter\')addManagerTeamMember()" />'
    +       '<button class="btn btn-primary btn-sm" onclick="addManagerTeamMember()" type="button">Add</button>'
    +     '</div>'
    +   '</section>'
    +   '<section class="manager-panel">'
    +     '<div class="manager-panel-head"><div><div class="manager-section-title">Access control</div><p id="manager-access-note">Only whitelisted emails can sign in.</p></div></div>'
    +     '<div id="manager-access-list"><div class="loading">Loading...</div></div>'
    +     '<div class="manager-add-row manager-access-add-row" id="manager-access-add-row">'
    +       '<input id="manager-access-email-input" placeholder="email@spxexpress.com" type="email" onkeydown="if(event.key===\'Enter\')addManagerAccessEntry()" />'
    +       '<input id="manager-access-name-input" placeholder="Display name" maxlength="30" onkeydown="if(event.key===\'Enter\')addManagerAccessEntry()" />'
    +       '<button class="btn btn-primary btn-sm" onclick="addManagerAccessEntry()" type="button">Add</button>'
    +     '</div>'
    +   '</section>'
    + '</div>'
    + '<div class="manager-ts" id="manager-ts"></div>'
    + '</div>';

  App.teamRef.on('value', function(snap){
    var data = snap.val() || {};
    App.teamMembers = Object.entries(data).map(function(entry){
      return {id:entry[0], name:entry[1].name};
    }).filter(function(member){ return !!member.name; }).sort(function(a,b){
      return a.name.localeCompare(b.name);
    });
    renderManagerTeamAccessView();
  });

  App.whitelistRef.on('value', function(snap){
    App.managerWhitelistEntries = Object.entries(snap.val() || {}).map(function(entry){
      return {
        id: entry[0],
        email: (entry[1].email || '').toLowerCase(),
        name: entry[1].name || ''
      };
    }).filter(function(entry){ return !!entry.email; }).sort(function(a,b){
      return a.email.localeCompare(b.email);
    });
    renderManagerTeamAccessView();
  });

  renderManagerTeamAccessView();
}

function renderManagerTeamAccessView(){
  var teamMembers = App.teamMembers || [];
  var accessEntries = App.managerWhitelistEntries || [];
  var teamCount = document.getElementById('mgr-team-count');
  var accessCount = document.getElementById('mgr-access-count');
  var currentUser = document.getElementById('mgr-current-user');
  var accessNote = document.getElementById('manager-access-note');
  var accessAdd = document.getElementById('manager-access-add-row');
  var tsEl = document.getElementById('manager-ts');

  if(teamCount) teamCount.textContent = teamMembers.length;
  if(accessCount) accessCount.textContent = accessEntries.length;
  if(currentUser) currentUser.textContent = (App.currentUser || 'Unknown') + ' / ' + (App.currentUserEmail || 'no email');
  if(accessNote) accessNote.textContent = isAccessAdmin() ? 'Only whitelisted emails can sign in.' : 'Access control is visible to admins only.';
  if(accessAdd) accessAdd.style.display = isAccessAdmin() ? 'grid' : 'none';
  if(tsEl) tsEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString();

  renderManagerTeamList(teamMembers);
  renderManagerAccessList(accessEntries);
}

function renderManagerTeamList(teamMembers){
  var el = document.getElementById('manager-team-list');
  if(!el) return;
  if(!teamMembers.length){
    el.innerHTML = '<div class="manager-empty">No team members yet.</div>';
    return;
  }
  el.innerHTML = teamMembers.map(function(member){
    var c = colorFor(member.name);
    return '<div class="manager-person-row">'
      + '<div class="manager-person-avatar" style="background:'+c+'22;color:'+c+'">'+initials(member.name)+'</div>'
      + '<div class="manager-person-main"><div class="manager-person-name">'+safeText(member.name)+'</div><div class="manager-person-sub">Contributor picker name</div></div>'
      + '<button class="btn-icon" onclick="removeManagerTeamMember(\''+jsArg(member.id)+'\')" title="Remove">x</button>'
      + '</div>';
  }).join('');
}

function renderManagerAccessList(accessEntries){
  var el = document.getElementById('manager-access-list');
  if(!el) return;
  if(!isAccessAdmin()){
    el.innerHTML = '<div class="manager-empty">Ask the admin to add or remove sign-in access.</div>';
    return;
  }
  if(!accessEntries.length){
    el.innerHTML = '<div class="manager-empty">No access entries yet.</div>';
    return;
  }
  el.innerHTML = accessEntries.map(function(entry){
    var isSelf = entry.email === (App.currentUserEmail || '').toLowerCase();
    return '<div class="manager-person-row">'
      + '<div class="manager-person-avatar">'+initials(entry.name || entry.email)+'</div>'
      + '<div class="manager-person-main"><div class="manager-person-name">'+safeText(entry.name || 'Unnamed')+(isSelf?' <span class="manager-self-tag">You</span>':'')+'</div><div class="manager-person-sub">'+safeText(entry.email)+'</div></div>'
      + (isSelf ? '<button class="btn-icon" disabled title="Current user">x</button>' : '<button class="btn-icon" onclick="removeManagerAccessEntry(\''+jsArg(entry.id)+'\')" title="Remove access">x</button>')
      + '</div>';
  }).join('');
}

window.addManagerTeamMember = function(){
  var input = document.getElementById('manager-team-name-input');
  var name = input ? input.value.trim() : '';
  if(!name) return;
  if((App.teamMembers || []).some(function(member){ return member.name.toLowerCase() === name.toLowerCase(); })){
    if(input) input.value = '';
    return;
  }
  App.teamRef.push({name:name});
  if(input) input.value = '';
};

window.removeManagerTeamMember = function(id){
  if(!id) return;
  App.teamRef.child(id).remove();
};

window.addManagerAccessEntry = function(){
  if(!isAccessAdmin()) return;
  var emailInput = document.getElementById('manager-access-email-input');
  var nameInput = document.getElementById('manager-access-name-input');
  var email = emailInput ? emailInput.value.trim().toLowerCase() : '';
  var name = nameInput ? nameInput.value.trim() : '';
  if(!email || !name) return;
  if((App.managerWhitelistEntries || []).some(function(entry){ return entry.email === email; })){
    if(emailInput) emailInput.value = '';
    if(nameInput) nameInput.value = '';
    return;
  }
  App.whitelistRef.push({email:email, name:name});
  if(emailInput) emailInput.value = '';
  if(nameInput) nameInput.value = '';
};

window.removeManagerAccessEntry = function(id){
  if(!isAccessAdmin() || !id) return;
  App.whitelistRef.child(id).remove();
};
