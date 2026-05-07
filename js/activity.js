function logActivity(type, ticketTitle, detail, ticketId, from, to){
  App.activityRef.push({
    type: type,
    who: App.currentUser||'Someone',
    ticketTitle: ticketTitle||'',
    detail: detail||'',
    ticketId: ticketId||App.selectedTicketId||'',
    projectView: App.currentProjectView || 'main',
    from: from||'',
    to: to||'',
    ts: Date.now()
  });
  var thirtyDaysAgo = Date.now() - (30*24*60*60*1000);
  App.activityRef.once('value', function(snap){
    var entries = snap.val();
    if(!entries) return;
    var keys = Object.keys(entries).sort();
    keys.forEach(function(k){
      if(entries[k].ts < thirtyDaysAgo) App.activityRef.child(k).remove();
    });
    if(keys.length > 100){
      keys.slice(0, keys.length-100).forEach(function(k){ App.activityRef.child(k).remove(); });
    }
  });
}

function timeAgo(ts){
  var diff = Math.round((Date.now()-ts)/1000);
  if(diff<60) return diff+'s ago';
  if(diff<3600) return Math.round(diff/60)+'m ago';
  if(diff<86400) return Math.round(diff/3600)+'h ago';
  return Math.round(diff/86400)+'d ago';
}

function renderActivity(snap){
  App.activityData = snap.val()||{};
  renderActivityList();
}

function renderActivityList(){
  var data = App.activityData||{};
  var items = Object.values(data)
    .filter(function(item){ return (item.projectView||'main') === App.currentProjectView; })
    .sort(function(a,b){return b.ts-a.ts;});
  var el = document.getElementById('activity-list'); if(!el) return;
  if(!items.length){ el.innerHTML='<div style="font-size:12px;color:var(--text3)">No activity yet.</div>'; return; }
  var typeMap = {
    comment:{label:'commented',cls:'ab-comment'},
    replied:{label:'replied',cls:'ab-comment'},
    done:{label:isSprintView()?'completed task':'completed subtask',cls:'ab-done'},
    created:{label:isSprintView()?'created initiative':'created project',cls:'ab-created'},
    deleted:{label:isSprintView()?'deleted initiative':'deleted project',cls:'ab-status'},
    status:{label:'updated status',cls:'ab-status'},
    subtask:{label:isSprintView()?'added task':'added subtask',cls:'ab-subtask'},
    deletedsubtask:{label:isSprintView()?'removed task':'removed subtask',cls:'ab-status'},
    addedlink:{label:'added link',cls:'ab-subtask'},
    deletedlink:{label:'removed link',cls:'ab-status'},
    setdeadline:{label:'set deadline',cls:'ab-status'},
    cleareddeadline:{label:'cleared deadline',cls:'ab-status'},
    updatedcontribs:{label:'updated contributors',cls:'ab-subtask'},
    priority:{label:'changed priority',cls:'ab-status'},
    editedsubtask:{label:isSprintView()?'edited task':'edited subtask',cls:'ab-subtask'},
    editedtitle:{label:'edited title',cls:'ab-status'},
    editeddesc:{label:'edited description',cls:'ab-status'}
  };
  el.innerHTML = '';
  items.forEach(function(item){
    var c = colorFor(item.who);
    var t = typeMap[item.type]||{label:item.type,cls:'ab-status'};
    var div = document.createElement('div');
    div.className = 'activity-item';
    if(item.ticketId) div.style.cursor='pointer';
    div.innerHTML = '<div class="activity-av" style="background:'+c+'22;color:'+c+'">'+initials(item.who)+'</div>'
      +'<div class="activity-body">'
      +'<div class="activity-text"><span class="activity-who">'+item.who+'</span>'
      +' <span class="activity-badge '+t.cls+'">'+t.label+'</span>'
      +' <span class="activity-ticket">'+item.ticketTitle+'</span>'
      +(item.from&&item.to?'<span style="color:var(--text3);font-size:11px"> '+item.from+' &rarr; '+item.to+'</span>':(item.detail?'<span style="color:var(--text3)"> &rsaquo; '+item.detail+'</span>':''))
      +'</div>'
      +'<div class="activity-time">'+timeAgo(item.ts)+'</div>'
      +'</div>';
    if(item.ticketId){
      (function(tid){
        div.addEventListener('click', function(){ openDetailModal(tid); });
        div.addEventListener('mouseover', function(){ div.style.background='var(--surface2)'; });
        div.addEventListener('mouseout', function(){ div.style.background=''; });
      })(item.ticketId);
    }
    el.appendChild(div);
  });
  setTimeout(function(){
    var warnEl = document.getElementById('warn-banner');
    var workloadEl = document.getElementById('workload-panel');
    var activityPanel = document.getElementById('activity-panel');
    var activityList = document.getElementById('activity-list');
    if(!warnEl||!workloadEl||!activityPanel||!activityList) return;
    var panelPadding = 60;
    var maxH = Math.max(warnEl.offsetHeight, workloadEl.offsetHeight);
    if(maxH > 0){
      activityPanel.style.maxHeight = maxH + 'px';
      activityPanel.style.overflow = 'hidden';
      activityList.style.maxHeight = (maxH - panelPadding) + 'px';
      activityList.style.overflowY = 'auto';
    }
  }, 100);
}
