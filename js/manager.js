function openManagerView(){
  window.location.href = window.location.pathname + '?view=manager';
}

function exitManagerView(){
  window.location.href = window.location.pathname;
}

function showManagerView(){
  document.querySelector('.app').classList.add('app--manager-mode');

  document.querySelector('.main').innerHTML =
    '<div class="manager-view" id="manager-view">'
    + '<div class="manager-header">'
    +   '<div><div class="page-title">Manager View</div><div class="page-sub" id="manager-sub">Loading...</div></div>'
    +   '<button class="manager-back" onclick="exitManagerView()">&#8592; Doer mode</button>'
    + '</div>'
    + '<div class="manager-stats" id="manager-stats-row">'
    +   '<div class="manager-stat"><div class="manager-stat-label">BPO/NFTE Reduction</div><div class="manager-stat-num c-done" id="mgr-reduction">—</div></div>'
    +   '<div class="manager-stat"><div class="manager-stat-label">Open</div><div class="manager-stat-num c-high" id="mgr-open">—</div></div>'
    +   '<div class="manager-stat"><div class="manager-stat-label">Overdue</div><div class="manager-stat-num c-high" id="mgr-overdue">—</div></div>'
    +   '<div class="manager-stat"><div class="manager-stat-label">P0 Critical</div><div class="manager-stat-num c-high" id="mgr-p0">—</div></div>'
    + '</div>'
    + '<div class="manager-section"><div class="manager-section-title">Red Flags</div><div id="manager-flags"><div class="loading">Loading...</div></div></div>'
    + '<div class="manager-section"><div class="manager-section-title">Progress by Area</div><div id="manager-progress"><div class="loading">Loading...</div></div></div>'
    + '<div class="manager-ts" id="manager-ts"></div>'
    + '</div>';

  App.mainTicketsRef.on('value', function(snap){
    var data = snap.val() || {};
    App.mainTickets = {};
    Object.keys(data).forEach(function(k){ App.mainTickets[k] = data[k]; App.mainTickets[k].id = k; });
    renderManagerView();
  });

  App.sprintTicketsRef.on('value', function(snap){
    var data = snap.val() || {};
    App.sprintTickets = {};
    Object.keys(data).forEach(function(k){ App.sprintTickets[k] = data[k]; App.sprintTickets[k].id = k; });
    renderManagerView();
  });
}

function renderManagerView(){
  var mainArr = Object.values(App.mainTickets);
  var sprintArr = Object.values(App.sprintTickets);

  // Stat cards
  var reduction = sprintArr.reduce(function(a, t){ return a + numVal(t.bpoNfteReduction); }, 0);
  var openCount = mainArr.filter(function(t){ return t.status === 'open'; }).length;
  var overdueCount = mainArr.filter(function(t){
    if(t.status === 'done' || !t.deadline) return false;
    var d = deadlineDiff(t.deadline);
    return d !== null && d < 0;
  }).length;
  var p0Count = mainArr.filter(function(t){ return t.priority === 'p0' && t.status !== 'done'; }).length;

  var redEl = document.getElementById('mgr-reduction');
  var opEl  = document.getElementById('mgr-open');
  var ovEl  = document.getElementById('mgr-overdue');
  var p0El  = document.getElementById('mgr-p0');
  if(redEl) redEl.textContent = fmtCapacity(reduction);
  if(opEl)  opEl.textContent  = openCount;
  if(ovEl)  ovEl.textContent  = overdueCount;
  if(p0El)  p0El.textContent  = p0Count;

  // Sub-header
  var subEl = document.getElementById('manager-sub');
  if(subEl) subEl.textContent = mainArr.length + ' main · ' + sprintArr.length + ' vibe coding';

  // Red flags
  var flags = [];
  mainArr.forEach(function(t){
    if(t.status === 'done') return;
    if(t.deadline){
      var d = deadlineDiff(t.deadline);
      if(d !== null && d < 0){
        flags.push({title: t.title || 'Untitled', reason: 'overdue ' + Math.abs(Math.round(d)) + 'd', cls: 'badge-overdue'});
        return;
      }
    }
    if(t.priority === 'p0' && (!t.assignee || t.assignee === 'Unassigned')){
      flags.push({title: t.title || 'Untitled', reason: 'P0 — no assignee', cls: 's-open'});
    }
  });

  var flagsEl = document.getElementById('manager-flags');
  if(flagsEl){
    if(!flags.length){
      flagsEl.innerHTML = '<div class="manager-all-clear">&#10003; No issues — all projects on track</div>';
    } else {
      flagsEl.innerHTML = flags.map(function(f){
        return '<div class="manager-flag-item">'
          + '<span class="status-badge ' + f.cls + '">' + safeText(f.reason) + '</span>'
          + '<span>' + safeText(f.title) + '</span>'
          + '</div>';
      }).join('');
    }
  }

  // Progress by area
  var mainDone  = mainArr.filter(function(t){ return t.status === 'done'; }).length;
  var sprintDone = sprintArr.filter(function(t){ return t.status === 'done'; }).length;
  var mainPct   = mainArr.length   ? Math.round(mainDone   / mainArr.length   * 100) : 0;
  var sprintPct = sprintArr.length ? Math.round(sprintDone / sprintArr.length * 100) : 0;

  var progEl = document.getElementById('manager-progress');
  if(progEl){
    progEl.innerHTML = [
      {label: 'Main Projects', done: mainDone,   total: mainArr.length,   pct: mainPct},
      {label: 'Vibe Coding',   done: sprintDone, total: sprintArr.length, pct: sprintPct}
    ].map(function(row){
      return '<div class="manager-progress-item">'
        + '<span class="manager-bar-label">' + row.label + '</span>'
        + '<div class="manager-bar"><div class="manager-bar-fill" style="width:' + row.pct + '%"></div></div>'
        + '<span class="manager-bar-text">' + row.done + '/' + row.total + ' done</span>'
        + '</div>';
    }).join('');
  }

  // Timestamp
  var tsEl = document.getElementById('manager-ts');
  if(tsEl) tsEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
}
