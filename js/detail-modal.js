window.toggleSection = function(s){
  var b=document.getElementById(s+'-body'),c=document.getElementById(s+'-chevron');
  if(!b)return; var open=b.style.display==='none';
  b.style.display=open?'block':'none';
  if(c)c.style.transform=open?'rotate(90deg)':'rotate(0deg)';
};
function openSection(s){ var b=document.getElementById(s+'-body'),c=document.getElementById(s+'-chevron'); if(b)b.style.display='block'; if(c)c.style.transform='rotate(90deg)'; }
function closeSection(s){ var b=document.getElementById(s+'-body'),c=document.getElementById(s+'-chevron'); if(b)b.style.display='none'; if(c)c.style.transform='rotate(0deg)'; }

window.editDetailField = function(field){
  var el=document.getElementById('d-'+field); if(!el) return;
  var current=el.textContent;
  var isTitle=field==='title';
  var input=document.createElement(isTitle?'input':'textarea');
  input.value=current;
  input.style.cssText='width:100%;padding:6px 8px;border-radius:var(--radius);border:1px solid var(--accent);background:var(--surface2);color:var(--text);font-family:var(--font);font-size:'+(isTitle?'17px':'13px')+';font-weight:'+(isTitle?'500':'400')+';outline:none;resize:vertical';
  if(!isTitle) input.rows=3;
  el.replaceWith(input);
  input.focus();
  input.select();
  function save(){
    var newVal=input.value.trim()||current;
    var dbField=field==='title'?'title':'desc';
    activeTicketRef(App.selectedTicketId).update({[dbField]:newVal});
    var t=App.allTickets[App.selectedTicketId];
    if(t&&newVal!==current) logActivity('edited'+dbField,t.title,'',App.selectedTicketId,current.slice(0,40),newVal.slice(0,40));
  }
  input.addEventListener('blur',save);
  input.addEventListener('keydown',function(e){
    if(isTitle&&e.key==='Enter'){e.preventDefault();save();input.blur();}
    if(e.key==='Escape'){input.value=current;input.blur();}
  });
};

window.openDetailModal = function(id){
  App.selectedTicketId=id;
  var t=App.allTickets[id]; if(!t)return;
  document.getElementById('d-id').textContent='#'+id.slice(-6).toUpperCase();
  document.getElementById('d-title').textContent=t.title;
  document.getElementById('d-desc').textContent=t.desc||'No description.';
  document.getElementById('d-priority-badge').className='priority-badge '+pbClass(t.priority);
  document.getElementById('d-priority-badge').textContent=t.priority||'p1';
  document.getElementById('d-status-badge').className='status-badge '+statusClass(t.status);
  document.getElementById('d-status-badge').textContent=t.status;
  document.getElementById('d-status-sel').value=t.status;
  document.getElementById('d-priority-sel').value=t.priority||'p1';
  document.getElementById('d-deadline-inp').value=t.deadline||'';
  renderDeadlineStatus(t.deadline,t.status);
  App.dSelectedContribs=t.contributors?t.contributors.slice():[];
  App.stSelectedContribs=[];
  renderContribPicker('d-contributor-picker',App.dSelectedContribs,function(sel){App.dSelectedContribs=sel;saveContributors();});
  renderContributorsDisplay();
  renderContribPicker('subtask-contributor-picker',App.stSelectedContribs,function(sel){App.stSelectedContribs=sel;});
  populateSprintDetail(t);
  renderSubtasks(id);
  renderLinks(id);
  renderComments(id);
  updateWho();
  document.getElementById('detail-modal').style.display='flex';
  setTimeout(function(){var el=document.getElementById('d-comment-input');if(el)el.focus();},100);
};

window.closeDetailModal = function(){ document.getElementById('detail-modal').style.display='none'; App.selectedTicketId=null; };
