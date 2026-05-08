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
  if(window.location.search.indexOf('view=manager') !== -1){
    showManagerView();
    return;
  }
  var _params = new URLSearchParams(window.location.search);
  if(_params.get('view') === 'sprint') {
    App.currentProjectView = 'sprint';
    App.currentVibeView = _params.get('tab') === 'sprint' ? 'sprint' : 'initiatives';
  }
  App.whitelistRef.on('value', function(snap){
    App.whitelist = {};
    var data = snap.val()||{};
    Object.values(data).forEach(function(e){ if(e.email) App.whitelist[e.email.toLowerCase()]=e.name; });
    renderWhitelistPanel();
  });
  App.teamRef.on('value', function(snap){
    var data = snap.val()||{};
    App.teamMembers = Object.entries(data).map(function(e){ return {id:e[0],name:e[1].name}; })
      .sort(function(a,b){ return a.name.localeCompare(b.name); });
    refreshAllPickers();
    renderTeamList();
    renderWorkload();
    renderContribPills();
  });
  App.automationTeamsRef.on('value', function(snap){
    App.automationTeams = snap.val()||{};
    refreshSprintHierarchyUi();
  });
  App.automationSubteamsRef.on('value', function(snap){
    App.automationSubteams = snap.val()||{};
    refreshSprintHierarchyUi();
  });
  App.mainTicketsRef.on('value', function(snap){
    App.mainTickets = snap.val()||{};
    if(!isSprintView()) refreshActiveTickets();
    else updateProjectViewCounts();
    document.getElementById('sync-dot').className='sync-dot online';
    document.getElementById('sync-label').textContent='Synced live';
  }, function(){ document.getElementById('sync-label').textContent='Connection error'; });
  App.sprintTicketsRef.on('value', function(snap){
    App.sprintTickets = snap.val()||{};
    if(isSprintView()) refreshActiveTickets();
    else updateProjectViewCounts();
    document.getElementById('sync-dot').className='sync-dot online';
    document.getElementById('sync-label').textContent='Synced live';
  }, function(){ document.getElementById('sync-label').textContent='Connection error'; });
  App.activityRef.limitToLast(100).on('value', function(snap){
    renderActivity(snap);
  });
}

document.addEventListener('keydown', function(e){
  if(e.key!=='Escape') return;
  if(document.getElementById('detail-modal').style.display!=='none'){ closeDetailModal(); return; }
  if(document.getElementById('new-modal').style.display!=='none'){ closeNewModal(); return; }
  if(document.getElementById('team-modal').style.display!=='none'){ closeTeamModal(); return; }
  if(App.wlPopoverOpen){ closeWlPopover(); }
});
