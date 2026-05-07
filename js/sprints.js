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
  if(team) team.value = 'FinOps';
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
  if(title) title.textContent = sprint ? 'Sprint Projects' : 'Main Projects';
  if(sub) sub.textContent = Object.keys(App.allTickets).length + (sprint ? ' sprint initiative' : ' project') + (Object.keys(App.allTickets).length !== 1 ? 's' : '') + ' total';
  if(newBtn) newBtn.textContent = sprint ? '+ New Sprint Project' : '+ New Project';
  if(search) search.placeholder = sprint ? 'Search initiatives, teams, subteams, or next actions...' : 'Search main projects...';
  if(mainTab) mainTab.classList.toggle('active', !sprint);
  if(sprintTab) sprintTab.classList.toggle('active', sprint);
  if(newTitle) newTitle.textContent = sprint ? 'New Sprint Project' : 'New Project';
  if(createBtn) createBtn.textContent = sprint ? 'Create Sprint Project' : 'Create Project';
  if(sprintFields) sprintFields.style.display = sprint ? 'block' : 'none';
  if(sprintBoard) sprintBoard.style.display = sprint ? 'block' : 'none';
}

function updateProjectViewCounts(){
  var mainCount = document.getElementById('view-main-count');
  var sprintCount = document.getElementById('view-sprint-count');
  if(mainCount) mainCount.textContent = Object.keys(App.mainTickets || {}).length;
  if(sprintCount) sprintCount.textContent = Object.keys(App.sprintTickets || {}).length;
}

function resetFiltersForView(){
  App.currentFilter = 'all';
  App.currentPriorityFilter = 'all';
  App.currentContrib = 'all';
  document.querySelectorAll('.nav-item').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.filter-pill').forEach(function(b){ b.classList.remove('active'); });
  var navAll = document.getElementById('nav-all');
  var pillAll = document.getElementById('pill-all');
  var cpillAll = document.getElementById('cpill-all');
  if(navAll) navAll.classList.add('active');
  if(pillAll) pillAll.classList.add('active');
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
  if(numVal(t.scopedHc)) pieces.push('<span>'+fmtCapacity(t.scopedHc)+' HC scoped</span>');
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
  document.getElementById('d-team-area').value = t.teamArea || 'FinOps';
  document.getElementById('d-subteam').value = t.subteam || '';
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
    +'<th>Team</th><th>Subteam</th><th>Initiatives</th><th>Timeline</th><th>Scoped HC</th><th>Repurpose</th><th>Buffer</th><th>BPO/NFTE Reduction</th><th>Unclassified</th><th>Next Action</th>'
    +'</tr></thead><tbody>'+rows.join('')+'</tbody></table>';
}
