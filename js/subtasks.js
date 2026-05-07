window.addSubtask = function(){
  if(!App.selectedTicketId) return;
  var input=document.getElementById('subtask-input');
  var dlInput=document.getElementById('subtask-deadline');
  var text=input.value.trim(); if(!text) return;
  var dl=dlInput?dlInput.value:'';
  var contribs=App.stSelectedContribs.slice();
  var st=App.allTickets[App.selectedTicketId];
  activeTicketRef(App.selectedTicketId).child('subtasks').push({text:text,done:false,deadline:dl||null,contributors:contribs.length?contribs:null,createdBy:App.currentUser||'Unknown',ts:Date.now()});
  if(st) logActivity('subtask',st.title,text);
  input.value=''; if(dlInput)dlInput.value='';
  App.stSelectedContribs=[];
  renderContribPicker('subtask-contributor-picker',App.stSelectedContribs,function(sel){App.stSelectedContribs=sel;});
};

window.toggleSubtask = function(sid,cur){
  if(!App.selectedTicketId)return;
  activeTicketRef(App.selectedTicketId).child('subtasks/'+sid).update({done:!cur});
  if(!cur){
    var tt=App.allTickets[App.selectedTicketId];
    var sub=tt&&tt.subtasks&&tt.subtasks[sid];
    if(tt&&sub) logActivity('done',tt.title,sub.text);
  }
};

window.deleteSubtask = function(sid){
  if(!App.selectedTicketId)return;
  var t=App.allTickets[App.selectedTicketId];
  var sub=t&&t.subtasks&&t.subtasks[sid];
  if(t&&sub) logActivity('deletedsubtask',t.title,sub.text,App.selectedTicketId);
  activeTicketRef(App.selectedTicketId).child('subtasks/'+sid).remove();
};

window.editSubtask = function(sid){
  var span=document.getElementById('sttext-'+sid); if(!span) return;
  var current=span.textContent;
  var input=document.createElement('input');
  input.className='subtask-edit';
  input.value=current;
  span.replaceWith(input);
  input.focus();
  input.select();
  function save(){
    var newText=input.value.trim()||current;
    activeTicketRef(App.selectedTicketId).child('subtasks/'+sid).update({text:newText});
    var t=App.allTickets[App.selectedTicketId];
    if(t&&newText!==current) logActivity('editedsubtask',t.title,'',App.selectedTicketId,current.slice(0,40),newText.slice(0,40));
  }
  input.addEventListener('blur',save);
  input.addEventListener('keydown',function(e){
    if(e.key==='Enter'){e.preventDefault();save();input.blur();}
    if(e.key==='Escape'){input.value=current;input.blur();}
  });
};

function renderSubtasks(ticketId){
  var t=App.allTickets[ticketId]; if(!t) return;
  var subtasks=t.subtasks?Object.entries(t.subtasks).sort(function(a,b){return (a[1].ts||0)-(b[1].ts||0);}):[];
  var stats=subtaskStats(t.subtasks);
  var progressEl=document.getElementById('d-subtask-progress');
  var listEl=document.getElementById('d-subtask-list'); if(!progressEl||!listEl) return;
  if(stats.total>0){ var pct=Math.round(stats.done/stats.total*100); progressEl.textContent=stats.done+'/'+stats.total+' ('+pct+'%)'; openSection('subtasks'); }
  else { progressEl.textContent=''; closeSection('subtasks'); }
  if(!subtasks.length){listEl.innerHTML='<div style="font-size:12px;color:var(--text3);margin-bottom:4px">No subtasks yet.</div>';return;}
  listEl.innerHTML=subtasks.map(function(entry){
    var sid=entry[0],s=entry[1];
    var dlTag='';
    if(s.deadline&&!s.done){
      var diff=deadlineDiff(s.deadline);
      if(diff!==null){
        if(diff<0) dlTag='<span class="deadline-tag dl-overdue">⏰ overdue '+Math.abs(diff)+'d</span>';
        else if(diff===0) dlTag='<span class="deadline-tag dl-soon">⏰ today</span>';
        else if(diff<=3) dlTag='<span class="deadline-tag dl-soon">⏰ in '+diff+'d</span>';
        else dlTag='<span class="deadline-tag dl-ok">📅 '+s.deadline+'</span>';
      }
    }
    var contribHtml=s.contributors&&s.contributors.length?avatarStackHtml(s.contributors,18):'';
    return '<div class="subtask-item'+(s.done?' done-task':'')+'">'
      +'<div class="subtask-check'+(s.done?' checked':'')+'" onclick="toggleSubtask(\''+sid+'\','+s.done+')"></div>'
      +'<span class="subtask-text" id="sttext-'+sid+'" ondblclick="editSubtask(\''+sid+'\')" title="Double-click to edit">'+s.text+'</span>'
      +'<div class="subtask-meta">'
      +(dlTag?dlTag:'')
      +(contribHtml?contribHtml:'')
      +'<button class="btn-icon" onclick="deleteSubtask(\''+sid+'\')" title="Remove">✕</button>'
      +'</div></div>';
  }).join('');
}
