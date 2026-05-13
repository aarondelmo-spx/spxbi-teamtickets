window.openCalendar = function(){
  App.calYear = new Date().getFullYear();
  App.calMonth = new Date().getMonth();
  App.calSelectedDate = null;
  renderCalendar();
  document.getElementById('cal-overlay').style.display = 'flex';
};

window.closeCalendar = function(){
  document.getElementById('cal-overlay').style.display = 'none';
};

window.calMove = function(dir){
  App.calMonth += dir;
  if(App.calMonth > 11){ App.calMonth = 0; App.calYear++; }
  if(App.calMonth < 0){ App.calMonth = 11; App.calYear--; }
  renderCalendar();
};

window.calToday = function(){
  App.calYear = new Date().getFullYear();
  App.calMonth = new Date().getMonth();
  App.calSelectedDate = null;
  renderCalendar();
};

function calCollectDeadlines(){
  var map = {};
  function add(dateStr, item){
    if(!dateStr) return;
    if(!map[dateStr]) map[dateStr] = [];
    map[dateStr].push(item);
  }
  Object.entries(App.allTickets).forEach(function(e){
    var id = e[0], t = e[1];
    var projectDueDate = t.deadline || (isSprintView() ? t.timelineEnd : null);
    if(projectDueDate){
      add(projectDueDate, {title:t.title, isSubtask:false, status:t.status, priority:t.priority||'p1', id:id, subId:null});
    }
    if(t.subtasks){
      Object.entries(t.subtasks).forEach(function(se){
        var sid=se[0], sub=se[1];
        if(sub.deadline){
          add(sub.deadline, {title:sub.text||sub.title||'Subtask', isSubtask:true, parentTitle:t.title, status:sub.done?'done':'open', priority:'p1', id:id, subId:sid, contributors: sub.contributors||[]});
        }
      });
    }
  });
  return map;
}

function renderCalendar(){
  var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-month-label').textContent = MONTHS[App.calMonth] + ' ' + App.calYear;
  var today = new Date(); today.setHours(0,0,0,0);
  var todayStr = today.toISOString().slice(0,10);
  var deadlines = calCollectDeadlines();
  var firstDay = new Date(App.calYear, App.calMonth, 1).getDay();
  var daysInMonth = new Date(App.calYear, App.calMonth+1, 0).getDate();
  var daysInPrev = new Date(App.calYear, App.calMonth, 0).getDate();
  var cells = [];
  for(var i = firstDay-1; i >= 0; i--){
    cells.push({day: daysInPrev-i, otherMonth: true, dateStr: isoDate(App.calYear, App.calMonth-1, daysInPrev-i)});
  }
  for(var d = 1; d <= daysInMonth; d++){
    cells.push({day: d, otherMonth: false, dateStr: isoDate(App.calYear, App.calMonth, d)});
  }
  var remaining = 42 - cells.length;
  for(var n = 1; n <= remaining; n++){
    cells.push({day: n, otherMonth: true, dateStr: isoDate(App.calYear, App.calMonth+1, n)});
  }
  var html = cells.map(function(cell){
    var items = deadlines[cell.dateStr] || [];
    var dateObj = new Date(cell.dateStr+'T00:00:00'); dateObj.setHours(0,0,0,0);
    var diffDays = Math.round((dateObj - today)/86400000);
    var isToday = cell.dateStr === todayStr;
    var isOverdue = !cell.otherMonth && diffDays < 0 && items.some(function(x){
      var status = effectiveStatusValue(x.status);
      return status!=='done' && status!=='archived';
    });
    var isSelected = cell.dateStr === App.calSelectedDate;
    var cls = 'cal-cell';
    if(cell.otherMonth) cls += ' other-month';
    if(isToday) cls += ' today';
    if(isOverdue) cls += ' overdue-day';
    if(items.length) cls += ' has-items';
    if(isSelected) cls += ' selected';
    var chips = items.slice(0,2).map(function(it){
      var chipCls = 'cal-chip ';
      var itemStatus = effectiveStatusValue(it.status);
      if(itemStatus==='done' || itemStatus==='archived') chipCls+='ok';
      else if(diffDays<0) chipCls+='overdue';
      else if(diffDays<=3) chipCls+='soon';
      else chipCls += it.isSubtask ? 'sub' : 'ok';
      var label = (it.isSubtask ? '↳ ' : '') + it.title;
      return '<div class="'+chipCls+'" title="'+escHtml(it.title)+'">'+escHtml(label.slice(0,20))+'</div>';
    }).join('');
    if(items.length>2){
      chips += '<div class="cal-chip more">+' + (items.length-2) + ' more</div>';
    }
    var onclick = items.length ? 'onclick="calSelectDate(\''+cell.dateStr+'\')"' : '';
    return '<div class="'+cls+'" '+onclick+'>'
      +'<div class="cal-cell-num">'+cell.day+'</div>'
      +chips
      +'</div>';
  }).join('');
  document.getElementById('cal-grid').innerHTML = html;
  if(App.calSelectedDate) renderCalDetail(App.calSelectedDate, deadlines[App.calSelectedDate]||[]);
  else { document.getElementById('cal-detail-date').textContent='Select a date'; document.getElementById('cal-detail-body').innerHTML='<div class="cal-detail-empty">Click a day to see<br>deliverables &amp; '+(isSprintView()?'tasks':'subtasks')+'</div>'; }
}

window.calSelectDate = function(dateStr){
  App.calSelectedDate = dateStr;
  var deadlines = calCollectDeadlines();
  document.querySelectorAll('.cal-cell').forEach(function(el){ el.classList.remove('selected'); });
  renderCalendar();
  renderCalDetail(dateStr, deadlines[dateStr]||[]);
};

function renderCalDetail(dateStr, items){
  var d = new Date(dateStr+'T00:00:00');
  var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  document.getElementById('cal-detail-date').textContent = DAYS[d.getDay()]+', '+MONTHS[d.getMonth()]+' '+d.getDate();
  var today = new Date(); today.setHours(0,0,0,0);
  var diffDays = Math.round((d-today)/86400000);
  if(!items.length){
    document.getElementById('cal-detail-body').innerHTML='<div class="cal-detail-empty">No deliverables on this day.</div>';
    return;
  }
  var html = items.map(function(it){
    var statusCls = statusClass(it.status);
    var priCls = pbClass(it.priority);
    var urgencyLabel = '';
    var normalizedStatus = effectiveStatusValue(it.status);
    if(normalizedStatus!=='done' && normalizedStatus!=='archived'){
      if(diffDays<0) urgencyLabel='<span class="cal-di-badge" style="background:rgba(247,112,111,.15);color:var(--overdue)">overdue</span>';
      else if(diffDays===0) urgencyLabel='<span class="cal-di-badge" style="background:rgba(247,212,111,.15);color:var(--warn)">due today</span>';
      else if(diffDays<=3) urgencyLabel='<span class="cal-di-badge" style="background:rgba(247,212,111,.1);color:var(--warn)">in '+diffDays+'d</span>';
    }
    var contribs = '';
    if(it.contributors && it.contributors.length){
      contribs = '<div style="margin-top:3px">'+avatarStackHtml(it.contributors,14)+'</div>';
    }
    var subLabelText = isSprintView() ? 'task in: ' : 'subtask of: ';
    var subLabel = it.isSubtask ? '<span class="cal-di-sub-label">↳ '+subLabelText+escHtml((it.parentTitle||'').slice(0,24))+'</span>' : '';
    return '<div class="cal-detail-item" onclick="closeCalendar();openDetailModal(\''+it.id+'\')">'
      +'<div class="cal-di-title">'+escHtml(it.title)+'</div>'
      +(subLabel?'<div>'+subLabel+'</div>':'')
      +'<div class="cal-di-badges">'
      +'<span class="cal-di-badge status-badge '+statusCls+'">'+it.status+'</span>'
      +'<span class="cal-di-badge priority-badge '+priCls+'">'+it.priority+'</span>'
      +urgencyLabel
      +'</div>'
      +contribs
      +'</div>';
  }).join('');
  document.getElementById('cal-detail-body').innerHTML = html;
}

function isoDate(y, m, d){
  var mo = ((m%12)+12)%12;
  var yr = y + Math.floor(m/12);
  if(m < 0){ yr = y - 1; mo = 12 + m; }
  return yr+'-'+String(mo+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}

function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
