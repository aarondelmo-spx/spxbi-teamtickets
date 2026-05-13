window.closeWlPopover = function(){
  document.getElementById('wl-popover').classList.remove('open');
  App.wlPopoverOpen = false;
};

function ticketBucket(t){
  if(t.status==='done') return 'done';
  if(!t.deadline) return 'ontime';
  var diff=deadlineDiff(t.deadline);
  if(diff===null) return 'ontime';
  if(diff<0) return 'overdue';
  if(diff<=3) return 'soon';
  return 'ontime';
}

function subtaskBucket(sub){
  if(sub.done) return 'done';
  if(!sub.deadline) return 'ontime';
  var diff=deadlineDiff(sub.deadline);
  if(diff===null) return 'ontime';
  if(diff<0) return 'overdue';
  if(diff<=3) return 'soon';
  return 'ontime';
}

function dlLabel(deadline, done){
  if(done) return 'Done';
  if(!deadline) return 'No deadline';
  var diff=deadlineDiff(deadline);
  if(diff===null) return deadline;
  if(diff<0) return 'Overdue '+Math.abs(diff)+'d';
  if(diff===0) return 'Due today';
  return 'Due in '+diff+'d';
}

window.showWlPopover = function(memberName, bucket, btnEl){
  memberName = String(memberName).replace(/&quot;/g,'');
  var color = bucket==='overdue'?'var(--overdue)':bucket==='soon'?'var(--warn)':bucket==='done'?'var(--done)':'var(--accent)';
  var bucketLabel = bucket==='overdue'?'Overdue':bucket==='soon'?'Due soon':bucket==='done'?'Done':'On time';
  var items = [];
  Object.entries(App.allTickets).forEach(function(e){
    var tid=e[0],t=e[1];
    if(!t.subtasks) return;
    Object.entries(t.subtasks).forEach(function(se){
      var sub=se[1];
      if(!sub.contributors||sub.contributors.indexOf(memberName)===-1) return;
      if(subtaskBucket(sub)!==bucket) return;
      items.push({id:tid,title:t.title+' › '+sub.text,sub:dlLabel(sub.deadline,sub.done),isSubtask:true});
    });
  });
  if(!items.length) return;
  document.getElementById('wl-popover-title').textContent = memberName + ' · ' + bucketLabel;
  document.getElementById('wl-popover-body').innerHTML = items.map(function(item){
    return '<div class="wl-popover-item" onclick="closeWlPopover();openDetailModal(&quot;'+item.id+'&quot;)">'
      +'<div class="wl-item-dot" style="background:'+color+'"></div>'
      +'<div><div class="wl-item-title">'+item.title+'</div><div class="wl-item-sub">'+item.sub+(item.isSubtask?(isSprintView()?' · task':' · subtask'):'')+'</div></div>'
      +'</div>';
  }).join('');
  var pop = document.getElementById('wl-popover');
  pop.classList.add('open');
  var rect = btnEl.getBoundingClientRect();
  var popW = 260;
  var left = rect.left - popW - 8;
  if(left < 8) left = rect.right + 8;
  var top = rect.top;
  if(top + 200 > window.innerHeight) top = window.innerHeight - 210;
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
  App.wlPopoverOpen = true;
};

document.addEventListener('click', function(){ if(App.wlPopoverOpen) closeWlPopover(); });

function renderWorkload(){
  var el = document.getElementById('workload-list'); if(!el) return;
  var members = typeof mainProjectTeamMembers === 'function' ? mainProjectTeamMembers() : App.teamMembers;
  if(!members.length){ el.innerHTML='<div style="font-size:12px;color:var(--text3)">No users with main projects yet.</div>'; return; }
  var stats = {};
  members.forEach(function(m){ stats[m.name]={total:0,ontime:0,soon:0,overdue:0}; });
  Object.entries(App.allTickets).forEach(function(e){
    var t=e[1];
    if(!t.subtasks) return;
    Object.entries(t.subtasks).forEach(function(se){
      var sub=se[1];
      if(!sub.contributors) return;
      var sbucket=subtaskBucket(sub);
      if(sbucket==='done') return;
      sub.contributors.forEach(function(name){
        if(!stats[name]) return;
        stats[name].total++;
        stats[name][sbucket]++;
      });
    });
  });
  el.innerHTML = members.map(function(m){
    var s = stats[m.name];
    var c = colorFor(m.name);
    if(!s||s.total===0){
      return '<div class="workload-member">'
        +'<div class="workload-member-header">'
        +'<div style="width:20px;height:20px;border-radius:50%;background:'+c+'22;color:'+c+';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:500;flex-shrink:0">'+initials(m.name)+'</div>'
        +'<span class="workload-member-name">'+m.name+'</span>'
        +'<span class="workload-member-total" style="color:var(--text3)">no active tasks</span>'
        +'</div>'
        +'</div>';
    }
    var total=s.total;
    var okPct=Math.round(s.ontime/total*100);
    var soonPct=Math.round(s.soon/total*100);
    var overPct=Math.round(s.overdue/total*100);
    return '<div class="workload-member">'
      +'<div class="workload-member-header">'
      +'<div style="width:20px;height:20px;border-radius:50%;background:'+c+'22;color:'+c+';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:500;flex-shrink:0">'+initials(m.name)+'</div>'
      +'<span class="workload-member-name">'+m.name+'</span>'
      +'<span class="workload-member-total">'+total+' active task'+(total>1?'s':'')+'</span>'
      +'</div>'
      +'<div class="workload-bar-row">'
      +(s.overdue?'<div class="workload-seg" style="background:var(--overdue);width:'+overPct+'%;min-width:4px" title="'+s.overdue+' overdue"></div>':'')
      +(s.soon?'<div class="workload-seg" style="background:var(--warn);width:'+soonPct+'%;min-width:4px" title="'+s.soon+' due soon"></div>':'')
      +(s.ontime?'<div class="workload-seg" style="background:var(--accent);opacity:.5;width:'+okPct+'%;min-width:4px" title="'+s.ontime+' on time"></div>':'')
      +'</div>'
      +'<div class="workload-pills">'
      +(s.overdue?'<button class="workload-pill wp-over" onclick="event.stopPropagation();showWlPopover(&quot;'+m.name+'&quot;,&quot;overdue&quot;,this)">'+s.overdue+' overdue</button>':'')
      +(s.soon?'<button class="workload-pill wp-soon" onclick="event.stopPropagation();showWlPopover(&quot;'+m.name+'&quot;,&quot;soon&quot;,this)">'+s.soon+' due soon</button>':'')
      +(s.ontime?'<button class="workload-pill wp-ok" onclick="event.stopPropagation();showWlPopover(&quot;'+m.name+'&quot;,&quot;ontime&quot;,this)">'+s.ontime+' on time</button>':'')
      +'</div>'
      +'</div>';
  }).join('');
}
