function startApp(){
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
  App.ticketsRef.on('value', function(snap){
    App.allTickets = snap.val()||{};
    updateStats(); renderList(); updateCounts(); updateWarnings(); renderWorkload();
    document.getElementById('sync-dot').className='sync-dot online';
    document.getElementById('sync-label').textContent='Synced live';
    if(App.selectedTicketId && document.getElementById('detail-modal').style.display!=='none'){
      var t=App.allTickets[App.selectedTicketId];
      if(t){
        document.getElementById('d-status-sel').value=t.status;
        document.getElementById('d-priority-sel').value=t.priority||'p1';
        document.getElementById('d-deadline-inp').value=t.deadline||'';
        renderDeadlineStatus(t.deadline,t.status);
        renderSubtasks(App.selectedTicketId);
        renderLinks(App.selectedTicketId);
        renderComments(App.selectedTicketId);
      }
    }
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
