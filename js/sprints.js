function isSprintView(){
  return App.currentProjectView === 'sprint';
}

function currentTicketsRef(){
  return isSprintView() ? App.sprintTicketsRef : App.mainTicketsRef;
}

function currentTickets(){
  return isSprintView() ? App.sprintTickets : App.mainTickets;
}

function activeTicketRef(id){
  return currentTicketsRef().child(id);
}

function numVal(v){
  var n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function cleanNumField(id){
  var el = document.getElementById(id);
  if(!el || el.value === '') return null;
  var n = parseFloat(el.value);
  return isNaN(n) ? null : n;
}

function cleanTextField(id){
  var el = document.getElementById(id);
  if(!el) return null;
  var value = el.value.trim();
  return value || null;
}

function safeText(value){
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsDataArg(value){
  return String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

var SCOPED_HC_HELP_TEXT = 'Estimated HC-equivalent capacity already mapped to named Vibe Coding initiatives. This is opportunity only, not confirmed HC reduction, until implementation is stable and capacity review is complete.';

function infoTipHtml(text){
  var tip = safeText(text);
  return '<span class="info-tip" tabindex="0" aria-label="'+tip+'" title="'+tip+'" data-tooltip="'+tip+'">?</span>';
}

function fmtCapacity(n){
  n = numVal(n);
  if(Math.abs(n - Math.round(n)) < 0.001) return String(Math.round(n));
  return n.toFixed(1);
}

function unclassifiedCapacity(t){
  return Math.max(numVal(t.scopedHc) - numVal(t.fteRepurpose) - numVal(t.fteBuffer) - numVal(t.bpoNfteReduction), 0);
}

function automationScopedHc(t){
  return t && t.automationScopedHc != null ? numVal(t.automationScopedHc) : numVal(t && t.scopedHc);
}

function automationReviewedHc(t){
  if(t && t.automationReviewedHc != null) return numVal(t.automationReviewedHc);
  if(t && t.reviewedHc != null) return numVal(t.reviewedHc);
  return automationScopedHc(t);
}

function automationInProgressHc(t){
  return t && String(t.status || '').toLowerCase() === 'in progress' ? automationScopedHc(t) : 0;
}

function actualHcSavings(t){
  if(t && t.actualHcSavings != null) return numVal(t.actualHcSavings);
  return numVal(t && t.fteRepurpose) + numVal(t && t.bpoNfteReduction);
}

function countedActualHcSavings(t){
  return t && String(t.status || '').toLowerCase() === 'done' ? actualHcSavings(t) : 0;
}

function excessCapacityHc(t){
  return t && t.excessCapacityHc != null ? numVal(t.excessCapacityHc) : numVal(t && t.fteBuffer);
}

function teamSizeFieldValue(teamName){
  var team = automationTeamList().find(function(item){ return item.name === teamName; });
  if(!team) return null;
  if(team.teamSizeHc != null) return numVal(team.teamSizeHc);
  if(team.currentHc != null) return numVal(team.currentHc);
  return null;
}

function teamSizeHc(teamName){
  return numVal(teamSizeFieldValue(teamName));
}

function subteamSizeFieldValue(teamName, subteamName){
  var subteam = automationSubteamList(teamName).find(function(item){ return item.name === subteamName; });
  if(!subteam) return null;
  if(subteam.subteamSizeHc != null) return numVal(subteam.subteamSizeHc);
  if(subteam.currentHc != null) return numVal(subteam.currentHc);
  return null;
}

function subteamSizeHc(teamName, subteamName){
  return numVal(subteamSizeFieldValue(teamName, subteamName));
}

function hierarchySizeHc(teamName, subteamName){
  var subteamSize = subteamName ? subteamSizeFieldValue(teamName, subteamName) : null;
  if(subteamSize != null) return subteamSize;
  return teamSizeHc(teamName);
}

function automationTotals(items){
  return items.reduce(function(acc, t){
    acc.reviewed += automationReviewedHc(t);
    acc.scoped += automationScopedHc(t);
    acc.progress += automationInProgressHc(t);
    acc.actual += countedActualHcSavings(t);
    acc.excess += excessCapacityHc(t);
    return acc;
  }, {reviewed:0, scoped:0, progress:0, actual:0, excess:0});
}

function automationTeamSizeTotal(items){
  var teams = {};
  var subteams = {};
  items.forEach(function(t){
    var teamName = t.teamArea || 'Unassigned';
    var teamSize = teamSizeFieldValue(teamName);
    if(teamSize != null){
      teams[teamName] = teamSize;
      return;
    }
    var subteamName = t.subteam || 'Unassigned subteam';
    var key = teamName + '|' + subteamName;
    if(!subteams[key]) subteams[key] = subteamSizeFieldValue(teamName, subteamName);
  });
  return Object.values(teams).reduce(function(sum, n){ return sum + numVal(n); }, 0)
    + Object.values(subteams).reduce(function(sum, n){ return sum + numVal(n); }, 0);
}

function sprintTotals(items){
  return items.reduce(function(acc, t){
    acc.scoped += numVal(t.scopedHc);
    acc.repurpose += numVal(t.fteRepurpose);
    acc.buffer += numVal(t.fteBuffer);
    acc.reduction += numVal(t.bpoNfteReduction);
    acc.unclassified += unclassifiedCapacity(t);
    return acc;
  }, {scoped:0, repurpose:0, buffer:0, reduction:0, unclassified:0});
}

function sprintPayloadFromNewModal(){
  return {
    projectType: 'sprint',
    teamArea: document.getElementById('nt-team-area').value || 'Unassigned',
    subteam: cleanTextField('nt-subteam'),
    sprintCycle: cleanTextField('nt-sprint-cycle'),
    timelineStart: cleanTextField('nt-timeline-start'),
    timelineEnd: cleanTextField('nt-timeline-end'),
    stage: document.getElementById('nt-stage').value || 'scoping',
    confidence: document.getElementById('nt-confidence').value || 'medium',
    automationReviewedHc: cleanNumField('nt-automation-reviewed-hc'),
    automationScopedHc: cleanNumField('nt-automation-scoped-hc'),
    actualHcSavings: cleanNumField('nt-actual-hc-savings'),
    excessCapacityHc: cleanNumField('nt-excess-capacity-hc')
  };
}

function clearSprintNewFields(){
  [
    'nt-subteam',
    'nt-sprint-cycle',
    'nt-timeline-start',
    'nt-timeline-end',
    'nt-automation-reviewed-hc',
    'nt-automation-scoped-hc',
    'nt-actual-hc-savings',
    'nt-excess-capacity-hc'
  ].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.value = '';
  });
  var team = document.getElementById('nt-team-area');
  var stage = document.getElementById('nt-stage');
  var confidence = document.getElementById('nt-confidence');
  renderTeamSelect('nt', 'FinOps');
  if(team && !team.value) team.value = 'FinOps';
  renderSubteamSelect('nt');
  if(stage) stage.value = 'scoping';
  if(confidence) confidence.value = 'medium';
}

function updateAppShell(){
  var sprint = isSprintView();
  var title = document.querySelector('.page-title');
  var sub = document.getElementById('ticket-count-sub');
  var newBtn = document.getElementById('new-project-btn');
  var search = document.getElementById('search-input');
  var mainTab = document.getElementById('view-main');
  var sprintTab = document.getElementById('view-sprint');
  var newTitle = document.getElementById('new-modal-title');
  var createBtn = document.getElementById('create-ticket-btn');
  var sprintFields = document.getElementById('nt-sprint-fields');
  var sprintBoard = document.getElementById('sprint-board');
  if(title) title.textContent = sprint ? 'Vibe Coding Projects' : 'Main Projects';
  if(sub) sub.textContent = Object.keys(App.allTickets).length + (sprint ? ' initiative' : ' project') + (Object.keys(App.allTickets).length !== 1 ? 's' : '') + ' total';
  if(newBtn) newBtn.textContent = sprint ? '+ New Initiative' : '+ New Project';
  if(search) search.placeholder = sprint ? 'Search initiatives, groups, tasks, teams...' : 'Search main projects...';
  if(mainTab) mainTab.classList.toggle('active', !sprint);
  if(sprintTab) sprintTab.classList.toggle('active', sprint);
  if(newTitle) newTitle.textContent = sprint ? 'New Vibe Coding Initiative' : 'New Project';
  if(createBtn) createBtn.textContent = sprint ? 'Create Initiative' : 'Create Project';
  if(sprintFields) sprintFields.style.display = sprint ? 'block' : 'none';
  if(sprintBoard) sprintBoard.style.display = 'none';
  if(typeof updateVibeShell === 'function') updateVibeShell();
}

function updateProjectViewCounts(){
  var mainCount = document.getElementById('view-main-count');
  var sprintCount = document.getElementById('view-sprint-count');
  if(mainCount) mainCount.textContent = Object.keys(App.mainTickets || {}).length;
  if(sprintCount) sprintCount.textContent = Object.keys(App.sprintTickets || {}).length;
}

function resetFiltersForView(){
  App.currentFilter = 'active';
  App.currentPriorityFilter = 'all';
  App.currentContrib = 'all';
  document.querySelectorAll('.nav-item').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.filter-pill').forEach(function(b){ b.classList.remove('active'); });
  var navActive = document.getElementById('nav-active');
  var pillActive = document.getElementById('pill-active');
  var cpillAll = document.getElementById('cpill-all');
  if(navActive) navActive.classList.add('active');
  if(pillActive) pillActive.classList.add('active');
  if(cpillAll) cpillAll.classList.add('active');
}

function refreshActiveTickets(){
  App.ticketsRef = currentTicketsRef();
  App.allTickets = currentTickets();
  updateAppShell();
  updateProjectViewCounts();
  if(typeof updateStats === 'function') updateStats();
  if(typeof renderList === 'function') renderList();
  if(typeof updateCounts === 'function') updateCounts();
  if(typeof updateWarnings === 'function') updateWarnings();
  if(typeof renderWorkload === 'function') renderWorkload();
  if(typeof renderContribPills === 'function') renderContribPills();
  if(typeof renderActivityList === 'function') renderActivityList();
  if(App.selectedTicketId && document.getElementById('detail-modal').style.display !== 'none'){
    var t = App.allTickets[App.selectedTicketId];
    if(t){
      if(typeof setDetailStatusOptions === 'function') setDetailStatusOptions(t.status);
      else document.getElementById('d-status-sel').value = t.status;
      document.getElementById('d-priority-sel').value = t.priority || 'p1';
      document.getElementById('d-deadline-inp').value = t.deadline || '';
      renderDeadlineStatus(t.deadline, t.status);
      populateSprintDetail(t);
      if(typeof updateDetailLayoutForView === 'function') updateDetailLayoutForView();
      renderSubtasks(App.selectedTicketId);
      if(!isSprintView()) renderLinks(App.selectedTicketId);
      renderComments(App.selectedTicketId);
    } else {
      closeDetailModal();
    }
  }
}

window.setProjectView = function(view){
  if(view !== 'main' && view !== 'sprint') return;
  if(App.currentProjectView === view) return;
  App.currentProjectView = view;
  if(view === 'sprint') App.currentVibeView = 'initiatives';
  App.selectedTicketId = null;
  resetFiltersForView();
  refreshActiveTickets();
};

function sprintStageLabel(stage){
  var map = {
    scoping: 'Scoping',
    validating: 'Validating',
    build_uat: 'Build/UAT',
    live_stabilizing: 'Live/Stabilizing',
    capacity_review: 'Capacity Review',
    closed: 'Closed'
  };
  return map[stage] || 'Scoping';
}

function sprintStageClass(stage){
  if(stage === 'closed') return 'stage-closed';
  if(stage === 'capacity_review') return 'stage-review';
  if(stage === 'live_stabilizing') return 'stage-live';
  if(stage === 'build_uat') return 'stage-build';
  if(stage === 'validating') return 'stage-validating';
  return 'stage-scoping';
}

function teamSortValue(team){
  var order = ['FinOps', 'Expansions', 'Claims', 'Fleet'];
  var idx = order.indexOf(team || 'Unassigned');
  return idx === -1 ? order.length : idx;
}

function compareTeams(a, b){
  return teamSortValue(a) - teamSortValue(b) || String(a || '').localeCompare(String(b || ''));
}

function defaultAutomationTeams(){
  return [
    {id:'default-finops', name:'FinOps', currentHc:104, sortOrder:1},
    {id:'default-expansions', name:'Expansions', currentHc:92, sortOrder:2},
    {id:'default-claims', name:'Claims', currentHc:48, sortOrder:3},
    {id:'default-fleet', name:'Fleet', currentHc:164, sortOrder:4},
    {id:'default-other', name:'Other', currentHc:null, sortOrder:99}
  ];
}

function defaultAutomationSubteams(){
  return [
    {id:'default-finops-agency-billing', teamName:'FinOps', name:'Agency Billing Validation'},
    {id:'default-finops-rb-calculation', teamName:'FinOps', name:'RB Calculation'},
    {id:'default-finops-agency-portal', teamName:'FinOps', name:'Agency Portal Migration'},
    {id:'default-expansions-hse', teamName:'Expansions', name:'HSE'},
    {id:'default-expansions-site-planning', teamName:'Expansions', name:'Site Planning'},
    {id:'default-claims-ssp', teamName:'Claims', name:'SSP Integration'},
    {id:'default-claims-cleo', teamName:'Claims', name:'CLEO'},
    {id:'default-fleet-ops', teamName:'Fleet', name:'Fleet Ops'}
  ];
}

function automationTeamList(){
  var byId = {};
  defaultAutomationTeams().forEach(function(team){
    byId[team.id] = Object.assign({}, team);
  });
  Object.entries(App.automationTeams || {}).forEach(function(entry){
    byId[entry[0]] = Object.assign({}, byId[entry[0]] || {}, {id: entry[0]}, entry[1]);
  });
  return Object.values(byId).sort(function(a,b){
    return compareTeams(a.name, b.name) || numVal(a.sortOrder) - numVal(b.sortOrder);
  });
}

function automationSubteamList(teamName){
  var byId = {};
  defaultAutomationSubteams().filter(function(sub){ return sub.teamName === teamName; }).forEach(function(sub){
    byId[sub.id] = Object.assign({}, sub);
  });
  Object.entries(App.automationSubteams || {}).forEach(function(entry){
    var sub = Object.assign({id: entry[0]}, entry[1]);
    if((sub.teamName || '') === teamName) byId[entry[0]] = Object.assign({}, byId[entry[0]] || {}, sub);
  });
  return Object.values(byId).sort(function(a,b){ return (a.name || '').localeCompare(b.name || ''); });
}

function automationTeamByName(teamName){
  return automationTeamList().find(function(team){ return team.name === teamName; }) || null;
}

function automationSubteamByName(teamName, subteamName){
  return automationSubteamList(teamName).find(function(subteam){ return subteam.name === subteamName; }) || null;
}

function renderTeamSelect(prefix, selected){
  var el = document.getElementById(prefix+'-team-area');
  if(!el) return;
  var teams = automationTeamList();
  var current = selected || el.value || 'FinOps';
  if(current && !teams.some(function(team){ return team.name === current; })){
    teams.push({id:'current-'+current,name:current,currentHc:null,sortOrder:999});
  }
  el.innerHTML = teams.map(function(team){
    return '<option value="'+safeText(team.name)+'">'+safeText(team.name)+'</option>';
  }).join('');
  if(teams.some(function(team){ return team.name === current; })) el.value = current;
  else if(teams.length) el.value = teams[0].name;
}

function renderSubteamSelect(prefix, selected){
  var teamEl = document.getElementById(prefix+'-team-area');
  var subEl = document.getElementById(prefix+'-subteam');
  if(!teamEl || !subEl) return;
  var subteams = automationSubteamList(teamEl.value);
  var current = selected || subEl.value || '';
  if(current && !subteams.some(function(subteam){ return subteam.name === current; })){
    subteams.push({id:'current-'+current,teamName:teamEl.value,name:current});
  }
  subEl.innerHTML = '<option value="">Unassigned subteam</option>' + subteams.map(function(subteam){
    return '<option value="'+safeText(subteam.name)+'">'+safeText(subteam.name)+'</option>';
  }).join('');
  if(subteams.some(function(subteam){ return subteam.name === current; })) subEl.value = current;
  else subEl.value = '';
}

function refreshSprintHierarchyUi(){
  renderTeamSelect('nt');
  renderSubteamSelect('nt');
  if(App.selectedTicketId && isSprintView()){
    var t = App.allTickets[App.selectedTicketId];
    if(t) populateSprintDetail(t);
  }
  renderAutomationHierarchyLists();
  renderSprintDashboard();
}

function timelineLabel(t){
  var start = t.timelineStart || '';
  var end = t.timelineEnd || t.deadline || '';
  if(start && end) return start + ' to ' + end;
  if(end) return 'Target ' + end;
  if(start) return 'From ' + start;
  return t.sprintCycle || 'TBD';
}

function sprintMetaHtml(t){
  var pieces = [];
  if(t.teamArea) pieces.push('<span class="sprint-chip">'+safeText(t.teamArea)+'</span>');
  if(t.subteam) pieces.push('<span class="sprint-chip">'+safeText(t.subteam)+'</span>');
  if(t.sprintCycle) pieces.push('<span>'+safeText(t.sprintCycle)+'</span>');
  pieces.push('<span class="stage-badge '+sprintStageClass(t.stage)+'">'+sprintStageLabel(t.stage)+'</span>');
  var timeline = timelineLabel(t);
  if(timeline !== 'TBD') pieces.push('<span>'+safeText(timeline)+'</span>');
  if(automationReviewedHc(t)) pieces.push('<span>'+fmtCapacity(automationReviewedHc(t))+' reviewed for automation</span>');
  if(automationScopedHc(t)) pieces.push('<span title="'+safeText(SCOPED_HC_HELP_TEXT)+'">'+fmtCapacity(automationScopedHc(t))+' scoped for automation</span>');
  if(automationInProgressHc(t)) pieces.push('<span>'+fmtCapacity(automationInProgressHc(t))+' in progress automation</span>');
  if(countedActualHcSavings(t) || excessCapacityHc(t)) pieces.push('<span>'+fmtCapacity(countedActualHcSavings(t))+' / '+fmtCapacity(excessCapacityHc(t))+' HC savings</span>');
  return pieces.join('<span>&middot;</span>');
}

function populateSprintDetail(t){
  var wrap = document.getElementById('d-sprint-fields');
  if(!wrap) return;
  wrap.style.display = isSprintView() ? 'block' : 'none';
  if(!isSprintView()) return;
  renderTeamSelect('d', t.teamArea || 'FinOps');
  renderSubteamSelect('d', t.subteam || '');
  document.getElementById('d-sprint-cycle').value = t.sprintCycle || '';
  document.getElementById('d-timeline-start').value = t.timelineStart || '';
  document.getElementById('d-timeline-end').value = t.timelineEnd || '';
  document.getElementById('d-stage').value = t.stage || 'scoping';
  document.getElementById('d-confidence').value = t.confidence || 'medium';
  document.getElementById('d-team-size-hc').value = fmtCapacity(hierarchySizeHc(t.teamArea || 'Unassigned', t.subteam || ''));
  document.getElementById('d-automation-reviewed-hc').value = t.automationReviewedHc == null ? (t.reviewedHc == null ? '' : t.reviewedHc) : t.automationReviewedHc;
  document.getElementById('d-automation-scoped-hc').value = t.automationScopedHc == null ? (t.scopedHc == null ? '' : t.scopedHc) : t.automationScopedHc;
  document.getElementById('d-actual-hc-savings').value = t.actualHcSavings == null ? ((t.fteRepurpose == null && t.bpoNfteReduction == null) ? '' : actualHcSavings(t)) : t.actualHcSavings;
  document.getElementById('d-excess-capacity-hc').value = t.excessCapacityHc == null ? (t.fteBuffer == null ? '' : t.fteBuffer) : t.excessCapacityHc;
}

function updateLocalSelectedTicket(upd){
  var t = App.allTickets[App.selectedTicketId];
  if(!t) return;
  Object.keys(upd).forEach(function(k){ t[k] = upd[k]; });
  populateSprintDetail(t);
  renderList();
  renderSprintDashboard();
}

window.updateSprintTeamSelection = function(){
  if(!App.selectedTicketId) return;
  var teamEl = document.getElementById('d-team-area');
  var teamName = teamEl ? teamEl.value : 'Unassigned';
  renderSubteamSelect('d');
  var subEl = document.getElementById('d-subteam');
  var subteamName = subEl && subEl.value ? subEl.value : null;
  var upd = {teamArea: teamName || 'Unassigned', subteam: subteamName};
  activeTicketRef(App.selectedTicketId).update(upd);
  updateLocalSelectedTicket(upd);
};

window.updateSprintSubteamSelection = function(){
  if(!App.selectedTicketId) return;
  var subEl = document.getElementById('d-subteam');
  var upd = {subteam: subEl && subEl.value ? subEl.value : null};
  activeTicketRef(App.selectedTicketId).update(upd);
  updateLocalSelectedTicket(upd);
};

function groupSprintInitiatives(entries){
  var grouped = {};
  entries.forEach(function(entry){
    var t = entry.t;
    var team = t.teamArea || 'Unassigned';
    var subteam = t.subteam || 'Unassigned subteam';
    if(!grouped[team]) grouped[team] = {items:[], subteams:{}};
    if(!grouped[team].subteams[subteam]) grouped[team].subteams[subteam] = {items:[]};
    grouped[team].items.push(t);
    grouped[team].subteams[subteam].items.push(entry);
  });
  return grouped;
}

function firstNextAction(items){
  var found = items.find(function(t){ return t.nextAction; });
  return found ? safeText(found.nextAction) : 'TBD';
}

function firstTimeline(items){
  var found = items.find(function(item){
    var t = item.t || item;
    return t.timelineStart || t.timelineEnd || t.deadline || t.sprintCycle;
  });
  return found ? safeText(timelineLabel(found.t || found)) : 'TBD';
}

function initiativeLinksHtml(items){
  return items.slice(0, 4).map(function(item){
    return '<button class="initiative-link" onclick="event.stopPropagation();openDetailModal(\''+item.id+'\')" type="button">'+safeText(item.t.title || 'Untitled initiative')+'</button>';
  }).join('') + (items.length > 4 ? '<span class="initiative-more">+'+(items.length - 4)+' more</span>' : '');
}

function renderSprintDashboard(){
  var el = document.getElementById('sprint-team-summary');
  if(!el || !isSprintView()) return;
  var entries = Object.entries(App.allTickets || {}).map(function(entry){ return {id: entry[0], t: entry[1]}; });
  if(!entries.length){
    el.innerHTML = '<div class="empty-inline">No Vibe Coding initiatives yet.</div>';
    return;
  }
  var grouped = groupSprintInitiatives(entries);
  var rows = [];
  Object.keys(grouped).sort(compareTeams).forEach(function(team){
    var teamGroup = grouped[team];
    var teamTotals = automationTotals(teamGroup.items);
    rows.push('<tr class="hier-team-row">'
      +'<td>'+safeText(team)+'</td>'
      +'<td>All subteams</td>'
      +'<td>'+teamGroup.items.length+'</td>'
      +'<td>'+firstTimeline(teamGroup.items)+'</td>'
      +'<td>'+fmtCapacity(teamSizeHc(team))+'</td>'
      +'<td>'+fmtCapacity(teamTotals.reviewed)+'</td>'
      +'<td>'+fmtCapacity(teamTotals.scoped)+'</td>'
      +'<td>'+fmtCapacity(teamTotals.progress)+'</td>'
      +'<td>'+fmtCapacity(teamTotals.actual)+' / '+fmtCapacity(teamTotals.excess)+'</td>'
      +'</tr>');
    Object.keys(teamGroup.subteams).sort().forEach(function(subteam){
      var subGroup = teamGroup.subteams[subteam];
      var subItems = subGroup.items.map(function(item){ return item.t; });
      var subTotals = automationTotals(subItems);
      rows.push('<tr class="hier-subteam-row">'
        +'<td></td>'
        +'<td>'+safeText(subteam)+'</td>'
        +'<td><div class="initiative-links">'+initiativeLinksHtml(subGroup.items)+'</div></td>'
        +'<td>'+firstTimeline(subGroup.items)+'</td>'
        +'<td>'+fmtCapacity(subteamSizeHc(team, subteam))+'</td>'
        +'<td>'+fmtCapacity(subTotals.reviewed)+'</td>'
        +'<td>'+fmtCapacity(subTotals.scoped)+'</td>'
        +'<td>'+fmtCapacity(subTotals.progress)+'</td>'
        +'<td>'+fmtCapacity(subTotals.actual)+' / '+fmtCapacity(subTotals.excess)+'</td>'
        +'</tr>');
    });
  });
  el.innerHTML = '<table class="sprint-summary-table"><thead><tr>'
    +'<th>Team</th><th>Subteam</th><th>Initiatives</th><th>Timeline</th><th>Team/subteam size</th><th>Reviewed for automation</th><th><span class="table-heading-with-tip">Scoped for automation '+infoTipHtml(SCOPED_HC_HELP_TEXT)+'</span></th><th>In progress automation</th><th>HC savings actual / excess</th>'
    +'</tr></thead><tbody>'+rows.join('')+'</tbody></table>';
}

window.openHierarchyModal = function(){
  var teams = automationTeamList();
  if(!App.hierarchySelectedTeam && teams.length) App.hierarchySelectedTeam = teams[0].name;
  renderAutomationHierarchyLists();
  var modal = document.getElementById('hierarchy-modal');
  if(modal) modal.style.display = 'flex';
};

window.closeHierarchyModal = function(){
  var modal = document.getElementById('hierarchy-modal');
  if(modal) modal.style.display = 'none';
};

window.selectAutomationTeam = function(teamName){
  App.hierarchySelectedTeam = teamName;
  renderAutomationHierarchyLists();
};

function renderAutomationHierarchyLists(){
  var teamEl = document.getElementById('automation-team-list');
  var subteamEl = document.getElementById('automation-subteam-list');
  if(!teamEl || !subteamEl) return;
  var teams = automationTeamList();
  if(!App.hierarchySelectedTeam && teams.length) App.hierarchySelectedTeam = teams[0].name;
  teamEl.innerHTML = teams.map(function(team){
    var active = team.name === App.hierarchySelectedTeam;
    var size = teamSizeFieldValue(team.name);
    return '<div class="hierarchy-row hierarchy-edit-row'+(active?' active':'')+'">'
      +'<button class="hierarchy-name-btn" onclick="selectAutomationTeam(\''+safeText(jsDataArg(team.name))+'\')" type="button">'+safeText(team.name)+'</button>'
      +'<input class="hierarchy-size-input" type="number" min="0" step="0.1" value="'+(size != null ? safeText(fmtCapacity(size)) : '')+'" placeholder="Team size" onchange="updateAutomationTeamSize(\''+safeText(jsDataArg(team.id))+'\',this.value)" />'
      +'</div>';
  }).join('');
  var subteams = automationSubteamList(App.hierarchySelectedTeam || '');
  if(!subteams.length){
    subteamEl.innerHTML = '<div class="empty-inline">No subteams yet.</div>';
    return;
  }
  subteamEl.innerHTML = subteams.map(function(subteam){
    var size = subteamSizeFieldValue(subteam.teamName || App.hierarchySelectedTeam || '', subteam.name);
    return '<div class="hierarchy-row static hierarchy-edit-row">'
      +'<span class="hierarchy-name-text">'+safeText(subteam.name)+'</span>'
      +'<input class="hierarchy-size-input" type="number" min="0" step="0.1" value="'+(size != null ? safeText(fmtCapacity(size)) : '')+'" placeholder="Subteam size" onchange="updateAutomationSubteamSize(\''+safeText(jsDataArg(subteam.id))+'\',this.value)" />'
      +(subteam.id && !String(subteam.id).startsWith('default-') ? '<button class="btn-icon hierarchy-delete" onclick="deleteAutomationSubteam(\''+safeText(jsDataArg(subteam.id))+'\',\''+safeText(jsDataArg(subteam.name))+'\',\''+safeText(jsDataArg(subteam.teamName || App.hierarchySelectedTeam || ''))+'\')" title="Delete subteam" type="button">x</button>' : '')
      +'</div>';
  }).join('');
}

function cleanHierarchyCapacity(value){
  if(value == null || value === '') return null;
  var n = parseFloat(value);
  return isNaN(n) ? null : n;
}

function cleanHierarchyName(value){
  return String(value || '').trim();
}

function hierarchyRecordId(prefix, name){
  var slug = cleanHierarchyName(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return prefix + '-' + (slug || Date.now());
}

function hierarchyEditSizeValue(value){
  var n = cleanHierarchyCapacity(value);
  return n == null ? '' : fmtCapacity(n);
}

function setHierarchyEditLabels(mode){
  var teamMode = mode === 'team';
  document.getElementById('hierarchy-edit-title').textContent = teamMode ? 'Edit team' : 'Edit subteam';
  document.getElementById('hierarchy-edit-name-label').textContent = teamMode ? 'Team name' : 'Subteam name';
  document.getElementById('hierarchy-edit-size-label').textContent = teamMode ? 'Team size' : 'Subteam size';
}

window.openHierarchyEditModal = function(mode, teamName, subteamName){
  if(!isSprintView()) return;
  var target = null;
  if(mode === 'team'){
    var team = automationTeamByName(teamName) || {id: hierarchyRecordId('team', teamName), name: teamName, sortOrder: Date.now()};
    target = {type:'team', id:team.id, originalName:team.name, sortOrder:team.sortOrder};
    document.getElementById('hierarchy-edit-name').value = team.name || '';
    document.getElementById('hierarchy-edit-size').value = hierarchyEditSizeValue(teamSizeFieldValue(team.name));
    document.getElementById('hierarchy-edit-context').style.display = 'none';
  } else {
    var subteam = automationSubteamByName(teamName, subteamName) || {id: hierarchyRecordId('subteam', teamName + '-' + subteamName), teamName: teamName, name: subteamName, sortOrder: Date.now()};
    target = {type:'subteam', id:subteam.id, teamName:teamName, originalName:subteam.name, sortOrder:subteam.sortOrder};
    document.getElementById('hierarchy-edit-name').value = subteam.name || '';
    document.getElementById('hierarchy-edit-size').value = hierarchyEditSizeValue(subteamSizeFieldValue(teamName, subteam.name));
    var context = document.getElementById('hierarchy-edit-context');
    context.textContent = 'Team: ' + teamName;
    context.style.display = 'block';
  }
  App.hierarchyEditTarget = target;
  setHierarchyEditLabels(target.type);
  var modal = document.getElementById('hierarchy-edit-modal');
  if(modal) modal.style.display = 'flex';
  setTimeout(function(){
    var input = document.getElementById('hierarchy-edit-name');
    if(input){ input.focus(); input.select(); }
  }, 80);
};

window.closeHierarchyEditModal = function(){
  App.hierarchyEditTarget = null;
  var modal = document.getElementById('hierarchy-edit-modal');
  if(modal) modal.style.display = 'none';
};

function duplicateTeamName(newName, currentId){
  return automationTeamList().some(function(team){
    return team.id !== currentId && team.name.toLowerCase() === newName.toLowerCase();
  });
}

function duplicateSubteamName(teamName, newName, currentId){
  return automationSubteamList(teamName).some(function(subteam){
    return subteam.id !== currentId && subteam.name.toLowerCase() === newName.toLowerCase();
  });
}

function updateLocalHierarchyFromEdit(target, newName, size){
  if(target.type === 'team'){
    var oldName = target.originalName;
    var existingTeam = App.automationTeams[target.id] || automationTeamByName(oldName) || {};
    App.automationTeams[target.id] = Object.assign({}, existingTeam, {
      name:newName,
      sortOrder: target.sortOrder != null ? target.sortOrder : existingTeam.sortOrder,
      teamSizeHc:size,
      currentHc:size
    });
    Object.keys(App.automationSubteams || {}).forEach(function(id){
      if((App.automationSubteams[id].teamName || '') === oldName) App.automationSubteams[id].teamName = newName;
    });
    defaultAutomationSubteams().filter(function(sub){ return sub.teamName === oldName; }).forEach(function(sub){
      App.automationSubteams[sub.id] = Object.assign({}, App.automationSubteams[sub.id] || sub, {teamName:newName});
    });
    Object.values(App.sprintTickets || {}).forEach(function(t){
      if((t.teamArea || '') === oldName) t.teamArea = newName;
    });
    if(App.hierarchySelectedTeam === oldName) App.hierarchySelectedTeam = newName;
  } else {
    var oldSubteam = target.originalName;
    var existingSubteam = App.automationSubteams[target.id] || automationSubteamByName(target.teamName, oldSubteam) || {};
    App.automationSubteams[target.id] = Object.assign({}, existingSubteam, {
      teamName: target.teamName,
      name:newName,
      sortOrder: target.sortOrder != null ? target.sortOrder : existingSubteam.sortOrder,
      subteamSizeHc:size
    });
    Object.values(App.sprintTickets || {}).forEach(function(t){
      if((t.teamArea || '') === target.teamName && (t.subteam || '') === oldSubteam) t.subteam = newName;
    });
  }
  App.allTickets = currentTickets();
}

window.saveHierarchyEdit = function(){
  var target = App.hierarchyEditTarget;
  if(!target) return;
  var newName = cleanHierarchyName(document.getElementById('hierarchy-edit-name').value);
  if(!newName){
    document.getElementById('hierarchy-edit-name').focus();
    return;
  }
  var size = cleanHierarchyCapacity(document.getElementById('hierarchy-edit-size').value);
  if(target.type === 'team' && duplicateTeamName(newName, target.id)){
    alert('A team with this name already exists.');
    return;
  }
  if(target.type === 'subteam' && duplicateSubteamName(target.teamName, newName, target.id)){
    alert('A subteam with this name already exists under this team.');
    return;
  }

  var updates = {};
  if(target.type === 'team'){
    updates['automationTeams/'+target.id+'/name'] = newName;
    updates['automationTeams/'+target.id+'/sortOrder'] = target.sortOrder != null ? target.sortOrder : Date.now();
    updates['automationTeams/'+target.id+'/teamSizeHc'] = size;
    updates['automationTeams/'+target.id+'/currentHc'] = size;
    Object.entries(App.sprintTickets || {}).forEach(function(entry){
      if((entry[1].teamArea || '') === target.originalName) updates['sprintProjects/'+entry[0]+'/teamArea'] = newName;
    });
    automationSubteamList(target.originalName).forEach(function(subteam){
      updates['automationSubteams/'+subteam.id+'/teamName'] = newName;
      updates['automationSubteams/'+subteam.id+'/name'] = subteam.name;
      updates['automationSubteams/'+subteam.id+'/sortOrder'] = subteam.sortOrder != null ? subteam.sortOrder : Date.now();
      if(subteam.subteamSizeHc != null) updates['automationSubteams/'+subteam.id+'/subteamSizeHc'] = subteam.subteamSizeHc;
      if(subteam.currentHc != null) updates['automationSubteams/'+subteam.id+'/currentHc'] = subteam.currentHc;
    });
  } else {
    updates['automationSubteams/'+target.id+'/teamName'] = target.teamName;
    updates['automationSubteams/'+target.id+'/name'] = newName;
    updates['automationSubteams/'+target.id+'/sortOrder'] = target.sortOrder != null ? target.sortOrder : Date.now();
    updates['automationSubteams/'+target.id+'/subteamSizeHc'] = size;
    Object.entries(App.sprintTickets || {}).forEach(function(entry){
      var t = entry[1];
      if((t.teamArea || '') === target.teamName && (t.subteam || '') === target.originalName) updates['sprintProjects/'+entry[0]+'/subteam'] = newName;
    });
  }
  App.db.ref().update(updates);
  updateLocalHierarchyFromEdit(target, newName, size);
  closeHierarchyEditModal();
  refreshSprintHierarchyUi();
  if(typeof updateStats === 'function') updateStats();
  if(typeof renderList === 'function') renderList();
};

window.updateAutomationTeamSize = function(id, value){
  if(!id || !App.automationTeamsRef) return;
  var team = automationTeamList().find(function(item){ return item.id === id; }) || {};
  var size = cleanHierarchyCapacity(value);
  var upd = {
    name: team.name || 'Untitled team',
    sortOrder: team.sortOrder != null ? team.sortOrder : Date.now(),
    teamSizeHc: size,
    currentHc: size
  };
  App.automationTeamsRef.child(id).update(upd);
  App.automationTeams[id] = Object.assign({}, team, upd);
  refreshSprintHierarchyUi();
};

window.updateAutomationSubteamSize = function(id, value){
  if(!id || !App.automationSubteamsRef) return;
  var teamName = App.hierarchySelectedTeam || '';
  var subteam = automationSubteamList(teamName).find(function(item){ return item.id === id; }) || {};
  var size = cleanHierarchyCapacity(value);
  var upd = {
    teamName: subteam.teamName || teamName,
    name: subteam.name || 'Untitled subteam',
    sortOrder: subteam.sortOrder != null ? subteam.sortOrder : Date.now(),
    subteamSizeHc: size
  };
  App.automationSubteamsRef.child(id).update(upd);
  App.automationSubteams[id] = Object.assign({}, subteam, upd);
  refreshSprintHierarchyUi();
};

window.addAutomationTeam = function(){
  var input = document.getElementById('automation-team-name');
  var sizeInput = document.getElementById('automation-team-size');
  var name = input ? input.value.trim() : '';
  if(!name) return;
  var exists = automationTeamList().some(function(team){ return team.name.toLowerCase() === name.toLowerCase(); });
  if(exists){ input.value=''; return; }
  var size = cleanHierarchyCapacity(sizeInput ? sizeInput.value : '');
  App.automationTeamsRef.push({name:name,teamSizeHc:size,currentHc:size,sortOrder:Date.now(),createdTs:Date.now(),createdBy:App.currentUser||'Unknown'});
  App.hierarchySelectedTeam = name;
  input.value = '';
  if(sizeInput) sizeInput.value = '';
};

window.addAutomationSubteam = function(){
  var input = document.getElementById('automation-subteam-name');
  var sizeInput = document.getElementById('automation-subteam-size');
  var name = input ? input.value.trim() : '';
  var teamName = App.hierarchySelectedTeam || (automationTeamList()[0] && automationTeamList()[0].name);
  if(!name || !teamName) return;
  var exists = automationSubteamList(teamName).some(function(sub){ return sub.name.toLowerCase() === name.toLowerCase(); });
  if(exists){ input.value=''; return; }
  var size = cleanHierarchyCapacity(sizeInput ? sizeInput.value : '');
  App.automationSubteamsRef.push({teamName:teamName,name:name,subteamSizeHc:size,sortOrder:Date.now(),createdTs:Date.now(),createdBy:App.currentUser||'Unknown'});
  input.value = '';
  if(sizeInput) sizeInput.value = '';
};

window.deleteAutomationSubteam = function(id, name, teamName){
  if(!id || !name) return;
  var impacted = Object.entries(App.sprintTickets || {}).filter(function(entry){
    var t = entry[1];
    return (t.teamArea || '') === teamName && (t.subteam || '') === name;
  });
  var message = 'Delete subteam "'+name+'"?';
  if(impacted.length){
    message += '\n\nThis will also clear the subteam on '+impacted.length+' initiative'+(impacted.length!==1?'s':'')+' so it no longer appears in the hierarchy.';
  }
  if(!confirm(message)) return;
  var updates = {};
  impacted.forEach(function(entry){
    updates['sprintProjects/'+entry[0]+'/subteam'] = null;
  });
  updates['automationSubteams/'+id] = null;
  App.db.ref().update(updates);
};
