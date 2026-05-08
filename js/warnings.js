function contribAvatarsHtml(contribs){
  if(!contribs||!contribs.length) return '';
  return '<span style="display:inline-flex;align-items:center;gap:3px;margin-left:4px">'
    +contribs.slice(0,3).map(function(n){
      var c=colorFor(n);
      return '<span title="'+n+'" style="width:16px;height:16px;border-radius:50%;background:'+c+'22;color:'+c+';display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:500">'+initials(n)+'</span>';
    }).join('')
    +(contribs.length>3?'<span style="font-size:10px;color:var(--text3)">+'+(contribs.length-3)+'</span>':'')
    +'</span>';
}

function updateWarnings(){
  var ticketItems=[],subtaskItems=[];
  Object.entries(App.allTickets).forEach(function(e){
    var id=e[0],t=e[1];
    var dueDate = t.deadline || (isSprintView() ? t.timelineEnd : null);
    if(!dueDate||t.status==='done') return;
    var diff=deadlineDiff(dueDate); if(diff===null) return;
    var contribs=t.contributors&&t.contributors.length?t.contributors:(t.assignee&&t.assignee!=='Unassigned'?[t.assignee]:[]);
    if(diff<0) ticketItems.push({id:id,title:t.title,diff:diff,type:'overdue',contribs:contribs});
    else if(diff<=3) ticketItems.push({id:id,title:t.title,diff:diff,type:'soon',contribs:contribs});
  });
  Object.entries(App.allTickets).forEach(function(e){
    var id=e[0],t=e[1]; if(!t.subtasks) return;
    Object.entries(t.subtasks).forEach(function(se){
      var s=se[1]; if(!s.deadline||s.done) return;
      var diff=deadlineDiff(s.deadline); if(diff===null) return;
      var contribs=s.contributors&&s.contributors.length?s.contributors:[];
      if(diff<0) subtaskItems.push({id:id,ticketTitle:t.title,subtaskTitle:s.text,diff:diff,type:'overdue',contribs:contribs});
      else if(diff<=3) subtaskItems.push({id:id,ticketTitle:t.title,subtaskTitle:s.text,diff:diff,type:'soon',contribs:contribs});
    });
  });
  ticketItems.sort(function(a,b){return a.diff-b.diff;});
  subtaskItems.sort(function(a,b){return a.diff-b.diff;});
  var banner=document.getElementById('warn-banner'),list=document.getElementById('warn-list');
  if(!ticketItems.length&&!subtaskItems.length){banner.classList.remove('visible');return;}
  banner.classList.add('visible');
  var html='';
  if(ticketItems.length){
    html+='<div style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">'+(isSprintView()?'Initiatives':'Projects')+'</div>';
    html+=ticketItems.map(function(it){
      var badge=it.type==='overdue'?'badge-overdue':'badge-soon';
      var label=it.type==='overdue'?'overdue '+Math.abs(it.diff)+'d':it.diff===0?'due today':'in '+it.diff+'d';
      return '<div class="warn-item" onclick="openDetailModal(&quot;'+it.id+'&quot;)"><span class="warn-badge '+badge+'">'+label+'</span>'+contribAvatarsHtml(it.contribs)+'<span style="flex:1">'+it.title+'</span></div>';
    }).join('');
  }
  if(subtaskItems.length){
    html+='<div style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;margin-top:'+(ticketItems.length?'10px':'2px')+'">'+(isSprintView()?'Tasks':'Subtasks')+'</div>';
    html+=subtaskItems.map(function(it){
      var badge=it.type==='overdue'?'badge-overdue':'badge-soon';
      var label=it.type==='overdue'?'overdue '+Math.abs(it.diff)+'d':it.diff===0?'due today':'in '+it.diff+'d';
      return '<div class="warn-item" onclick="openDetailModal(&quot;'+it.id+'&quot;)"><span class="warn-badge '+badge+'">'+label+'</span>'+contribAvatarsHtml(it.contribs)+'<span style="color:var(--text3)">'+it.ticketTitle+' &rsaquo;</span><span style="flex:1">'+it.subtaskTitle+'</span></div>';
    }).join('');
  }
  list.innerHTML=html;
}
