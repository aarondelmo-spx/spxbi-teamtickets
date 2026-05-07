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
    nextAction: cleanTextField('nt-next-action'),
    scopedHc: cleanNumField('nt-scoped-hc'),
    fteRepurpose: cleanNumField('nt-fte-repurpose'),
    fteBuffer: cleanNumField('nt-fte-buffer'),
    bpoNfteReduction: cleanNumField('nt-bpo-reduction')
  };
}

function clearSprintNewFields(){
  [
    'nt-subteam',
    'nt-sprint-cycle',
    'nt-timeline-start',
    'nt-timeline-end',
    'nt-next-action',
    'nt-scoped-hc',
    'nt-fte-repurpose',
    'nt-fte-buffer',
    'nt-bpo-reduction'
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
  if(search) search.placeholder = sprint ? 'Search initiatives, workstreams, tasks, teams...' : 'Search main projects...';
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
      document.getElementById('d-status-sel').value = t.status;
      document.getElementById('d-priority-sel').value = t.priority || 'p1';
      document.getElementById('d-deadline-inp').value = t.deadline || '';
      renderDeadlineStatus(t.deadline, t.status);
      populateSprintDetail(t);
      if(typeof updateDetailLayoutForView === 'function') updateDetailLayoutForView();
      renderSubtasks(App.selectedTicketId);
      renderLinks(App.selectedTicketId);
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
  var teams = Object.entries(App.automationTeams || {}).map(function(entry){
    return Object.assign({id: entry[0]}, entry[1]);
  });
  if(!teams.length) teams = defaultAutomationTeams();
  return teams.sort(function(a,b){
    return compareTeams(a.name, b.name) || numVal(a.sortOrder) - numVal(b.sortOrder);
  });
}

function automationSubteamList(teamName){
  var subteams = Object.entries(App.automationSubteams || {}).map(function(entry){
    return Object.assign({id: entry[0]}, entry[1]);
  }).filter(function(sub){
    return (sub.teamName || '') === teamName;
  });
  if(!subteams.length){
    subteams = defaultAutomationSubteams().filter(function(sub){ return sub.teamName === teamName; });
  }
  return subteams.sort(function(a,b){ return (a.name || '').localeCompare(b.name || ''); });
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
  if(numVal(t.scopedHc)) pieces.push('<span title="'+safeText(SCOPED_HC_HELP_TEXT)+'">'+fmtCapacity(t.scopedHc)+' HC scoped</span>');
  if(numVal(t.fteRepurpose)) pieces.push('<span>'+fmtCapacity(t.fteRepurpose)+' repurpose</span>');
  if(numVal(t.fteBuffer)) pieces.push('<span>'+fmtCapacity(t.fteBuffer)+' buffer</span>');
  if(numVal(t.bpoNfteReduction)) pieces.push('<span>'+fmtCapacity(t.bpoNfteReduction)+' reduction</span>');
  if(unclassifiedCapacity(t)) pieces.push('<span>'+fmtCapacity(unclassifiedCapacity(t))+' unclassified</span>');
  if(t.nextAction) pieces.push('<span>Next: '+safeText(t.nextAction)+'</span>');
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
  document.getElementById('d-next-action').value = t.nextAction || '';
  document.getElementById('d-scoped-hc').value = t.scopedHc == null ? '' : t.scopedHc;
  document.getElementById('d-fte-repurpose').value = t.fteRepurpose == null ? '' : t.fteRepurpose;
  document.getElementById('d-fte-buffer').value = t.fteBuffer == null ? '' : t.fteBuffer;
  document.getElementById('d-bpo-reduction').value = t.bpoNfteReduction == null ? '' : t.bpoNfteReduction;
  document.getElementById('d-unclassified').value = fmtCapacity(unclassifiedCapacity(t));
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
    el.innerHTML = '<div class="empty-inline">No sprint initiatives yet.</div>';
    return;
  }
  var grouped = groupSprintInitiatives(entries);
  var rows = [];
  Object.keys(grouped).sort(compareTeams).forEach(function(team){
    var teamGroup = grouped[team];
    var teamTotals = sprintTotals(teamGroup.items);
    rows.push('<tr class="hier-team-row">'
      +'<td>'+safeText(team)+'</td>'
      +'<td>All subteams</td>'
      +'<td>'+teamGroup.items.length+'</td>'
      +'<td>'+firstTimeline(teamGroup.items)+'</td>'
      +'<td>'+fmtCapacity(teamTotals.scoped)+'</td>'
      +'<td>'+fmtCapacity(teamTotals.repurpose)+'</td>'
      +'<td>'+fmtCapacity(teamTotals.buffer)+'</td>'
      +'<td>'+fmtCapacity(teamTotals.reduction)+'</td>'
      +'<td>'+fmtCapacity(teamTotals.unclassified)+'</td>'
      +'<td>'+firstNextAction(teamGroup.items)+'</td>'
      +'</tr>');
    Object.keys(teamGroup.subteams).sort().forEach(function(subteam){
      var subGroup = teamGroup.subteams[subteam];
      var subItems = subGroup.items.map(function(item){ return item.t; });
      var subTotals = sprintTotals(subItems);
      rows.push('<tr class="hier-subteam-row">'
        +'<td></td>'
        +'<td>'+safeText(subteam)+'</td>'
        +'<td><div class="initiative-links">'+initiativeLinksHtml(subGroup.items)+'</div></td>'
        +'<td>'+firstTimeline(subGroup.items)+'</td>'
        +'<td>'+fmtCapacity(subTotals.scoped)+'</td>'
        +'<td>'+fmtCapacity(subTotals.repurpose)+'</td>'
        +'<td>'+fmtCapacity(subTotals.buffer)+'</td>'
        +'<td>'+fmtCapacity(subTotals.reduction)+'</td>'
        +'<td>'+fmtCapacity(subTotals.unclassified)+'</td>'
        +'<td>'+firstNextAction(subItems)+'</td>'
        +'</tr>');
    });
  });
  el.innerHTML = '<table class="sprint-summary-table"><thead><tr>'
    +'<th>Team</th><th>Subteam</th><th>Initiatives</th><th>Timeline</th><th><span class="table-heading-with-tip">Scoped HC '+infoTipHtml(SCOPED_HC_HELP_TEXT)+'</span></th><th>Repurpose</th><th>Buffer</th><th>BPO/NFTE Reduction</th><th>Unclassified</th><th>Next Action</th>'
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
    return '<button class="hierarchy-row'+(active?' active':'')+'" onclick="selectAutomationTeam(\''+safeText(team.name)+'\')" type="button">'
      +'<span>'+safeText(team.name)+'</span>'
      +(team.currentHc != null ? '<span class="hierarchy-meta">'+fmtCapacity(team.currentHc)+' HC</span>' : '')
      +'</button>';
  }).join('');
  var subteams = automationSubteamList(App.hierarchySelectedTeam || '');
  if(!subteams.length){
    subteamEl.innerHTML = '<div class="empty-inline">No subteams yet.</div>';
    return;
  }
  subteamEl.innerHTML = subteams.map(function(subteam){
    return '<div class="hierarchy-row static">'
      +'<span>'+safeText(subteam.name)+'</span>'
      +(subteam.id && !String(subteam.id).startsWith('default-') ? '<button class="btn-icon hierarchy-delete" onclick="deleteAutomationSubteam(\''+safeText(subteam.id)+'\',\''+safeText(subteam.name)+'\',\''+safeText(subteam.teamName || App.hierarchySelectedTeam || '')+'\')" title="Delete subteam" type="button">×</button>' : '')
      +'</div>';
  }).join('');
}

window.addAutomationTeam = function(){
  var input = document.getElementById('automation-team-name');
  var name = input ? input.value.trim() : '';
  if(!name) return;
  var exists = automationTeamList().some(function(team){ return team.name.toLowerCase() === name.toLowerCase(); });
  if(exists){ input.value=''; return; }
  App.automationTeamsRef.push({name:name,currentHc:null,sortOrder:Date.now(),createdTs:Date.now(),createdBy:App.currentUser||'Unknown'});
  App.hierarchySelectedTeam = name;
  input.value = '';
};

window.addAutomationSubteam = function(){
  var input = document.getElementById('automation-subteam-name');
  var name = input ? input.value.trim() : '';
  var teamName = App.hierarchySelectedTeam || (automationTeamList()[0] && automationTeamList()[0].name);
  if(!name || !teamName) return;
  var exists = automationSubteamList(teamName).some(function(sub){ return sub.name.toLowerCase() === name.toLowerCase(); });
  if(exists){ input.value=''; return; }
  App.automationSubteamsRef.push({teamName:teamName,name:name,sortOrder:Date.now(),createdTs:Date.now(),createdBy:App.currentUser||'Unknown'});
  input.value = '';
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
