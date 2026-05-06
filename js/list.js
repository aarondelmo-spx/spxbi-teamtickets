window.renderList = function(){
  var search=(document.getElementById('search-input')||{value:''}).value.toLowerCase();
  var list=document.getElementById('ticket-list');
  var tickets=Object.entries(App.allTickets)
    .filter(function(e){return App.currentFilter==='all'||e[1].status===App.currentFilter;})
    .filter(function(e){return App.currentPriorityFilter==='all'||(e[1].priority||'p1')===App.currentPriorityFilter;})
    .filter(function(e){
      if(App.currentContrib==='all') return true;
      var t=e[1];
      var contribs=t.contributors&&t.contributors.length?t.contributors:(t.assignee&&t.assignee!=='Unassigned'?[t.assignee]:[]);
      return contribs.indexOf(App.currentContrib)>-1;
    })
    .filter(function(e){return !search||e[1].title.toLowerCase().includes(search)||(e[1].assignee||'').toLowerCase().includes(search);})
    .sort(function(a,b){return pOrder(a[1].priority)-pOrder(b[1].priority)||(b[1].createdTs||0)-(a[1].createdTs||0);});
  if(!tickets.length){
    list.innerHTML='<div class="empty-state"><div style="font-size:28px;opacity:.3">◎</div><p>'+(Object.keys(App.allTickets).length===0?'No projects yet. Create your first one!':'No projects match this filter.')+'</p></div>';
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
    var tcls='ticket'+(diff!==null&&diff<0&&t.status!=='done'?' is-overdue':diff!==null&&diff<=3&&diff>=0&&t.status!=='done'?' is-soon':'');
    var subtaskBar=st.total>0?'<div class="subtask-bar"><div class="subtask-bar-fill" style="width:'+Math.round(st.done/st.total*100)+'%"></div></div>':'';
    var contribs=t.contributors&&t.contributors.length?t.contributors:[t.assignee||'Unassigned'];
    var stackHtml=avatarStackHtml(contribs,20);
    return '<div class="'+tcls+'" onclick="openDetailModal(\''+id+'\')"><div class="ticket-left"><div class="priority-bar '+t.priority+'"></div></div><div class="ticket-body"><div class="ticket-id">#'+id.slice(-6).toUpperCase()+'</div><div class="ticket-title">'+t.title+'</div><div class="ticket-meta">'+stackHtml+'<span>·</span><span>'+(t.created||'')+'</span>'+(cc?'<span>· 💬 '+cc+'</span>':'')+(st.total?'<span>· ☑ '+st.done+'/'+st.total+'</span>':'')+(lc?'<span>· 🔗 '+lc+'</span>':'')+(dlTag?'<span>'+dlTag+'</span>':'')+'</div>'+subtaskBar+'</div><div class="ticket-right"><span class="status-badge '+sc+'">'+t.status+'</span></div></div>';
  }).join('');
};

function updateStats(){
  var t=Object.values(App.allTickets);
  document.getElementById('s-total').textContent=t.length;
  document.getElementById('s-open').textContent=t.filter(function(x){return x.status==='open';}).length;
  document.getElementById('s-prog').textContent=t.filter(function(x){return x.status==='in progress'||x.status==='review';}).length;
  document.getElementById('s-done').textContent=t.filter(function(x){return x.status==='done';}).length;
  document.getElementById('ticket-count-sub').textContent=t.length+' project'+(t.length!==1?'s':'')+' total';
}

function updateCounts(){
  var t=Object.values(App.allTickets);
  document.getElementById('cnt-all').textContent=t.length;
  document.getElementById('cnt-open').textContent=t.filter(function(x){return x.status==='open';}).length;
  document.getElementById('cnt-done').textContent=t.filter(function(x){return x.status==='done';}).length;
  document.getElementById('cnt-p0').textContent=t.filter(function(x){return (x.priority||'p1')==='p0';}).length;
  document.getElementById('cnt-p1').textContent=t.filter(function(x){return (x.priority||'p1')==='p1';}).length;
  document.getElementById('cnt-p2').textContent=t.filter(function(x){return (x.priority||'p1')==='p2';}).length;
  document.getElementById('cnt-p3').textContent=t.filter(function(x){return (x.priority||'p1')==='p3';}).length;
}

window.setFilter = function(f){
  App.currentFilter=f;
  App.currentPriorityFilter='all';
  document.querySelectorAll('.nav-item').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.filter-pill').forEach(function(b){b.classList.remove('active');});
  var n=document.getElementById('nav-'+f),p=document.getElementById('pill-'+f);
  if(n)n.classList.add('active');if(p)p.classList.add('active');
  renderList();
};

window.setPriorityFilter = function(p){
  App.currentPriorityFilter=p;
  App.currentFilter='all';
  document.querySelectorAll('.nav-item').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.filter-pill').forEach(function(b){b.classList.remove('active');});
  var n=document.getElementById('nav-'+p),pill=document.getElementById('pill-'+p);
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
  el.innerHTML=App.teamMembers.map(function(m){
    var c=colorFor(m.name);
    var isActive=App.currentContrib===m.name;
    return '<button class="filter-pill cpill-member'+(isActive?' active':'')+'" data-name="'+m.name+'" style="display:flex;align-items:center;gap:5px">'
      +'<div style="width:12px;height:12px;border-radius:50%;background:'+c+';flex-shrink:0"></div>'
      +m.name+'</button>';
  }).join('');
  el.querySelectorAll('.cpill-member').forEach(function(btn){
    btn.addEventListener('click', function(){ setContribFilter(this.dataset.name); });
  });
}

window.openNewModal = function(){
  App.ntSelectedContribs=[];
  renderContribPicker('nt-contributor-picker',App.ntSelectedContribs,function(sel){App.ntSelectedContribs=sel;});
  document.getElementById('new-modal').style.display='flex';
  setTimeout(function(){document.getElementById('nt-title').focus();},100);
};

window.closeNewModal = function(){
  document.getElementById('new-modal').style.display='none';
  ['nt-title','nt-desc','nt-deadline'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  App.ntSelectedContribs=[];
};
