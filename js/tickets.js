window.createTicket = function(){
  var title=document.getElementById('nt-title').value.trim(); if(!title){document.getElementById('nt-title').focus();return;}
  var dl=document.getElementById('nt-deadline').value;
  var assignee=App.ntSelectedContribs[0]||'Unassigned';
  var payload={title:title,desc:document.getElementById('nt-desc').value.trim()||'No description provided.',
    priority:document.getElementById('nt-priority').value,status:'open',
    assignee:assignee,contributors:App.ntSelectedContribs.length?App.ntSelectedContribs:null,
    deadline:dl||null,created:fmtDate(),createdTs:Date.now(),projectType:App.currentProjectView};
  if(isSprintView()) Object.assign(payload, sprintPayloadFromNewModal());
  currentTicketsRef().push(payload);
  logActivity('created',title,'');
  closeNewModal();
};

function ticketNumericFields(){
  return {
    scopedHc:true,fteRepurpose:true,fteBuffer:true,bpoNfteReduction:true,
    automationScopedHc:true,automationInProgressHc:true,actualHcSavings:true,excessCapacityHc:true
  };
}

function normalizeTicketFieldValue(field, value){
  return ticketNumericFields()[field] ? (value===''?null:numVal(value)) : (value===''?null:value);
}

function applyLocalTicketPatch(id, upd){
  if(!id || !upd) return null;
  var t = App.allTickets[id];
  if(!t) return null;
  Object.keys(upd).forEach(function(k){ t[k] = upd[k]; });
  var tickets = currentTickets();
  if(tickets && tickets[id]) Object.keys(upd).forEach(function(k){ tickets[id][k] = upd[k]; });
  return t;
}

function refreshAfterTicketUpdate(id, upd, options){
  var t = applyLocalTicketPatch(id, upd);
  if(App.selectedTicketId === id && t && typeof refreshDetailFields === 'function'){
    refreshDetailFields(t, options || {});
  }
  if(typeof updateStats === 'function') updateStats();
  if(typeof renderList === 'function') renderList();
  if(typeof updateCounts === 'function') updateCounts();
  if(typeof updateWarnings === 'function') updateWarnings();
  if(typeof renderWorkload === 'function') renderWorkload();
  if(typeof renderSprintDashboard === 'function') renderSprintDashboard();
  if(typeof renderCalendar === 'function'){
    var cal = document.getElementById('cal-overlay');
    if(cal && cal.style.display !== 'none') renderCalendar();
  }
}

window.updateTicketField = function(field,value){
  if(!App.selectedTicketId) return;
  var id = App.selectedTicketId;
  var before = App.allTickets[id] || {};
  var upd={};
  upd[field]=normalizeTicketFieldValue(field,value);
  activeTicketRef(id).update(upd);
  if(field==='status'){
    if(before) logActivity('status',before.title,value);
  }
  if(field==='deadline'){
    if(value && before) logActivity('setdeadline',before.title,'',id,before.deadline||'none',value);
  }
  if(field==='priority'){
    if(before) logActivity('priority',before.title,'',id,before.priority,value);
  }
  refreshAfterTicketUpdate(id, upd);
};

window.updateTicketOwner = function(value){
  if(!App.selectedTicketId) return;
  var id = App.selectedTicketId;
  var owner = value || 'Unassigned';
  var before = App.allTickets[id] || {};
  var upd = {assignee: owner};
  activeTicketRef(id).update(upd);
  if(before) logActivity('owner', before.title, '', id, before.assignee || 'Unassigned', owner);
  refreshAfterTicketUpdate(id, upd);
  if(isSprintView() && typeof renderWorkstreamsAndTasks === 'function') renderWorkstreamsAndTasks(id);
};

window.clearDeadline = function(){
  document.getElementById('d-deadline-inp').value='';
  var t=App.allTickets[App.selectedTicketId];
  if(t) logActivity('cleareddeadline',t.title,'',App.selectedTicketId);
  updateTicketField('deadline','');
  document.getElementById('d-deadline-status').innerHTML='';
};

window.deleteTicket = function(){
  if(!App.selectedTicketId)return;
  if(!confirm('Delete this '+(isSprintView()?'initiative':'project')+'? This cannot be undone.'))return;
  var t=App.allTickets[App.selectedTicketId];
  if(t) logActivity('deleted',t.title,'',App.selectedTicketId);
  activeTicketRef(App.selectedTicketId).remove();
  closeDetailModal();
};

function renderDeadlineStatus(dl,status){
  var el=document.getElementById('d-deadline-status'); if(!el)return;
  if(!dl||status==='done'){el.innerHTML='';return;}
  var diff=deadlineDiff(dl); if(diff===null){el.innerHTML='';return;}
  var cls,msg;
  if(diff<0){cls='over';msg='⚠ Overdue by '+Math.abs(diff)+' day'+(Math.abs(diff)>1?'s':'');}
  else if(diff===0){cls='warn';msg='⏰ Due today!';}
  else if(diff<=3){cls='warn';msg='⏰ Due in '+diff+' day'+(diff>1?'s':'');}
  else{cls='ok';msg='📅 Due on '+dl;}
  el.innerHTML='<div class="deadline-status '+cls+'" style="margin-top:6px">'+msg+'</div>';
}
