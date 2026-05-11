window.addEventListener('popstate', function(){
  var _p = new URLSearchParams(window.location.search);
  if(_p.get('view') === 'sprint') {
    App.currentProjectView = 'sprint';
    App.currentVibeView = _p.get('tab') === 'sprint' ? 'sprint' : 'initiatives';
  } else {
    App.currentProjectView = 'main';
    App.currentVibeView = 'initiatives';
  }
  resetFiltersForView();
  refreshActiveTickets();
});

function startApp(){
  var _params = new URLSearchParams(window.location.search);
  var managerMode = _params.get('view') === 'manager';
  if(managerMode){
    showManagerView();
  }
  if(_params.get('view') === 'sprint') {
    App.currentProjectView = 'sprint';
    App.currentVibeView = _params.get('tab') === 'sprint' ? 'sprint' : 'initiatives';
  }
  resetFiltersForView();
  App.sessionControlRef.on('value', function(snap){
    var data = snap.val() || {};
    var version = Number(data.forceLogoutVersion || 0);
    App.sessionControl = data;
    if(!App.currentUserEmail || !version || !App.sessionStartedAt) return;
    if(version <= App.sessionStartedAt || version === App.forceLogoutSeen) return;
    App.forceLogoutSeen = version;
    console.warn('[session] forced logout triggered', data);
    if(typeof showForcedLogoutMessage === 'function'){
      showForcedLogoutMessage('Your session was closed by an admin. Please sign in again.');
    }
    App.auth.signOut();
  });
  App.whitelistRef.on('value', function(snap){
    App.whitelist = {};
    var data = snap.val()||{};
    if(typeof syncLoginAccessMessaging === 'function') syncLoginAccessMessaging(data);
    var prevUsersById = {};
    (App.users || []).forEach(function(user){
      prevUsersById[user.id] = user;
    });
    App.users = Object.entries(data).map(function(entry){
      return normalizeWhitelistUserRecord(entry[0], entry[1]);
    }).filter(function(user){ return !!user.email; }).sort(function(a,b){
      return (a.name || a.email).localeCompare(b.name || b.email);
    });
    var duplicatesByEmail = {};
    App.users.forEach(function(user){
      duplicatesByEmail[user.email] = (duplicatesByEmail[user.email] || 0) + 1;
    });
    Object.keys(duplicatesByEmail).forEach(function(email){
      if(duplicatesByEmail[email] > 1){
        console.warn('[whitelist] duplicate email records detected', { email: email, count: duplicatesByEmail[email] });
      }
    });
    App.users.forEach(function(user){
      var prevUser = prevUsersById[user.id];
      if(!prevUser) return;
      if(prevUser.role !== user.role || prevUser.roleWriteNonce !== user.roleWriteNonce){
        console.warn('[whitelist] role record changed', {
          id: user.id,
          email: user.email,
          previousRole: prevUser.role,
          currentRole: user.role,
          roleWriteAt: user.roleWriteAt,
          roleWriteByEmail: user.roleWriteByEmail,
          roleWriteByName: user.roleWriteByName,
          roleWriteSource: user.roleWriteSource,
          roleWriteNonce: user.roleWriteNonce
        });
      }
    });
    App.managerWhitelistEntries = App.users.slice();
    App.users.forEach(function(user){ App.whitelist[user.email]=user.name; });
    if(App.currentUserEmail){
      var me = currentUserRecord();
      if(!me){
        App.auth.signOut();
        return;
      }
      App.currentUser = me.name || me.email;
      App.currentUserRole = me.role;
      updateWho();
    }
    rebuildTeamMembers();
    renderWhitelistPanel();
    refreshTeamMemberUi();
    renderManagerTeamAccessView();
    if(typeof refreshAccessUi === 'function') refreshAccessUi();
  });
  App.teamRef.on('value', function(snap){
    var data = snap.val()||{};
    App.legacyTeamMembers = Object.entries(data).map(function(e){ return normalizeTeamMemberRecord(e[0], e[1]); })
      .filter(function(member){ return !!member.name; })
      .sort(function(a,b){ return a.name.localeCompare(b.name); });
    rebuildTeamMembers();
    refreshTeamMemberUi();
    if(typeof refreshManagerLegacyView === 'function') refreshManagerLegacyView();
    if(typeof updateManagerStats === 'function') updateManagerStats();
  });
  if(!managerMode){
    App.automationTeamsRef.on('value', function(snap){
      App.automationTeams = snap.val()||{};
      refreshSprintHierarchyUi();
    });
    App.automationSubteamsRef.on('value', function(snap){
      App.automationSubteams = snap.val()||{};
      refreshSprintHierarchyUi();
    });
  }
  App.mainTicketsRef.on('value', function(snap){
    App.mainTickets = snap.val()||{};
    rebuildTeamMembers();
    if(managerMode){
      if(typeof refreshManagerLegacyView === 'function') refreshManagerLegacyView();
      if(typeof updateManagerStats === 'function') updateManagerStats();
    }
    else {
      if(!isSprintView()) refreshActiveTickets();
      else updateProjectViewCounts();
      refreshTeamMemberUi();
      document.getElementById('sync-dot').className='sync-dot online';
      document.getElementById('sync-label').textContent='Synced live';
    }
  }, function(){ var label = document.getElementById('sync-label'); if(label) label.textContent='Connection error'; });
  App.sprintTicketsRef.on('value', function(snap){
    App.sprintTickets = snap.val()||{};
    rebuildTeamMembers();
    if(managerMode){
      if(typeof refreshManagerLegacyView === 'function') refreshManagerLegacyView();
      if(typeof updateManagerStats === 'function') updateManagerStats();
    }
    else {
      if(isSprintView()) refreshActiveTickets();
      else updateProjectViewCounts();
      refreshTeamMemberUi();
      document.getElementById('sync-dot').className='sync-dot online';
      document.getElementById('sync-label').textContent='Synced live';
    }
  }, function(){ var label = document.getElementById('sync-label'); if(label) label.textContent='Connection error'; });
  if(!managerMode){
    App.activityRef.limitToLast(100).on('value', function(snap){
      renderActivity(snap);
    });
  }
}

function refreshTeamMemberUi(){
  refreshAllPickers();
  renderTeamList();
  renderWorkload();
  renderContribPills();
  if(App.selectedTicketId && document.getElementById('detail-modal') && document.getElementById('detail-modal').style.display !== 'none'){
    var t = App.allTickets[App.selectedTicketId];
    if(t && typeof refreshDetailFields === 'function') refreshDetailFields(t);
    if(t && isSprintView() && typeof renderWorkstreamsAndTasks === 'function') renderWorkstreamsAndTasks(App.selectedTicketId);
  }
}

document.addEventListener('keydown', function(e){
  if(e.key!=='Escape') return;
  if(document.getElementById('detail-modal').style.display!=='none'){ closeDetailModal(); return; }
  if(document.getElementById('new-modal').style.display!=='none'){ closeNewModal(); return; }
  if(document.getElementById('team-modal').style.display!=='none'){ closeTeamModal(); return; }
  if(App.wlPopoverOpen){ closeWlPopover(); }
});
