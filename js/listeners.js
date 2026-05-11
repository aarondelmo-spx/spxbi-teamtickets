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
  App.whitelistRef.on('value', function(snap){
    App.whitelist = {};
    var data = snap.val()||{};
    if(typeof syncLoginAccessMessaging === 'function') syncLoginAccessMessaging(data);
    App.users = Object.entries(data).map(function(entry){
      return normalizeWhitelistUserRecord(entry[0], entry[1]);
    }).filter(function(user){ return !!user.email; }).sort(function(a,b){
      return (a.name || a.email).localeCompare(b.name || b.email);
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
    promoteAllWhitelistUsersToAdmin();
    rebuildTeamMembers();
    renderWhitelistPanel();
    refreshTeamMemberUi();
    renderManagerTeamAccessView();
  });
  App.teamRef.on('value', function(snap){
    var data = snap.val()||{};
    App.legacyTeamMembers = Object.entries(data).map(function(e){ return normalizeTeamMemberRecord(e[0], e[1]); })
      .filter(function(member){ return !!member.name; })
      .sort(function(a,b){ return a.name.localeCompare(b.name); });
    rebuildTeamMembers();
    refreshTeamMemberUi();
    renderManagerTeamAccessView();
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
    if(managerMode) renderManagerTeamAccessView();
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
    if(managerMode) renderManagerTeamAccessView();
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
