function normalizeTeamMemberRecord(id, raw){
  raw = raw || {};
  return {
    id: id,
    name: (raw.name || '').trim(),
    legacy: true,
    source: 'team'
  };
}

function normalizeUserRole(role){
  role = String(role || '').toLowerCase();
  return role === 'viewer' || role === 'editor' || role === 'admin' ? role : 'admin';
}

function normalizeWhitelistUserRecord(id, raw){
  raw = raw || {};
  var email = String(raw.email || '').trim().toLowerCase();
  return {
    id: id,
    email: email,
    name: String(raw.name || '').trim(),
    role: 'admin',
    storedRole: String(raw.role || '').toLowerCase(),
    legacy: false,
    source: 'whitelist'
  };
}

function userIsAssignable(user){
  return !!user && (user.role === 'editor' || user.role === 'admin');
}

function userIsEffectiveAdmin(user){
  if(!user) return false;
  return user.role === 'admin' || (!!user.email && user.email === String(App.ADMIN_EMAIL || '').toLowerCase());
}

function currentUserRecord(){
  var email = String(App.currentUserEmail || '').toLowerCase();
  return (App.users || []).find(function(user){ return user.email === email; }) || null;
}

function isCurrentUserAdmin(){
  return userIsEffectiveAdmin(currentUserRecord()) || String(App.currentUserEmail || '').toLowerCase() === String(App.ADMIN_EMAIL || '').toLowerCase();
}

function promoteAllWhitelistUsersToAdmin(){
  if(!isCurrentUserAdmin()) return;
  (App.users || []).forEach(function(user){
    if(!user.id || user.storedRole === 'admin') return;
    App.whitelistRef.child(user.id).update({role:'admin'});
  });
}

function assignmentNameKey(name){
  return String(name || '').trim().toLowerCase();
}

function collectAssignedNamesFromTickets(tickets){
  var names = {};
  function add(name){
    name = String(name || '').trim();
    if(!name || name === 'Unassigned') return;
    names[assignmentNameKey(name)] = name;
  }
  Object.values(tickets || {}).forEach(function(ticket){
    add(ticket && ticket.assignee);
    (ticket && ticket.contributors || []).forEach(add);
    Object.values((ticket && ticket.subtasks) || {}).forEach(function(subtask){
      (subtask && subtask.contributors || []).forEach(add);
    });
  });
  return Object.values(names);
}

function rebuildTeamMembers(){
  var byName = {};
  var whitelistNameKeys = {};
  var active = [];
  var legacy = [];

  function add(member, target){
    if(!member || !member.name) return;
    var key = assignmentNameKey(member.name);
    if(!key || byName[key]) return;
    byName[key] = true;
    target.push(member);
  }

  (App.users || []).forEach(function(user){
    if(user.name) whitelistNameKeys[assignmentNameKey(user.name)] = true;
    if(!userIsAssignable(user) || !user.name) return;
    add({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      assignable: true,
      legacy: false,
      source: 'whitelist'
    }, active);
  });

  (App.legacyTeamMembers || []).forEach(function(member){
    if(whitelistNameKeys[assignmentNameKey(member.name)]) return;
    add({
      id: member.id,
      name: member.name,
      assignable: false,
      legacy: true,
      source: 'team'
    }, legacy);
  });

  collectAssignedNamesFromTickets(App.mainTickets).concat(collectAssignedNamesFromTickets(App.sprintTickets)).forEach(function(name){
    add({
      id: 'assigned-' + assignmentNameKey(name).replace(/[^a-z0-9]+/g, '-'),
      name: name,
      assignable: false,
      legacy: true,
      source: 'assignment'
    }, legacy);
  });

  active.sort(function(a,b){ return a.name.localeCompare(b.name); });
  legacy.sort(function(a,b){ return a.name.localeCompare(b.name); });
  App.teamMembers = active.concat(legacy);
}

function pickerMembersForSelection(selected){
  var selectedSet = {};
  (selected || []).forEach(function(name){ selectedSet[assignmentNameKey(name)] = true; });
  return (App.teamMembers || []).filter(function(member){
    return !member.legacy || selectedSet[assignmentNameKey(member.name)];
  });
}

function assignmentPickerNames(selected){
  selected = selected ? (Array.isArray(selected) ? selected : [selected]) : [];
  var seen = {};
  var names = pickerMembersForSelection(selected).map(function(member){
    seen[assignmentNameKey(member.name)] = true;
    return member.name;
  });
  selected.forEach(function(name){
    var key = assignmentNameKey(name);
    if(name && !seen[key]){
      seen[key] = true;
      names.unshift(name);
    }
  });
  return names;
}

function refreshAllPickers(){
  renderContribPicker('nt-contributor-picker', App.ntSelectedContribs, function(sel){ App.ntSelectedContribs=sel; });
  if(App.selectedTicketId) renderContribPicker('d-contributor-picker', App.dSelectedContribs, function(sel){ App.dSelectedContribs=sel; saveContributors(); });
  renderContribPicker('subtask-contributor-picker', App.stSelectedContribs, function(sel){ App.stSelectedContribs=sel; });
}

function renderContribPicker(containerId, selected, onChange){
  var el = document.getElementById(containerId); if(!el) return;
  selected = selected || [];
  var members = pickerMembersForSelection(selected);
  if(!members.length){
    el.innerHTML='<div style="font-size:12px;color:var(--text3)">No assignable users yet.</div>';
    return;
  }
  el.innerHTML = members.map(function(m){
    var isSel = selected.indexOf(m.name)>-1;
    var c = colorFor(m.name);
    return '<button class="contributor-chip'+(isSel?' selected':'')+'" onclick="toggleContrib(\''+jsArg(containerId)+'\',\''+jsArg(m.name)+'\')" type="button">'
      +'<div class="chip-av" style="background:'+c+'22;color:'+c+'">'+safeText(initials(m.name))+'</div>'
      +safeText(m.name)+(m.legacy?' <span class="chip-note">legacy</span>':'')+'</button>';
  }).join('');
}

window.toggleContrib = function(containerId, name){
  var sel, onChange;
  if(containerId==='nt-contributor-picker'){ sel=App.ntSelectedContribs; onChange=function(s){App.ntSelectedContribs=s;}; }
  else if(containerId==='d-contributor-picker'){ sel=App.dSelectedContribs; onChange=function(s){App.dSelectedContribs=s;saveContributors();}; }
  else { sel=App.stSelectedContribs; onChange=function(s){App.stSelectedContribs=s;}; }
  var idx=sel.indexOf(name);
  if(idx>-1) sel.splice(idx,1); else sel.push(name);
  onChange(sel);
  renderContribPicker(containerId, sel, onChange);
  if(containerId==='d-contributor-picker') renderContributorsDisplay();
};

function saveContributors(){
  if(!App.selectedTicketId) return;
  var upd = {
    contributors: App.dSelectedContribs.length ? App.dSelectedContribs : null
  };
  if(!isSprintView()) upd.assignee = App.dSelectedContribs[0]||'Unassigned';
  activeTicketRef(App.selectedTicketId).update(upd);
  if(typeof refreshAfterTicketUpdate === 'function') refreshAfterTicketUpdate(App.selectedTicketId, upd);
  var t=App.allTickets[App.selectedTicketId];
  if(t) logActivity('updatedcontribs',t.title,App.dSelectedContribs.join(', ')||'none',App.selectedTicketId);
}

function renderContributorsDisplay(){
  var el=document.getElementById('d-contributors-display'); if(!el) return;
  if(!App.dSelectedContribs.length){ el.innerHTML=''; return; }
  el.innerHTML=App.dSelectedContribs.map(function(n){
    var c=colorFor(n);
    return '<div class="contrib-tag"><div style="width:14px;height:14px;border-radius:50%;background:'+c+'22;color:'+c+';display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:500">'+safeText(initials(n))+'</div><span style="font-size:12px;color:var(--text2)">'+safeText(n)+'</span></div>';
  }).join('');
}

window.openTeamModal = function(){ openManagerView(); };
window.closeTeamModal = function(){ var modal = document.getElementById('team-modal'); if(modal) modal.style.display='none'; };
window.addTeamMember = function(){
  openManagerView();
};
window.removeTeamMember = function(id){
  openManagerView();
};
function renderTeamList(){
  var el=document.getElementById('team-member-list'); if(!el) return;
  if(!App.teamMembers.length){ el.innerHTML='<div style="font-size:12px;color:var(--text3);margin-bottom:.5rem">No team members yet.</div>'; return; }
  el.innerHTML=App.teamMembers.map(function(m){
    var c=colorFor(m.name);
    return '<div class="team-member-row">'
      +'<div style="width:24px;height:24px;border-radius:50%;background:'+c+'22;color:'+c+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:500;flex-shrink:0">'+safeText(initials(m.name))+'</div>'
      +'<span style="flex:1;font-size:13px">'+safeText(m.name)+'</span>'
      +'<button class="btn-icon" onclick="removeTeamMember(\''+m.id+'\')" title="Remove">✕</button>'
      +'</div>';
  }).join('');
}
