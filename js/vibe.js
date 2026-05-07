var VIBE_GENERAL_WORKSTREAM_ID = '_general';

function jsArg(value){
  return String(value == null ? '' : value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function domId(value){
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function taskOwner(task){
  return task.contributors && task.contributors.length ? task.contributors[0] : '';
}

function taskSprintLabel(task){
  return (task.sprintLabel || '').trim();
}

function taskDueRank(task){
  if(task.done) return 99999;
  if(!task.deadline) return 90000 + (task.ts || 0) / 10000000000000;
  var diff = deadlineDiff(task.deadline);
  return diff === null ? 90000 : diff;
}

function workstreamEntries(t){
  var entries = [{id:VIBE_GENERAL_WORKSTREAM_ID, name:'General', virtual:true, sortOrder:-1}];
  Object.entries(t.workstreams || {}).forEach(function(entry){
    entries.push(Object.assign({id:entry[0], virtual:false}, entry[1]));
  });
  return entries.sort(function(a,b){
    return numVal(a.sortOrder) - numVal(b.sortOrder) || (a.name || '').localeCompare(b.name || '');
  });
}

function workstreamById(t, workstreamId){
  return workstreamEntries(t).find(function(ws){ return ws.id === workstreamId; }) || workstreamEntries(t)[0];
}

function taskEntries(ticketId, t){
  return Object.entries(t.subtasks || {}).map(function(entry){
    var task = entry[1] || {};
    var ws = workstreamById(t, task.workstreamId || VIBE_GENERAL_WORKSTREAM_ID);
    return {
      ticketId: ticketId,
      taskId: entry[0],
      initiative: t,
      task: task,
      workstreamId: ws.id,
      workstreamName: ws.name || 'General'
    };
  });
}

function collectVibeTasks(){
  var items = [];
  Object.entries(App.allTickets || {}).forEach(function(entry){
    items = items.concat(taskEntries(entry[0], entry[1]));
  });
  return items;
}

function sprintLabelsFromTasks(){
  var labels = {};
  collectVibeTasks().forEach(function(item){
    var label = taskSprintLabel(item.task);
    if(label) labels[label] = true;
  });
  if(App.activeSprintLabel) labels[App.activeSprintLabel] = true;
  return Object.keys(labels).sort();
}

function syncSprintControls(){
  var input = document.getElementById('vibe-sprint-label');
  var datalist = document.getElementById('vibe-sprint-labels');
  if(!input || !datalist) return;
  var labels = sprintLabelsFromTasks();
  if(!App.activeSprintLabel && labels.length){
    App.activeSprintLabel = labels[0];
    localStorage.setItem('spxbi_active_sprint_label', App.activeSprintLabel);
  }
  input.value = App.activeSprintLabel || '';
  datalist.innerHTML = labels.map(function(label){
    return '<option value="'+safeText(label)+'"></option>';
  }).join('');
}

function setDisplay(el, display){
  if(el) el.style.display = display;
}

function updateVibeShell(){
  var vibe = isSprintView();
  var filterOpen = !vibe || App.vibeFiltersOpen;
  setDisplay(document.getElementById('vibe-view-bar'), vibe ? 'flex' : 'none');
  setDisplay(document.getElementById('vibe-sprint-controls'), vibe && App.currentVibeView === 'sprint' ? 'flex' : 'none');

  ['initiatives','sprint','tasks'].forEach(function(view){
    var tab = document.getElementById('vibe-tab-'+view);
    if(tab) tab.classList.toggle('active', App.currentVibeView === view);
  });

  ['priority-filter-label','nav-p0','nav-p1','nav-p2','nav-p3'].forEach(function(id){
    setDisplay(document.getElementById(id), vibe ? 'none' : '');
  });
  ['nav-all','nav-open'].forEach(function(id){
    setDisplay(document.getElementById(id), vibe && !filterOpen ? 'none' : '');
  });
  document.querySelectorAll('.vibe-advanced-filter').forEach(function(el){
    el.style.display = vibe && !filterOpen ? 'none' : '';
  });
  setDisplay(document.getElementById('contrib-filter-row'), vibe ? (filterOpen ? 'flex' : 'none') : 'flex');
  document.querySelectorAll('.shell-tool').forEach(function(el){
    el.style.display = vibe ? (filterOpen ? 'flex' : 'none') : '';
  });

  var filterBtn = document.getElementById('vibe-filter-toggle');
  if(filterBtn) filterBtn.textContent = App.vibeFiltersOpen ? 'Hide filters & tools' : 'Filters & tools';

  var dashboard = document.getElementById('dashboard-row');
  var workload = document.getElementById('workload-panel');
  var activity = document.getElementById('activity-panel');
  var warnTitle = document.getElementById('warn-banner-title');
  if(dashboard) dashboard.style.gridTemplateColumns = vibe ? '1fr' : '1fr 1fr 300px';
  setDisplay(workload, vibe ? 'none' : '');
  setDisplay(activity, vibe ? 'none' : '');
  if(warnTitle) warnTitle.textContent = vibe ? 'Needs attention' : '\u26A0 Deadline alerts';
  syncSprintControls();
}

window.toggleVibeFilters = function(){
  App.vibeFiltersOpen = !App.vibeFiltersOpen;
  updateVibeShell();
};

window.setVibeView = function(view){
  if(view !== 'initiatives' && view !== 'sprint' && view !== 'tasks') return;
  App.currentVibeView = view;
  updateVibeShell();
  updateStats();
  renderList();
};

window.setActiveSprintLabelFromInput = function(){
  var input = document.getElementById('vibe-sprint-label');
  App.activeSprintLabel = input ? input.value.trim() : '';
  if(App.activeSprintLabel) localStorage.setItem('spxbi_active_sprint_label', App.activeSprintLabel);
  else localStorage.removeItem('spxbi_active_sprint_label');
  syncSprintControls();
  updateStats();
  renderList();
};

function updateVibeStats(initiatives, extra){
  var totals = automationTotals(initiatives);
  var teamSize = automationTeamSizeTotal(initiatives);
  document.getElementById('s-total-label').textContent='Team size';
  document.getElementById('s-open-label').textContent='Scoped for automation';
  document.getElementById('s-prog-label').textContent='In progress automation';
  document.getElementById('s-done-label').textContent='HC savings';
  document.getElementById('s-open').className='stat-num c-high';
  document.getElementById('s-prog').className='stat-num c-prog';
  document.getElementById('s-done').className='stat-num c-done';
  document.getElementById('s-total').textContent=fmtCapacity(teamSize);
  document.getElementById('s-open').textContent=fmtCapacity(totals.scoped);
  document.getElementById('s-prog').textContent=fmtCapacity(totals.progress);
  document.getElementById('s-done').textContent=fmtCapacity(totals.actual)+' / '+fmtCapacity(totals.excess);
  if(extra) extra.style.display='none';
  var viewLabel = App.currentVibeView === 'sprint'
    ? (App.activeSprintLabel ? 'Sprint: '+App.activeSprintLabel : 'Sprint view')
    : App.currentVibeView === 'tasks' ? 'Task queue' : 'Initiative planning';
  document.getElementById('ticket-count-sub').textContent=initiatives.length+' initiative'+(initiatives.length!==1?'s':'')+' total - '+viewLabel;
  syncSprintControls();
}

function initiativeMatchesFilter(entry){
  var t = entry[1];
  if(App.currentFilter === 'all') return true;
  if(App.currentFilter === 'active') return t.status !== 'done';
  return t.status === App.currentFilter;
}

function initiativeMatchesSearch(t, search){
  if(!search) return true;
  if((t.title||'').toLowerCase().includes(search)) return true;
  if((t.desc||'').toLowerCase().includes(search)) return true;
  if((t.teamArea||'').toLowerCase().includes(search)) return true;
  if((t.subteam||'').toLowerCase().includes(search)) return true;
  return taskEntries('', t).some(function(item){
    return (item.task.text||'').toLowerCase().includes(search)
      || (item.workstreamName||'').toLowerCase().includes(search)
      || taskSprintLabel(item.task).toLowerCase().includes(search);
  });
}

function initiativeTaskStats(t){
  var tasks = Object.values(t.subtasks || {});
  return {
    total: tasks.length,
    done: tasks.filter(function(task){ return task.done; }).length
  };
}

function nearestDueTask(t){
  return Object.values(t.subtasks || {})
    .filter(function(task){ return !task.done && task.deadline; })
    .sort(function(a,b){ return taskDueRank(a) - taskDueRank(b); })[0] || null;
}

function nextOpenTask(t){
  return Object.values(t.subtasks || {})
    .filter(function(task){ return !task.done; })
    .sort(function(a,b){ return taskDueRank(a) - taskDueRank(b) || (a.ts || 0) - (b.ts || 0); })[0] || null;
}

function initiativeCardHtml(id, t){
  var stats = initiativeTaskStats(t);
  var pct = stats.total ? Math.round(stats.done / stats.total * 100) : 0;
  var due = nearestDueTask(t);
  var dueText = due ? deadlineTagHtml(due.deadline, due.done ? 'done' : 'open') + ' ' + safeText(due.text || 'Task') : '<span>No due tasks</span>';
  var workstreamCount = workstreamEntries(t).length;
  var tasks = taskEntries(id, t);
  var sprinted = tasks.filter(function(item){ return taskSprintLabel(item.task); }).length;
  var hcText = fmtCapacity(actualHcSavings(t))+' / '+fmtCapacity(excessCapacityHc(t))+' HC';
  return '<div class="initiative-card" onclick="openDetailModal(\''+jsArg(id)+'\')">'
    +'<div>'
    +'<div class="initiative-title-row"><span class="initiative-title">'+safeText(t.title || 'Untitled initiative')+'</span><span class="status-badge '+statusClass(t.status)+'">'+safeText(t.status || 'open')+'</span></div>'
    +'<div class="initiative-meta">'
    +'<span>'+workstreamCount+' workstream'+(workstreamCount!==1?'s':'')+'</span>'
    +'<span>'+stats.done+'/'+stats.total+' tasks</span>'
    +(sprinted?'<span>'+sprinted+' in sprint</span>':'')
    +'<span>'+hcText+'</span>'
    +'<span>'+dueText+'</span>'
    +'</div>'
    +(stats.total ? '<div class="subtask-bar"><div class="subtask-bar-fill" style="width:'+pct+'%"></div></div>' : '')
    +'</div>'
    +'<div class="initiative-side">'
    +'<button class="btn btn-sm btn-primary" onclick="event.stopPropagation();quickAddTask(\''+jsArg(id)+'\')" type="button">+ Task</button>'
    +'</div>'
    +'</div>';
}

function hcSummaryHtml(items, teamName, showTeamSize){
  var initiatives = items.map(function(entry){ return entry[1] || entry.t || entry; });
  var totals = automationTotals(initiatives);
  var size = teamName ? teamSizeHc(teamName) : automationTeamSizeTotal(initiatives);
  return '<div class="team-hc-strip">'
    +(showTeamSize ? '<span>Team size '+fmtCapacity(size)+'</span>' : '')
    +'<span>Scoped '+fmtCapacity(totals.scoped)+'</span>'
    +'<span>In progress '+fmtCapacity(totals.progress)+'</span>'
    +'<span>Savings '+fmtCapacity(totals.actual)+' / '+fmtCapacity(totals.excess)+'</span>'
    +'</div>';
}

function renderVibeInitiatives(search, list){
  var entries = Object.entries(App.allTickets || {})
    .filter(initiativeMatchesFilter)
    .filter(function(entry){ return App.currentPriorityFilter === 'all' || (entry[1].priority || 'p1') === App.currentPriorityFilter; })
    .filter(function(entry){ return initiativeMatchesSearch(entry[1], search); })
    .sort(function(a,b){
      return compareTeams(a[1].teamArea || 'Unassigned', b[1].teamArea || 'Unassigned')
        || (a[1].subteam || 'Unassigned subteam').localeCompare(b[1].subteam || 'Unassigned subteam')
        || (b[1].createdTs || 0) - (a[1].createdTs || 0);
    });
  if(!entries.length){
    list.innerHTML = '<div class="empty-state"><div style="font-size:28px;opacity:.3">&#9675;</div><p>No Vibe Coding initiatives match this view.</p></div>';
    return;
  }
  var grouped = {};
  entries.forEach(function(entry){
    var t = entry[1];
    var team = t.teamArea || 'Unassigned';
    var subteam = t.subteam || 'Unassigned subteam';
    if(!grouped[team]) grouped[team] = {};
    if(!grouped[team][subteam]) grouped[team][subteam] = [];
    grouped[team][subteam].push(entry);
  });
  var html = '';
  Object.keys(grouped).sort(compareTeams).forEach(function(team){
    var teamEntries = [];
    Object.keys(grouped[team]).forEach(function(subteam){ teamEntries = teamEntries.concat(grouped[team][subteam]); });
    html += '<div class="team-group"><div class="team-heading-row"><div class="team-heading">'+safeText(team)+'</div>'+hcSummaryHtml(teamEntries, team, true)+'</div>';
    Object.keys(grouped[team]).sort().forEach(function(subteam){
      html += '<div class="subteam-group"><div class="subteam-heading-row"><div class="subteam-heading">'+safeText(subteam)+'</div>'+hcSummaryHtml(grouped[team][subteam], null, false)+'</div><div class="initiative-card-grid">'
        +grouped[team][subteam].map(function(entry){ return initiativeCardHtml(entry[0], entry[1]); }).join('')
        +'</div></div>';
    });
    html += '</div>';
  });
  list.innerHTML = html;
}

function taskMatchesCurrentView(item, search){
  var task = item.task;
  if(App.currentFilter === 'active' && task.done) return false;
  if(App.currentFilter === 'open' && task.done) return false;
  if(App.currentFilter === 'done' && !task.done) return false;
  if(App.currentContrib !== 'all'){
    var contribs = task.contributors || [];
    if(contribs.indexOf(App.currentContrib) === -1) return false;
  }
  if(App.currentPriorityFilter !== 'all' && (item.initiative.priority || 'p1') !== App.currentPriorityFilter) return false;
  if(!search) return true;
  return (task.text || '').toLowerCase().includes(search)
    || (item.initiative.title || '').toLowerCase().includes(search)
    || (item.workstreamName || '').toLowerCase().includes(search)
    || taskSprintLabel(task).toLowerCase().includes(search)
    || (taskOwner(task) || '').toLowerCase().includes(search);
}

function taskOwnerSelectHtml(item){
  var selected = taskOwner(item.task);
  var options = '<option value="">Unassigned</option>' + App.teamMembers.map(function(member){
    return '<option value="'+safeText(member.name)+'"'+(selected===member.name?' selected':'')+'>'+safeText(member.name)+'</option>';
  }).join('');
  return '<select class="task-inline-select" onchange="updateVibeTaskField(\''+jsArg(item.ticketId)+'\',\''+jsArg(item.taskId)+'\',\'owner\',this.value)">'+options+'</select>';
}

function taskRowHtml(item, mode){
  var task = item.task;
  var checked = !!task.done;
  var action = mode === 'sprint'
    ? '<button class="btn btn-sm" onclick="removeTaskFromSprint(\''+jsArg(item.ticketId)+'\',\''+jsArg(item.taskId)+'\')" type="button">Remove</button>'
    : '<button class="btn btn-sm" onclick="openDetailModal(\''+jsArg(item.ticketId)+'\')" type="button">Open</button>';
  return '<div class="vibe-task-row'+(checked?' done-task':'')+'">'
    +'<div class="subtask-check'+(checked?' checked':'')+'" onclick="toggleVibeTaskFromList(\''+jsArg(item.ticketId)+'\',\''+jsArg(item.taskId)+'\','+checked+')"></div>'
    +'<div><div class="task-text">'+safeText(task.text || 'Untitled task')+'</div><div class="task-parent">'+safeText(item.initiative.title || 'Untitled initiative')+' / '+safeText(item.workstreamName)+'</div></div>'
    +taskOwnerSelectHtml(item)
    +'<input class="task-inline-input" type="date" value="'+safeText(task.deadline || '')+'" onchange="updateVibeTaskField(\''+jsArg(item.ticketId)+'\',\''+jsArg(item.taskId)+'\',\'deadline\',this.value)" />'
    +'<input class="task-inline-input" value="'+safeText(taskSprintLabel(task))+'" placeholder="Sprint label" onchange="updateVibeTaskField(\''+jsArg(item.ticketId)+'\',\''+jsArg(item.taskId)+'\',\'sprintLabel\',this.value)" />'
    +'<div style="display:flex;gap:5px;justify-content:flex-end">'+action+'</div>'
    +'</div>';
}

function renderGroupedTasks(items, list, emptyText, mode){
  if(!items.length){
    list.innerHTML = '<div class="vibe-empty">'+safeText(emptyText)+'</div>';
    return;
  }
  var grouped = {};
  items.forEach(function(item){
    if(!grouped[item.ticketId]) grouped[item.ticketId] = {title:item.initiative.title || 'Untitled initiative', workstreams:{}};
    if(!grouped[item.ticketId].workstreams[item.workstreamName]) grouped[item.ticketId].workstreams[item.workstreamName] = [];
    grouped[item.ticketId].workstreams[item.workstreamName].push(item);
  });
  var html = '';
  Object.keys(grouped).sort(function(a,b){ return grouped[a].title.localeCompare(grouped[b].title); }).forEach(function(key){
    html += '<div class="vibe-task-group"><div class="vibe-section-title">'+safeText(grouped[key].title)+'</div>';
    Object.keys(grouped[key].workstreams).sort().forEach(function(workstream){
      html += '<div class="subteam-heading">'+safeText(workstream)+'</div>'
        +grouped[key].workstreams[workstream].map(function(item){ return taskRowHtml(item, mode); }).join('');
    });
    html += '</div>';
  });
  list.innerHTML = html;
}

function renderVibeSprint(search, list){
  syncSprintControls();
  if(!App.activeSprintLabel){
    list.innerHTML = '<div class="vibe-empty">Set a sprint label, then tag tasks into it from an initiative or the Tasks view.</div>';
    return;
  }
  var items = collectVibeTasks()
    .filter(function(item){ return taskSprintLabel(item.task) === App.activeSprintLabel; })
    .filter(function(item){ return taskMatchesCurrentView(item, search); })
    .sort(function(a,b){ return taskDueRank(a.task) - taskDueRank(b.task) || (a.task.ts || 0) - (b.task.ts || 0); });
  renderGroupedTasks(items, list, 'No tasks are assigned to this sprint yet.', 'sprint');
}

function renderVibeTasks(search, list){
  var items = collectVibeTasks()
    .filter(function(item){ return taskMatchesCurrentView(item, search); })
    .sort(function(a,b){ return taskDueRank(a.task) - taskDueRank(b.task) || (a.task.ts || 0) - (b.task.ts || 0); });
  renderGroupedTasks(items, list, 'No tasks match this view.', 'tasks');
}

function renderVibeWorkspace(search, list){
  updateVibeShell();
  if(App.currentVibeView === 'sprint'){
    renderVibeSprint(search, list);
    return;
  }
  if(App.currentVibeView === 'tasks'){
    renderVibeTasks(search, list);
    return;
  }
  renderVibeInitiatives(search, list);
}

function addTaskOwnerOptions(selected){
  return '<option value="">Owner</option>' + App.teamMembers.map(function(member){
    return '<option value="'+safeText(member.name)+'"'+(selected===member.name?' selected':'')+'>'+safeText(member.name)+'</option>';
  }).join('');
}

function workstreamTaskRowHtml(ticketId, taskId, task, workstreamName){
  var checked = !!task.done;
  var item = {ticketId:ticketId, taskId:taskId, task:task, initiative:App.allTickets[ticketId] || {}, workstreamName:workstreamName};
  return '<div class="task-row'+(checked?' done-task':'')+'">'
    +'<div class="subtask-check'+(checked?' checked':'')+'" onclick="toggleVibeTaskFromList(\''+jsArg(ticketId)+'\',\''+jsArg(taskId)+'\','+checked+')"></div>'
    +'<div class="task-text">'+safeText(task.text || 'Untitled task')+'</div>'
    +taskOwnerSelectHtml(item)
    +'<input class="task-inline-input" type="date" value="'+safeText(task.deadline || '')+'" onchange="updateVibeTaskField(\''+jsArg(ticketId)+'\',\''+jsArg(taskId)+'\',\'deadline\',this.value)" />'
    +'<input class="task-inline-input" value="'+safeText(taskSprintLabel(task))+'" placeholder="Sprint label" onchange="updateVibeTaskField(\''+jsArg(ticketId)+'\',\''+jsArg(taskId)+'\',\'sprintLabel\',this.value)" />'
    +'<button class="btn-icon" onclick="deleteSubtask(\''+jsArg(taskId)+'\')" title="Remove task" type="button">x</button>'
    +'</div>';
}

function renderWorkstreamsAndTasks(ticketId){
  var t = App.allTickets[ticketId]; if(!t) return;
  var section = document.getElementById('vibe-workstream-section');
  var list = document.getElementById('vibe-workstream-list');
  if(section) section.style.display = 'block';
  if(!list) return;
  var tasks = taskEntries(ticketId, t);
  var html = workstreamEntries(t).map(function(ws){
    var wsTasks = tasks.filter(function(item){ return item.workstreamId === ws.id; })
      .sort(function(a,b){ return taskDueRank(a.task) - taskDueRank(b.task) || (a.task.ts || 0) - (b.task.ts || 0); });
    var id = domId(ws.id);
    return '<div class="workstream-card">'
      +'<div class="workstream-head"><div><div class="workstream-title">'+safeText(ws.name || 'General')+'</div><div class="microcopy">'+(ws.virtual?'Default bucket for legacy or uncategorized tasks.':'Epic inside this initiative.')+'</div></div><div class="workstream-count">'+wsTasks.filter(function(item){return !item.task.done;}).length+' active</div></div>'
      +'<div class="task-list">'+(wsTasks.length ? wsTasks.map(function(item){ return workstreamTaskRowHtml(ticketId, item.taskId, item.task, ws.name || 'General'); }).join('') : '<div class="empty-inline">No tasks yet.</div>')+'</div>'
      +'<div class="task-add-row">'
      +'<input id="task-text-'+id+'" placeholder="Add task..." onkeydown="if(event.key===\'Enter\')addVibeTask(\''+jsArg(ws.id)+'\')" />'
      +'<select id="task-owner-'+id+'">'+addTaskOwnerOptions('')+'</select>'
      +'<input id="task-due-'+id+'" type="date" />'
      +'<input id="task-sprint-'+id+'" placeholder="Sprint label" value="'+safeText(App.activeSprintLabel || '')+'" />'
      +'<button class="btn btn-sm btn-primary" onclick="addVibeTask(\''+jsArg(ws.id)+'\')" type="button">Add</button>'
      +'</div>'
      +'</div>';
  }).join('');
  list.innerHTML = html;
}

window.addWorkstream = function(){
  if(!App.selectedTicketId) return;
  var name = prompt('Workstream name');
  name = name ? name.trim() : '';
  if(!name) return;
  var t = App.allTickets[App.selectedTicketId] || {};
  var exists = workstreamEntries(t).some(function(ws){ return (ws.name || '').toLowerCase() === name.toLowerCase(); });
  if(exists) return;
  activeTicketRef(App.selectedTicketId).child('workstreams').push({
    name:name,
    sortOrder:Date.now(),
    createdTs:Date.now(),
    createdBy:App.currentUser || 'Unknown'
  });
};

window.addVibeTask = function(workstreamId){
  if(!App.selectedTicketId) return;
  var id = domId(workstreamId);
  var textEl = document.getElementById('task-text-'+id);
  var ownerEl = document.getElementById('task-owner-'+id);
  var dueEl = document.getElementById('task-due-'+id);
  var sprintEl = document.getElementById('task-sprint-'+id);
  var text = textEl ? textEl.value.trim() : '';
  if(!text){ if(textEl) textEl.focus(); return; }
  var owner = ownerEl ? ownerEl.value : '';
  var sprintLabel = sprintEl ? sprintEl.value.trim() : '';
  var payload = {
    text:text,
    done:false,
    workstreamId: workstreamId === VIBE_GENERAL_WORKSTREAM_ID ? null : workstreamId,
    deadline: dueEl && dueEl.value ? dueEl.value : null,
    contributors: owner ? [owner] : null,
    sprintLabel: sprintLabel || null,
    createdBy:App.currentUser || 'Unknown',
    ts:Date.now()
  };
  activeTicketRef(App.selectedTicketId).child('subtasks').push(payload);
  var t = App.allTickets[App.selectedTicketId];
  if(t) logActivity('subtask', t.title, text);
  if(textEl) textEl.value = '';
  if(dueEl) dueEl.value = '';
  if(ownerEl) ownerEl.value = '';
};

window.quickAddTask = function(ticketId){
  openDetailModal(ticketId);
  setTimeout(function(){
    var input = document.getElementById('task-text-'+domId(VIBE_GENERAL_WORKSTREAM_ID));
    if(input) input.focus();
  }, 120);
};

function refreshVibeAfterTaskUpdate(ticketId, taskId, upd){
  var t = App.allTickets[ticketId];
  if(t && t.subtasks && t.subtasks[taskId]){
    Object.keys(upd).forEach(function(k){ t.subtasks[taskId][k] = upd[k]; });
  }
  if(App.selectedTicketId === ticketId) renderWorkstreamsAndTasks(ticketId);
  renderList();
  updateStats();
  updateWarnings();
  renderWorkload();
}

window.updateVibeTaskField = function(ticketId, taskId, field, value){
  var upd = {};
  if(field === 'owner') upd.contributors = value ? [value] : null;
  else upd[field] = value === '' ? null : value;
  App.sprintTicketsRef.child(ticketId).child('subtasks/'+taskId).update(upd);
  refreshVibeAfterTaskUpdate(ticketId, taskId, upd);
};

window.toggleVibeTaskFromList = function(ticketId, taskId, current){
  var upd = {done:!current};
  App.sprintTicketsRef.child(ticketId).child('subtasks/'+taskId).update(upd);
  refreshVibeAfterTaskUpdate(ticketId, taskId, upd);
};

window.removeTaskFromSprint = function(ticketId, taskId){
  var upd = {sprintLabel:null};
  App.sprintTicketsRef.child(ticketId).child('subtasks/'+taskId).update(upd);
  refreshVibeAfterTaskUpdate(ticketId, taskId, upd);
};

function updateDetailLayoutForView(){
  var vibe = isSprintView();
  var vibeSection = document.getElementById('vibe-workstream-section');
  var legacySection = document.getElementById('legacy-subtasks-section');
  var advancedToggle = document.getElementById('detail-advanced-toggle');
  var advancedBody = document.getElementById('detail-advanced-body');
  var linksSection = document.getElementById('detail-links-section');
  var deleteBtn = document.querySelector('#detail-modal .btn-danger');
  setDisplay(vibeSection, vibe ? 'block' : 'none');
  setDisplay(legacySection, vibe ? 'none' : 'block');
  setDisplay(advancedToggle, vibe ? 'flex' : 'none');
  setDisplay(advancedBody, vibe ? 'none' : 'block');
  setDisplay(linksSection, vibe ? 'none' : 'block');
  var chevron = document.getElementById('detail-advanced-chevron');
  if(chevron) chevron.style.transform = 'rotate(0deg)';
  if(deleteBtn) deleteBtn.textContent = vibe ? 'Delete initiative' : 'Delete project';
}
