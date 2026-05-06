window.createTicket = function(){
  var title=document.getElementById('nt-title').value.trim(); if(!title){document.getElementById('nt-title').focus();return;}
  var dl=document.getElementById('nt-deadline').value;
  var assignee=App.ntSelectedContribs[0]||'Unassigned';
  App.ticketsRef.push({title:title,desc:document.getElementById('nt-desc').value.trim()||'No description provided.',
    priority:document.getElementById('nt-priority').value,status:'open',
    assignee:assignee,contributors:App.ntSelectedContribs.length?App.ntSelectedContribs:null,
    deadline:dl||null,created:fmtDate(),createdTs:Date.now()});
  logActivity('created',title,'');
  closeNewModal();
};

window.updateTicketField = function(field,value){
  if(!App.selectedTicketId) return;
  var upd={}; upd[field]=(value===''?null:value);
  App.db.ref('tickets/'+App.selectedTicketId).update(upd);
  if(field==='status'){
    document.getElementById('d-status-badge').className='status-badge '+statusClass(value);
    document.getElementById('d-status-badge').textContent=value;
    renderDeadlineStatus(document.getElementById('d-deadline-inp').value,value);
    var t2=App.allTickets[App.selectedTicketId]; if(t2) logActivity('status',t2.title,value);
  }
  if(field==='deadline'){
    renderDeadlineStatus(value,document.getElementById('d-status-sel').value);
    if(value){var t3=App.allTickets[App.selectedTicketId];if(t3) logActivity('setdeadline',t3.title,'',App.selectedTicketId,t3.deadline||'none',value);}
  }
  if(field==='priority'){
    var pb=document.getElementById('d-priority-badge');
    if(pb){pb.className='priority-badge '+pbClass(value);pb.textContent=value;}
    var t2b=App.allTickets[App.selectedTicketId]; if(t2b) logActivity('priority',t2b.title,'',App.selectedTicketId,t2b.priority,value);
  }
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
  if(!confirm('Delete this project? This cannot be undone.'))return;
  var t=App.allTickets[App.selectedTicketId];
  if(t) logActivity('deleted',t.title,'',App.selectedTicketId);
  App.db.ref('tickets/'+App.selectedTicketId).remove();
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
