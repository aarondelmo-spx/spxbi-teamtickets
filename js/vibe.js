var VIBE_GENERAL_WORKSTREAM_ID = '_general';
var VIBE_WEEKLY_PLAN_WEEKS = 5;

function jsArg(value){
  return String(value == null ? '' : value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function domId(value){
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function taskOwner(task){
  return task.contributors && task.contributors.length ? task.contributors[0] : '';
}

function initiativeOwner(ticket){
  if(ticket && ticket.assignee && ticket.assignee !== 'Unassigned') return ticket.assignee;
  return ticket && ticket.contributors && ticket.contributors.length ? ticket.contributors[0] : '';
}

function ownerNameList(selected){
  var names = (App.teamMembers || []).map(function(member){ return member.name; }).filter(Boolean);
  if(selected && names.indexOf(selected) === -1) names.unshift(selected);
  return names;
}

function taskDueRank(task){
  if(task.done) return 99999;
  if(!task.deadline) return 90000 + (task.ts || 0) / 10000000000000;
  var diff = deadlineDiff(task.deadline);
  return diff === null ? 90000 : diff;
}

function parseYmd(value){
  if(!value) return null;
  var parts = String(value).split('-').map(function(part){ return parseInt(part, 10); });
  if(parts.length !== 3 || parts.some(function(part){ return isNaN(part); })) return null;
  var date = new Date(parts[0], parts[1] - 1, parts[2]);
  if(date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) return null;
  date.setHours(0,0,0,0);
  return date;
}

function ymd(date){
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

function addDays(date, days){
  var next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  next.setHours(0,0,0,0);
  return next;
}

function weekStartForDate(value){
  var date = value instanceof Date ? new Date(value.getFullYear(), value.getMonth(), value.getDate()) : parseYmd(value);
  if(!date) date = new Date();
  date.setHours(0,0,0,0);
  var day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

function selectedWeekStart(){
  var start = parseYmd(App.activePlanWeekStart);
  if(!start){
    start = weekStartForDate(new Date());
    App.activePlanWeekStart = ymd(start);
    localStorage.setItem('spxbi_active_week_start', App.activePlanWeekStart);
  }
  return start;
}

function shortDateLabel(date){
  return date.toLocaleDateString(undefined, {month:'short', day:'numeric'});
}

function weekRangeLabel(start){
  var end = addDays(start, 6);
  return shortDateLabel(start) + ' - ' + shortDateLabel(end);
}

function taskInWeek(task, start){
  var due = parseYmd(task && task.deadline);
  if(!due) return false;
  var end = addDays(start, 6);
  return due >= start && due <= end;
}

function taskInWeekWindow(task, start, weekCount){
  var due = parseYmd(task && task.deadline);
  if(!due) return false;
  var end = addDays(start, weekCount * 7 - 1);
  return due >= start && due <= end;
}

function weekLabelForOffset(offset){
  if(offset === 0) return 'Selected week';
  if(offset === 1) return 'Next week';
  return offset + ' weeks out';
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

function customWorkstreamEntries(t){
  return workstreamEntries(t).filter(function(ws){ return !ws.virtual; });
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

function syncWeeklyPlanControls(){
  var input = document.getElementById('vibe-week-date');
  var label = document.getElementById('vibe-week-label');
  if(!input || !label) return;
  var start = selectedWeekStart();
  input.value = ymd(start);
  label.textContent = weekRangeLabel(start);
}

function setDisplay(el, display){
  if(el) el.style.display = display;
}

function validVibeMetricFilter(filter){
  return filter === 'teamSize' || filter === 'reviewed' || filter === 'scoped' || filter === 'inProgress';
}

function syncVibeMetricCards(){
  var row = document.getElementById('stats-row');
  if(row) row.classList.toggle('vibe-metric-mode', isSprintView());
  document.querySelectorAll('[data-vibe-metric]').forEach(function(card){
    var active = isSprintView() && App.vibeMetricFilter === card.getAttribute('data-vibe-metric');
    card.classList.toggle('active', active);
    if(isSprintView()){
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-pressed', active ? 'true' : 'false');
    } else {
      card.removeAttribute('role');
      card.removeAttribute('tabindex');
      card.removeAttribute('aria-pressed');
    }
  });
}

function updateVibeShell(){
  var vibe = isSprintView();
  if(vibe && App.currentVibeView === 'tasks') App.currentVibeView = 'initiatives';
  setDisplay(document.getElementById('vibe-view-bar'), vibe ? 'flex' : 'none');
  setDisplay(document.getElementById('vibe-sprint-controls'), vibe && App.currentVibeView === 'sprint' ? 'flex' : 'none');

  ['initiatives','sprint'].forEach(function(view){
    var tab = document.getElementById('vibe-tab-'+view);
    if(tab) tab.classList.toggle('active', App.currentVibeView === view);
  });

  ['status-filter-label','nav-active','nav-all','nav-open','nav-done','priority-filter-label','nav-p0','nav-p1','nav-p2','nav-p3'].forEach(function(id){
    setDisplay(document.getElementById(id), vibe ? 'none' : '');
  });
  ['pill-active','pill-all','pill-open','toolbar-priority-sep','pill-p0','pill-p1','pill-p2','pill-p3'].forEach(function(id){
    setDisplay(document.getElementById(id), vibe ? 'none' : '');
  });
  document.querySelectorAll('.vibe-advanced-filter').forEach(function(el){
    el.style.display = vibe ? 'none' : '';
  });
  setDisplay(document.getElementById('pill-done'), vibe ? 'none' : '');
  setDisplay(document.getElementById('contrib-filter-row'), vibe ? 'none' : 'flex');
  document.querySelectorAll('.shell-tool').forEach(function(el){
    el.style.display = vibe ? 'none' : '';
  });

  var filterBtn = document.getElementById('vibe-filter-toggle');
  setDisplay(filterBtn, vibe ? 'none' : '');
  var donePill = document.getElementById('pill-done');
  if(donePill) donePill.textContent = 'Done';
  var vibeDone = document.getElementById('vibe-done-toggle');
  if(vibeDone){
    vibeDone.textContent = App.currentFilter === 'done' ? 'Showing Done' : 'Done';
    vibeDone.classList.toggle('active', vibe && App.currentFilter === 'done');
  }

  var dashboard = document.getElementById('dashboard-row');
  var workload = document.getElementById('workload-panel');
  var activity = document.getElementById('activity-panel');
  var warnTitle = document.getElementById('warn-banner-title');
  if(dashboard) dashboard.style.gridTemplateColumns = vibe ? '1fr' : '1fr 1fr 300px';
  setDisplay(workload, vibe ? 'none' : '');
  setDisplay(activity, vibe ? 'none' : '');
  if(warnTitle) warnTitle.textContent = vibe ? 'Needs attention' : '\u26A0 Deadline alerts';
  syncWeeklyPlanControls();
  syncVibeMetricCards();
  var isSprint = vibe && App.currentVibeView === 'sprint';
  var statsRow = document.getElementById('stats-row');
  var whoRow = document.getElementById('who-filter-row');
  if(statsRow) statsRow.style.display = isSprint ? 'none' : '';
  if(whoRow) whoRow.classList.toggle('visible', !!isSprint);
}

window.toggleVibeFilters = function(){
  App.vibeFiltersOpen = !App.vibeFiltersOpen;
  updateVibeShell();
};

window.setVibeView = function(view){
  if(view !== 'initiatives' && view !== 'sprint') return;
  App.currentVibeView = view;
  updateVibeShell();
  updateStats();
  renderList();
};

window.setVibeMetricFilter = function(filter){
  if(!isSprintView()) return;
  App.vibeMetricFilter = App.vibeMetricFilter === filter || !validVibeMetricFilter(filter) ? 'all' : filter;
  syncVibeMetricCards();
  renderList();
};

window.setWeeklyPlanDateFromInput = function(){
  var input = document.getElementById('vibe-week-date');
  var start = weekStartForDate(input ? input.value : null);
  App.activePlanWeekStart = ymd(start);
  localStorage.setItem('spxbi_active_week_start', App.activePlanWeekStart);
  syncWeeklyPlanControls();
  updateStats();
  renderList();
};

window.setVibeWhoFilter = function(val){
  App.vibeWhoFilter = val;
  var allCard = document.getElementById('who-card-all');
  var mineCard = document.getElementById('who-card-mine');
  if(allCard) allCard.classList.toggle('active', val === 'all');
  if(mineCard) mineCard.classList.toggle('active', val === 'mine');
  renderList();
};

window.shiftWeeklyPlanWeek = function(delta){
  var start = addDays(selectedWeekStart(), delta * 7);
  App.activePlanWeekStart = ymd(start);
  localStorage.setItem('spxbi_active_week_start', App.activePlanWeekStart);
  syncWeeklyPlanControls();
  updateStats();
  renderList();
};

function updateVibeStats(initiatives, extra){
  var totals = automationTotals(initiatives);
  var teamSize = automationTeamSizeTotal(initiatives);
  document.getElementById('s-total-label').textContent='Team size';
  document.getElementById('s-open-label').textContent='Reviewed';
  document.getElementById('s-prog-label').textContent='Scoped';
  document.getElementById('s-done-label').textContent='In progress';
  document.getElementById('s-open').className='stat-num c-high';
  document.getElementById('s-prog').className='stat-num c-prog';
  document.getElementById('s-done').className='stat-num c-done';
  document.getElementById('s-total').textContent=fmtCapacity(teamSize);
  document.getElementById('s-open').textContent=fmtCapacity(totals.reviewed);
  document.getElementById('s-prog').textContent=fmtCapacity(totals.scoped);
  document.getElementById('s-done').textContent=fmtCapacity(totals.progress);
  document.getElementById('s-extra-label').textContent='HC savings';
  document.getElementById('s-extra').textContent=fmtCapacity(totals.actual)+' / '+fmtCapacity(totals.excess);
  if(extra) extra.style.display='';
  var viewLabel = App.currentVibeView === 'sprint'
    ? 'Weekly plan: '+weekRangeLabel(selectedWeekStart())+' onward'
    : 'Initiative planning';
  document.getElementById('ticket-count-sub').textContent=initiatives.length+' initiative'+(initiatives.length!==1?'s':'')+' total - '+viewLabel;
  syncWeeklyPlanControls();
  syncVibeMetricCards();
}

function initiativeMatchesFilter(entry){
  var t = entry[1];
  if(App.currentFilter === 'all') return true;
  if(App.currentFilter === 'active') return t.status !== 'done';
  return t.status === App.currentFilter;
}

function initiativeSubteamRecord(t){
  var team = normalizeTeamName(t && t.teamArea);
  var subteam = normalizeSubteamName(t && t.subteam);
  return automationSubteamList(team).find(function(item){ return item.name === subteam; }) || null;
}

function initiativeMatchesVibeMetric(t){
  var filter = App.vibeMetricFilter || 'all';
  if(filter === 'all') return true;
  var team = normalizeTeamName(t && t.teamArea);
  var subteam = normalizeSubteamName(t && t.subteam);
  if(filter === 'teamSize') return subteamSizeHc(team, subteam) > 0;
  if(filter === 'reviewed') return subteamReviewed(initiativeSubteamRecord(t));
  if(filter === 'scoped') return automationScopedHc(t) > 0;
  if(filter === 'inProgress') return String(t && t.status || '').toLowerCase() === 'in progress';
  return true;
}

function initiativeMatchesSearch(t, search){
  if(!search) return true;
  if((t.title||'').toLowerCase().includes(search)) return true;
  if((t.desc||'').toLowerCase().includes(search)) return true;
  if((t.teamArea||'').toLowerCase().includes(search)) return true;
  if((t.subteam||'').toLowerCase().includes(search)) return true;
  return taskEntries('', t).some(function(item){
    return (item.task.text||'').toLowerCase().includes(search)
      || (item.workstreamName||'').toLowerCase().includes(search);
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

function dueThisWeekCount(t){
  var start = weekStartForDate(new Date());
  return Object.values(t.subtasks || {}).filter(function(task){
    return !task.done && taskInWeek(task, start);
  }).length;
}

function initiativeCardHtml(id, t){
  var stats = initiativeTaskStats(t);
  var pct = stats.total ? Math.round(stats.done / stats.total * 100) : 0;
  var due = nearestDueTask(t);
  var dueText = due ? deadlineTagHtml(due.deadline, due.done ? 'done' : 'open') + ' ' + safeText(due.text || 'Task') : '<span>No due tasks</span>';
  var groupCount = customWorkstreamEntries(t).length;
  var weeklyDue = dueThisWeekCount(t);
  var hcText = fmtCapacity(automationScopedHc(t))+' scoped | '+fmtCapacity(automationInProgressHc(t))+' in progress | '+fmtCapacity(countedActualHcSavings(t))+' / '+fmtCapacity(excessCapacityHc(t))+' saved';
  return '<div class="initiative-card" onclick="openDetailModal(\''+jsArg(id)+'\')">'
    +'<div>'
    +'<div class="initiative-title-row"><span class="initiative-title">'+safeText(t.title || 'Untitled initiative')+'</span><span class="status-badge '+statusClass(t.status)+'">'+safeText(t.status || 'open')+'</span></div>'
    +'<div class="initiative-meta">'
    +'<span>'+stats.done+'/'+stats.total+' tasks</span>'
    +(weeklyDue?'<span>'+weeklyDue+' due this week</span>':'')
    +(groupCount?'<span>'+groupCount+' group'+(groupCount!==1?'s':'')+'</span>':'')
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

function hcSummaryHtml(items, teamName, showTeamSize, subteamName){
  var initiatives = items.map(function(entry){ return entry[1] || entry.t || entry; });
  var totals = automationTotals(initiatives);
  teamName = teamName ? normalizeTeamName(teamName) : '';
  subteamName = subteamName ? normalizeSubteamName(subteamName) : '';
  var size = subteamName ? subteamSizeHc(teamName, subteamName) : (teamName ? teamSizeHc(teamName) : automationTeamSizeTotal(initiatives));
  var reviewed = subteamName ? subteamReviewedCoverage(teamName, subteamName) : (teamName ? teamReviewedCoverage(teamName) : totals.reviewed);
  return '<div class="team-hc-strip">'
    +((showTeamSize || subteamName) ? '<span>'+(subteamName ? 'Subteam size ' : 'Team size ')+fmtCapacity(size)+'</span>' : '')
    +'<span>Reviewed '+fmtCapacity(reviewed)+'</span>'
    +'<span>Scoped '+fmtCapacity(totals.scoped)+'</span>'
    +'<span>In progress '+fmtCapacity(totals.progress)+'</span>'
    +'<span>Savings '+fmtCapacity(totals.actual)+' / '+fmtCapacity(totals.excess)+'</span>'
    +'</div>';
}

function editableTeamHeadingHtml(teamName){
  return '<button class="team-heading edit-heading" onclick="openHierarchyEditModal(\'team\',\''+jsArg(teamName)+'\')" type="button">'
    +'<span>'+safeText(teamName)+'</span><span class="edit-hint">Edit</span>'
    +'</button>';
}

function editableSubteamHeadingHtml(teamName, subteamName){
  return '<button class="subteam-heading edit-heading" onclick="openHierarchyEditModal(\'subteam\',\''+jsArg(teamName)+'\',\''+jsArg(subteamName)+'\')" type="button">'
    +'<span>'+safeText(subteamName)+'</span><span class="edit-hint">Edit</span>'
    +'</button>';
}

function renderVibeInitiatives(search, list){
  var entries = Object.entries(App.allTickets || {})
    .filter(initiativeMatchesFilter)
    .filter(function(entry){ return initiativeMatchesVibeMetric(entry[1]); })
    .filter(function(entry){ return App.currentPriorityFilter === 'all' || (entry[1].priority || 'p1') === App.currentPriorityFilter; })
    .filter(function(entry){ return initiativeMatchesSearch(entry[1], search); })
    .sort(function(a,b){
      return compareTeams(normalizeTeamName(a[1].teamArea), normalizeTeamName(b[1].teamArea))
        || compareSubteams(normalizeSubteamName(a[1].subteam), normalizeSubteamName(b[1].subteam))
        || (b[1].createdTs || 0) - (a[1].createdTs || 0);
    });
  if(!entries.length){
    list.innerHTML = '<div class="empty-state"><div style="font-size:28px;opacity:.3">&#9675;</div><p>No Vibe Coding initiatives match this view.</p></div>';
    return;
  }
  var grouped = {};
  entries.forEach(function(entry){
    var t = entry[1];
    var team = normalizeTeamName(t.teamArea);
    var subteam = normalizeSubteamName(t.subteam);
    if(!grouped[team]) grouped[team] = {};
    if(!grouped[team][subteam]) grouped[team][subteam] = [];
    grouped[team][subteam].push(entry);
  });
  var html = '';
  Object.keys(grouped).sort(compareTeams).forEach(function(team){
    var teamEntries = [];
    Object.keys(grouped[team]).forEach(function(subteam){ teamEntries = teamEntries.concat(grouped[team][subteam]); });
    html += '<div class="team-group"><div class="team-heading-row">'+editableTeamHeadingHtml(team)+hcSummaryHtml(teamEntries, team, true, null)+'</div>';
    Object.keys(grouped[team]).sort(compareSubteams).forEach(function(subteam){
      html += '<div class="subteam-group"><div class="subteam-heading-row">'+editableSubteamHeadingHtml(team, subteam)+hcSummaryHtml(grouped[team][subteam], team, false, subteam)+'</div><div class="initiative-card-grid">'
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
  if(!initiativeMatchesVibeMetric(item.initiative)) return false;
  if(App.currentContrib !== 'all'){
    var contribs = task.contributors || [];
    if(contribs.indexOf(App.currentContrib) === -1) return false;
  }
  if(App.currentPriorityFilter !== 'all' && (item.initiative.priority || 'p1') !== App.currentPriorityFilter) return false;
  if(!search) return true;
  return (task.text || '').toLowerCase().includes(search)
    || (item.initiative.title || '').toLowerCase().includes(search)
    || (item.workstreamName || '').toLowerCase().includes(search)
    || (taskOwner(task) || '').toLowerCase().includes(search);
}

function taskOwnerSelectHtml(item){
  var selected = taskOwner(item.task);
  var options = '<option value="">Unassigned</option>' + ownerNameList(selected).map(function(name){
    return '<option value="'+safeText(name)+'"'+(selected===name?' selected':'')+'>'+safeText(name)+'</option>';
  }).join('');
  return '<select class="task-inline-select" onchange="updateVibeTaskField(\''+jsArg(item.ticketId)+'\',\''+jsArg(item.taskId)+'\',\'owner\',this.value)">'+options+'</select>';
}

function taskRowHtml(item, mode){
  var task = item.task;
  var checked = !!task.done;
  var action = '<button class="btn btn-sm" onclick="openDetailModal(\''+jsArg(item.ticketId)+'\')" type="button">Open</button>';
  return '<div class="vibe-task-row'+(checked?' done-task':'')+'">'
    +'<div class="subtask-check'+(checked?' checked':'')+'" onclick="toggleVibeTaskFromList(\''+jsArg(item.ticketId)+'\',\''+jsArg(item.taskId)+'\','+checked+')"></div>'
    +'<div><div class="task-text">'+safeText(task.text || 'Untitled task')+'</div><div class="task-parent">'+safeText(item.initiative.title || 'Untitled initiative')+' / '+safeText(item.workstreamName)+'</div></div>'
    +taskOwnerSelectHtml(item)
    +'<input class="task-inline-input" type="date" title="Due date" aria-label="Due date" value="'+safeText(task.deadline || '')+'" onchange="updateVibeTaskField(\''+jsArg(item.ticketId)+'\',\''+jsArg(item.taskId)+'\',\'deadline\',this.value)" />'
    +'<div style="display:flex;gap:5px;justify-content:flex-end">'+action+'</div>'
    +'</div>';
}

function groupedTasksHtml(items, mode){
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
  return html;
}

function renderGroupedTasks(items, list, emptyText, mode){
  if(!items.length){
    list.innerHTML = '<div class="vibe-empty">'+safeText(emptyText)+'</div>';
    return;
  }
  list.innerHTML = groupedTasksHtml(items, mode);
}

function weeklyPlanGroupsHtml(items, start, emptyText){
  if(!items.length){
    var end = addDays(start, VIBE_WEEKLY_PLAN_WEEKS * 7 - 1);
    return '<div class="vibe-empty">'+safeText(emptyText || ('No tasks are due from '+weekRangeLabel(start)+' through '+weekRangeLabel(addDays(end, -6))+'.'))+'</div>';
  }
  var grouped = {};
  items.forEach(function(item){
    var weekStart = weekStartForDate(item.task.deadline);
    var key = ymd(weekStart);
    if(!grouped[key]) grouped[key] = {start:weekStart, items:[]};
    grouped[key].items.push(item);
  });
  var html = '';
  Object.keys(grouped).sort().forEach(function(key){
    var week = grouped[key];
    var offset = Math.round((week.start - start) / (7 * 24 * 60 * 60 * 1000));
    var sorted = week.items.slice().sort(function(a,b){ return taskDueRank(a.task) - taskDueRank(b.task) || (a.task.ts||0) - (b.task.ts||0); });
    html += '<div class="vibe-week-group">'
      +'<div class="vibe-week-heading"><div><div class="vibe-section-title">'+safeText(weekLabelForOffset(offset))+'</div><div class="week-label">'+safeText(weekRangeLabel(week.start))+'</div></div><span>'+sorted.length+' task'+(sorted.length!==1?'s':'')+'</span></div>'
      +sorted.map(function(item){ return taskRowHtml(item, 'weekly'); }).join('')
      +'</div>';
  });
  return html;
}

function renderWeeklyPlanGroups(items, list, start){
  if(!items.length){
    var end = addDays(start, VIBE_WEEKLY_PLAN_WEEKS * 7 - 1);
    list.innerHTML = '<div class="vibe-empty">No tasks are due from '+safeText(weekRangeLabel(start))+' through '+safeText(weekRangeLabel(addDays(end, -6)))+'. Add due dates to place tasks into the Weekly Plan.</div>';
    return;
  }
  var html = weeklyPlanGroupsHtml(items, start);
  list.innerHTML = html;
}

function taskAssignedToCurrentUser(item){
  var user = App.currentUser || '';
  if(!user) return false;
  var contribs = item.task.contributors || [];
  return contribs.indexOf(user) > -1;
}

function weeklyPlanPanelHtml(title, subtitle, items, start, emptyText){
  return '<div class="weekly-plan-panel">'
    +'<div class="weekly-plan-panel-head"><div><div class="vibe-section-title">'+safeText(title)+'</div><div class="microcopy">'+safeText(subtitle)+'</div></div><span>'+items.length+' task'+(items.length!==1?'s':'')+'</span></div>'
    +weeklyPlanGroupsHtml(items, start, emptyText)
    +'</div>';
}

function renderVibeWeeklyPlan(search, list){
  syncWeeklyPlanControls();
  var start = selectedWeekStart();
  var whoFilter = App.vibeWhoFilter || 'all';
  var items = collectVibeTasks()
    .filter(function(item){ return taskInWeekWindow(item.task, start, VIBE_WEEKLY_PLAN_WEEKS); })
    .filter(function(item){ return taskMatchesCurrentView(item, search); })
    .filter(function(item){ return whoFilter === 'mine' ? taskAssignedToCurrentUser(item) : true; })
    .sort(function(a,b){ return taskDueRank(a.task) - taskDueRank(b.task) || (a.task.ts || 0) - (b.task.ts || 0); });
  renderWeeklyPlanGroups(items, list, start);
}

function renderVibeSprint(search, list){
  renderVibeWeeklyPlan(search, list);
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
  renderVibeInitiatives(search, list);
}

function addTaskOwnerOptions(selected){
  return '<option value="">Owner</option>' + ownerNameList(selected).map(function(name){
    return '<option value="'+safeText(name)+'"'+(selected===name?' selected':'')+'>'+safeText(name)+'</option>';
  }).join('');
}

function workstreamTaskRowHtml(ticketId, taskId, task, workstreamName){
  var checked = !!task.done;
  var item = {ticketId:ticketId, taskId:taskId, task:task, initiative:App.allTickets[ticketId] || {}, workstreamName:workstreamName};
  return '<div class="task-row'+(checked?' done-task':'')+'">'
    +'<div class="subtask-check'+(checked?' checked':'')+'" onclick="toggleVibeTaskFromList(\''+jsArg(ticketId)+'\',\''+jsArg(taskId)+'\','+checked+')"></div>'
    +'<div class="task-text">'+safeText(task.text || 'Untitled task')+'</div>'
    +taskOwnerSelectHtml(item)
    +'<input class="task-inline-input" type="date" title="Due date" aria-label="Due date" value="'+safeText(task.deadline || '')+'" onchange="updateVibeTaskField(\''+jsArg(ticketId)+'\',\''+jsArg(taskId)+'\',\'deadline\',this.value)" />'
    +'<button class="btn-icon" onclick="deleteSubtask(\''+jsArg(taskId)+'\')" title="Remove task" type="button">x</button>'
    +'</div>';
}

function taskComposerHtml(workstreamId){
  var id = domId(workstreamId);
  var owner = initiativeOwner(App.allTickets[App.selectedTicketId] || {});
  return '<div class="task-add-row">'
    +'<input id="task-text-'+id+'" placeholder="Add task..." onkeydown="if(event.key===\'Enter\')addVibeTask(\''+jsArg(workstreamId)+'\')" />'
    +'<select id="task-owner-'+id+'">'+addTaskOwnerOptions(owner)+'</select>'
    +'<input id="task-due-'+id+'" type="date" title="Due date" aria-label="Due date" />'
    +'<button class="btn btn-sm btn-primary" onclick="addVibeTask(\''+jsArg(workstreamId)+'\')" type="button">Add</button>'
    +'</div>';
}

function renderWorkstreamsAndTasks(ticketId){
  var t = App.allTickets[ticketId]; if(!t) return;
  var section = document.getElementById('vibe-workstream-section');
  var list = document.getElementById('vibe-workstream-list');
  if(section) section.style.display = 'block';
  if(!list) return;
  var tasks = taskEntries(ticketId, t);
  var generalTasks = tasks.filter(function(item){ return item.workstreamId === VIBE_GENERAL_WORKSTREAM_ID; })
    .sort(function(a,b){ return taskDueRank(a.task) - taskDueRank(b.task) || (a.task.ts || 0) - (b.task.ts || 0); });
  var html = '<div class="task-primary-panel">'
    +'<div class="task-list">'+(generalTasks.length ? generalTasks.map(function(item){ return workstreamTaskRowHtml(ticketId, item.taskId, item.task, 'General'); }).join('') : '<div class="empty-inline">No tasks yet.</div>')+'</div>'
    +taskComposerHtml(VIBE_GENERAL_WORKSTREAM_ID)
    +'</div>';
  var groups = customWorkstreamEntries(t);
  if(groups.length){
    html += '<div class="task-group-list"><div class="vibe-section-title">Task groups</div>';
  }
  html += groups.map(function(ws){
    var wsTasks = tasks.filter(function(item){ return item.workstreamId === ws.id; })
      .sort(function(a,b){ return taskDueRank(a.task) - taskDueRank(b.task) || (a.task.ts || 0) - (b.task.ts || 0); });
    var activeCount = wsTasks.filter(function(item){return !item.task.done;}).length;
    return '<div class="workstream-card">'
      +'<div class="workstream-head"><div><div class="workstream-title">'+safeText(ws.name || 'Group')+'</div><div class="microcopy">Optional task group for a separate track of work.</div></div>'
      +'<div class="workstream-actions"><div class="workstream-count">'+activeCount+' active</div><button class="btn-icon workstream-delete" onclick="deleteWorkstream(\''+jsArg(ticketId)+'\',\''+jsArg(ws.id)+'\')" title="Delete task group" type="button">x</button></div></div>'
      +'<div class="task-list">'+(wsTasks.length ? wsTasks.map(function(item){ return workstreamTaskRowHtml(ticketId, item.taskId, item.task, ws.name || 'Group'); }).join('') : '<div class="empty-inline">No tasks yet.</div>')+'</div>'
      +taskComposerHtml(ws.id)
      +'</div>';
  }).join('');
  if(groups.length) html += '</div>';
  list.innerHTML = html;
}

window.addWorkstream = function(){
  if(!App.selectedTicketId) return;
  var name = prompt('Group name');
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

window.deleteWorkstream = function(ticketId, workstreamId){
  if(!ticketId || !workstreamId || workstreamId === VIBE_GENERAL_WORKSTREAM_ID) return;
  var t = App.allTickets[ticketId];
  if(!t || !t.workstreams || !t.workstreams[workstreamId]) return;
  var groupName = t.workstreams[workstreamId].name || 'this group';
  var affectedTasks = Object.entries(t.subtasks || {}).filter(function(entry){
    return entry[1] && entry[1].workstreamId === workstreamId;
  });
  var message = 'Delete task group "'+groupName+'"?';
  if(affectedTasks.length){
    message += '\n\nIts '+affectedTasks.length+' task'+(affectedTasks.length!==1?'s':'')+' will move back to the main task list.';
  }
  if(!confirm(message)) return;
  var updates = {};
  updates['sprintProjects/'+ticketId+'/workstreams/'+workstreamId] = null;
  affectedTasks.forEach(function(entry){
    updates['sprintProjects/'+ticketId+'/subtasks/'+entry[0]+'/workstreamId'] = null;
  });
  App.db.ref().update(updates);
  delete t.workstreams[workstreamId];
  affectedTasks.forEach(function(entry){
    if(t.subtasks && t.subtasks[entry[0]]) t.subtasks[entry[0]].workstreamId = null;
  });
  if(App.sprintTickets && App.sprintTickets[ticketId]) App.sprintTickets[ticketId] = t;
  if(App.selectedTicketId === ticketId) renderWorkstreamsAndTasks(ticketId);
  renderList();
  updateStats();
  updateWarnings();
  renderWorkload();
};

window.addVibeTask = function(workstreamId){
  if(!App.selectedTicketId) return;
  var id = domId(workstreamId);
  var textEl = document.getElementById('task-text-'+id);
  var ownerEl = document.getElementById('task-owner-'+id);
  var dueEl = document.getElementById('task-due-'+id);
  var text = textEl ? textEl.value.trim() : '';
  if(!text){ if(textEl) textEl.focus(); return; }
  var owner = ownerEl ? ownerEl.value : '';
  var defaultOwner = initiativeOwner(App.allTickets[App.selectedTicketId] || {});
  var payload = {
    text:text,
    done:false,
    workstreamId: workstreamId === VIBE_GENERAL_WORKSTREAM_ID ? null : workstreamId,
    deadline: dueEl && dueEl.value ? dueEl.value : null,
    contributors: owner ? [owner] : null,
    createdBy:App.currentUser || 'Unknown',
    ts:Date.now()
  };
  activeTicketRef(App.selectedTicketId).child('subtasks').push(payload);
  var t = App.allTickets[App.selectedTicketId];
  if(t) logActivity('subtask', t.title, text);
  if(textEl) textEl.value = '';
  if(dueEl) dueEl.value = '';
  if(ownerEl) ownerEl.value = defaultOwner;
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

function updateDetailLayoutForView(){
  var vibe = isSprintView();
  var vibeSection = document.getElementById('vibe-workstream-section');
  var legacySection = document.getElementById('legacy-subtasks-section');
  var advancedToggle = document.getElementById('detail-advanced-toggle');
  var advancedBody = document.getElementById('detail-advanced-body');
  var ownerField = document.getElementById('detail-owner-field');
  var linksSection = document.getElementById('detail-links-section');
  var deleteBtn = document.querySelector('#detail-modal .btn-danger');
  setDisplay(vibeSection, vibe ? 'block' : 'none');
  setDisplay(legacySection, vibe ? 'none' : 'block');
  setDisplay(advancedToggle, vibe ? 'flex' : 'none');
  setDisplay(advancedBody, vibe ? 'none' : 'block');
  setDisplay(ownerField, vibe ? 'block' : 'none');
  setDisplay(linksSection, 'block');
  var chevron = document.getElementById('detail-advanced-chevron');
  if(chevron) chevron.style.transform = 'rotate(0deg)';
  if(deleteBtn) deleteBtn.textContent = vibe ? 'Delete initiative' : 'Delete project';
}
