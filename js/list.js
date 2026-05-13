window.renderList = function(){
  var search=(document.getElementById('search-input')||{value:''}).value.toLowerCase();
  var list=document.getElementById('ticket-list');
  if(isSprintView() && typeof renderVibeWorkspace === 'function'){
    renderVibeWorkspace(search, list);
    return;
  }
  var tickets=Object.entries(App.allTickets)
    .filter(function(e){
      var status = effectiveStatusValue(e[1].status);
      if(App.currentFilter==='all') return true;
      if(App.currentFilter==='active') return status!=='done';
      return status===App.currentFilter;
    })
    .filter(function(e){return App.currentPriorityFilter==='all'||(e[1].priority||'p1')===App.currentPriorityFilter;})
    .filter(function(e){
      if(App.currentContrib==='all') return true;
      var t=e[1];
      var contribs=t.contributors&&t.contributors.length?t.contributors:(t.assignee&&t.assignee!=='Unassigned'?[t.assignee]:[]);
      if(contribs.indexOf(App.currentContrib)>-1) return true;
      return Object.values(t.subtasks || {}).some(function(subtask){
        return (subtask && subtask.contributors || []).indexOf(App.currentContrib)>-1;
      });
    })
    .filter(function(e){
      if(!search) return true;
      var t=e[1];
      return (t.title||'').toLowerCase().includes(search)
        || (t.desc||'').toLowerCase().includes(search)
        || (t.assignee||'').toLowerCase().includes(search)
        || (t.teamArea||'').toLowerCase().includes(search)
        || (t.subteam||'').toLowerCase().includes(search)
        || (t.sprintCycle||'').toLowerCase().includes(search)
        || (t.nextAction||'').toLowerCase().includes(search);
    })
    .sort(function(a,b){
      if(isSprintView()){
        var teamA = typeof normalizeTeamName === 'function' ? normalizeTeamName(a[1].teamArea) : (a[1].teamArea || '');
        var teamB = typeof normalizeTeamName === 'function' ? normalizeTeamName(b[1].teamArea) : (b[1].teamArea || '');
        var subteamA = typeof normalizeSubteamName === 'function' ? normalizeSubteamName(a[1].subteam) : (a[1].subteam || 'Other');
        var subteamB = typeof normalizeSubteamName === 'function' ? normalizeSubteamName(b[1].subteam) : (b[1].subteam || 'Other');
        return compareTeams(teamA, teamB)
          || subteamA.localeCompare(subteamB)
          || pOrder(a[1].priority)-pOrder(b[1].priority)
          || (b[1].createdTs||0)-(a[1].createdTs||0);
      }
      return pOrder(a[1].priority)-pOrder(b[1].priority)||(b[1].createdTs||0)-(a[1].createdTs||0);
    });
  if(!tickets.length){
    var emptyLabel=isSprintView()?'No Vibe Coding initiatives yet. Create the first one.':'No projects yet. Create your first one!';
    list.innerHTML='<div class="empty-state"><div style="font-size:28px;opacity:.3">◎</div><p>'+(Object.keys(App.allTickets).length===0?emptyLabel:'No projects match this filter.')+'</p></div>';
    return;
  }
  list.innerHTML=tickets.map(function(entry){
    var id=entry[0],t=entry[1];
    var cc=t.comments?Object.values(t.comments).reduce(function(a,c){return a+1+(c.replies?Object.keys(c.replies).length:0);},0):0;
    var st=subtaskStats(t.subtasks);
    var lc=t.links?Object.keys(t.links).length:0;
    var sc=statusClass(t.status);
    var dlTag=deadlineTagHtml(t.deadline,t.status);
    var diff=t.deadline?deadlineDiff(t.deadline):null;
    var normalizedStatus = effectiveStatusValue(t.status);
    var tcls='ticket'+(diff!==null&&diff<0&&normalizedStatus!=='done'&&normalizedStatus!=='archived'?' is-overdue':diff!==null&&diff<=3&&diff>=0&&normalizedStatus!=='done'&&normalizedStatus!=='archived'?' is-soon':'');
    var subtaskBar=st.total>0?'<div class="subtask-bar"><div class="subtask-bar-fill" style="width:'+Math.round(st.done/st.total*100)+'%"></div></div>':'';
    var contribs=t.contributors&&t.contributors.length?t.contributors:[t.assignee||'Unassigned'];
    var stackHtml=avatarStackHtml(contribs,20);
    var baseMeta=stackHtml+'<span>·</span><span>'+(t.created||'')+'</span>'+(cc?'<span>· 💬 '+cc+'</span>':'')+(st.total?'<span>· ☑ '+st.done+'/'+st.total+'</span>':'')+(lc?'<span>· 🔗 '+lc+'</span>':'')+(dlTag?'<span>'+dlTag+'</span>':'');
    var meta=isSprintView()?sprintMetaHtml(t):baseMeta;
    return '<div class="'+tcls+'" onclick="openDetailModal(\''+id+'\')"><div class="ticket-left"><div class="priority-bar '+(t.priority||'p1')+'"></div></div><div class="ticket-body"><div class="ticket-id">#'+id.slice(-6).toUpperCase()+'</div><div class="ticket-title">'+t.title+'</div><div class="ticket-meta">'+meta+'</div>'+subtaskBar+'</div><div class="ticket-right"><span class="status-badge '+sc+'">'+statusDisplayLabel(t.status)+'</span></div></div>';
  }).join('');
};

function updateStats(){
  var t=Object.values(App.allTickets);
  var extra=document.getElementById('s-extra-wrap');
  var reviewedCard=document.getElementById('s-open-wrap');
  if(isSprintView()){
    if(typeof updateVibeStats === 'function'){
      updateVibeStats(t, extra);
      return;
    }
    var totals=sprintTotals(t);
    document.getElementById('s-open').className='stat-num';
    document.getElementById('s-prog').className='stat-num';
    document.getElementById('s-done').className='stat-num';
    document.getElementById('s-total-label').textContent='Scoped HC';
    document.getElementById('s-open-label').textContent='Repurpose';
    document.getElementById('s-prog-label').textContent='Buffer';
    document.getElementById('s-done-label').textContent='BPO/NFTE Reduction';
    document.getElementById('s-extra-label').textContent='Unclassified';
    document.getElementById('s-total').textContent=fmtCapacity(totals.scoped);
    document.getElementById('s-open').textContent=fmtCapacity(totals.repurpose);
    document.getElementById('s-prog').textContent=fmtCapacity(totals.buffer);
    document.getElementById('s-done').textContent=fmtCapacity(totals.reduction);
    document.getElementById('s-extra').textContent=fmtCapacity(totals.unclassified);
    if(extra) extra.style.display='';
    document.getElementById('ticket-count-sub').textContent=t.length+' initiative'+(t.length!==1?'s':'')+' total';
    renderSprintDashboard();
    return;
  }
  document.getElementById('s-total-label').textContent='Total';
  document.getElementById('s-open-label').textContent='Open';
  document.getElementById('s-prog-label').textContent='In Progress';
  document.getElementById('s-done-label').textContent='Archived';
  document.getElementById('s-open').className='stat-num c-high';
  document.getElementById('s-prog').className='stat-num c-prog';
  document.getElementById('s-done').className='stat-num c-done';
  if(reviewedCard) reviewedCard.style.display='';
  if(extra) extra.style.display='none';
  document.getElementById('s-total').textContent=t.length;
  document.getElementById('s-open').textContent=t.filter(function(x){return effectiveStatusValue(x.status)==='open';}).length;
  document.getElementById('s-prog').textContent=t.filter(function(x){ var status = effectiveStatusValue(x.status); return status==='in progress'||status==='review'; }).length;
  document.getElementById('s-done').textContent=t.filter(function(x){return effectiveStatusValue(x.status)==='archived';}).length;
  document.getElementById('ticket-count-sub').textContent=t.length+' project'+(t.length!==1?'s':'')+' total';
}

function updateCounts(){
  var t=Object.values(App.allTickets);
  updateProjectViewCounts();
  document.getElementById('cnt-active').textContent=t.filter(function(x){ var status = effectiveStatusValue(x.status); return status!=='done'&&status!=='archived'; }).length;
  document.getElementById('cnt-all').textContent=t.length;
  document.getElementById('cnt-open').textContent=t.filter(function(x){return effectiveStatusValue(x.status)==='open';}).length;
  document.getElementById('cnt-archived').textContent=t.filter(function(x){return effectiveStatusValue(x.status)==='archived';}).length;
  document.getElementById('cnt-p0').textContent=t.filter(function(x){return (x.priority||'p1')==='p0';}).length;
  document.getElementById('cnt-p1').textContent=t.filter(function(x){return (x.priority||'p1')==='p1';}).length;
  document.getElementById('cnt-p2').textContent=t.filter(function(x){return (x.priority||'p1')==='p2';}).length;
  document.getElementById('cnt-p3').textContent=t.filter(function(x){return (x.priority||'p1')==='p3';}).length;
}

window.setFilter = function(f){
  if(isSprintView() && f === 'done' && App.currentFilter === 'done') f = 'all';
  App.currentFilter=f;
  App.currentPriorityFilter='all';
  document.querySelectorAll('.nav-item').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.filter-pill').forEach(function(b){b.classList.remove('active');});
  var n=document.getElementById('nav-'+f),p=document.getElementById('pill-'+f);
  if(n)n.classList.add('active');if(p)p.classList.add('active');
  renderList();
};

window.setPriorityFilter = function(p){
  var baseFilter = isSprintView() ? 'all' : 'active';
  var clearing = App.currentPriorityFilter === p && App.currentFilter === baseFilter;
  App.currentPriorityFilter=clearing?'all':p;
  App.currentFilter=baseFilter;
  document.querySelectorAll('.nav-item').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.filter-pill').forEach(function(b){b.classList.remove('active');});
  var n=document.getElementById(clearing?('nav-'+baseFilter):'nav-'+p),pill=document.getElementById(clearing?('pill-'+baseFilter):'pill-'+p);
  if(n)n.classList.add('active');if(pill)pill.classList.add('active');
  renderList();
};

window.setContribFilter = function(name){
  App.currentContrib=name;
  document.getElementById('cpill-all').classList.toggle('active',name==='all');
  document.querySelectorAll('.cpill-member').forEach(function(b){
    b.classList.toggle('active', b.dataset.name===name);
  });
  renderList();
};

function renderContribPills(){
  var el=document.getElementById('contrib-pills'); if(!el) return;
  var members = typeof mainProjectTeamMembers === 'function' ? mainProjectTeamMembers() : App.teamMembers;
  if(App.currentContrib !== 'all' && !members.some(function(m){ return m.name === App.currentContrib; })){
    App.currentContrib = 'all';
    if(!isSprintView()) renderList();
  }
  var allBtn = document.getElementById('cpill-all');
  if(allBtn) allBtn.classList.toggle('active', App.currentContrib === 'all');
  if(!members.length){
    el.innerHTML='<div style="font-size:12px;color:var(--text3)">No users with main projects yet.</div>';
    return;
  }
  el.innerHTML=members.map(function(m){
    var c=colorFor(m.name);
    var isActive=App.currentContrib===m.name;
    return '<button class="filter-pill cpill-member'+(isActive?' active':'')+'" data-name="'+safeText(m.name)+'" style="display:flex;align-items:center;gap:5px">'
      +'<div style="width:12px;height:12px;border-radius:50%;background:'+c+';flex-shrink:0"></div>'
      +safeText(m.name)+'</button>';
  }).join('');
  el.querySelectorAll('.cpill-member').forEach(function(btn){
    btn.addEventListener('click', function(){ setContribFilter(this.dataset.name); });
  });
}

window.openNewModal = function(){
  if(!requireContentEditAccess('create projects')) return;
  App.ntSelectedContribs=[];
  App.ntSelectedSupportTeams=[];
  updateAppShell();
  clearSprintNewFields();
  renderContribPicker('nt-contributor-picker',App.ntSelectedContribs,function(sel){App.ntSelectedContribs=sel;});
  document.getElementById('new-modal').style.display='flex';
  setTimeout(function(){document.getElementById('nt-title').focus();},100);
};

window.closeNewModal = function(){
  document.getElementById('new-modal').style.display='none';
  ['nt-title','nt-desc','nt-deadline'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  clearSprintNewFields();
  App.ntSelectedContribs=[];
  App.ntSelectedSupportTeams=[];
};
