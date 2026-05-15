window.toggleSection = function(s){
  var b=document.getElementById(s+'-body'),c=document.getElementById(s+'-chevron');
  if(!b)return; var open=b.style.display==='none';
  b.style.display=open?'block':'none';
  if(c)c.style.transform=open?'rotate(90deg)':'rotate(0deg)';
};
function openSection(s){ var b=document.getElementById(s+'-body'),c=document.getElementById(s+'-chevron'); if(b)b.style.display='block'; if(c)c.style.transform='rotate(90deg)'; }
function closeSection(s){ var b=document.getElementById(s+'-body'),c=document.getElementById(s+'-chevron'); if(b)b.style.display='none'; if(c)c.style.transform='rotate(0deg)'; }

function titleCaseStatus(status){
  return statusDisplayLabel(status);
}

function ownerOptions(selected){
  var value = selected && selected !== 'Unassigned' ? selected : '';
  var names = assignmentPickerNames(value);
  return '<option value="">Unassigned</option>' + names.map(function(name){
    return '<option value="'+safeText(name)+'"'+(value===name?' selected':'')+'>'+safeText(name)+'</option>';
  }).join('');
}

function detailOwnerValue(ticket){
  if(ticket.assignee && ticket.assignee !== 'Unassigned') return ticket.assignee;
  return ticket.contributors && ticket.contributors.length ? ticket.contributors[0] : '';
}

window.setDetailStatusOptions = function(currentStatus){
  var el = document.getElementById('d-status-sel');
  if(!el) return;
  var options = isSprintView()
    ? [{value:'open', label:'Open'}, {value:'in progress', label:'In progress'}, {value:'done', label:'Done'}]
    : [{value:'open', label:'Open'}, {value:'archived', label:'Archived'}];
  var value = effectiveStatusValue(currentStatus || 'open');
  if(value && !options.some(function(opt){ return opt.value === value; })){
    options.splice(Math.max(options.length - 1, 1), 0, {value:value, label:titleCaseStatus(value)});
  }
  el.innerHTML = options.map(function(opt){
    return '<option value="'+safeText(opt.value)+'">'+safeText(opt.label)+'</option>';
  }).join('');
  el.value = value;
};

function staticDetailTextEl(field, value){
  var el = document.createElement('div');
  el.id = 'd-'+field;
  el.className = field === 'title' ? 'detail-title' : 'detail-desc';
  el.title = canEditContent() ? 'Double-click to edit' : '';
  el.style.cursor = canEditContent() ? 'text' : 'default';
  if(canEditContent()){
    el.ondblclick = function(){ editDetailField(field); };
  }
  el.textContent = value;
  return el;
}

function renderStaticDetailText(field, value, force){
  var el = document.getElementById('d-'+field);
  if(!el) return;
  var editing = el.getAttribute && el.getAttribute('data-detail-edit-field');
  if(editing && !force) return;
  var displayValue = field === 'desc' ? (value || 'No description.') : (value || 'Untitled');
  if(editing){
    el.replaceWith(staticDetailTextEl(field, displayValue));
    return;
  }
  el.textContent = displayValue;
}

function readDetailTextField(field){
  var el = document.getElementById('d-'+field);
  if(!el) return '';
  if(el.getAttribute && el.getAttribute('data-detail-edit-field')) return el.value.trim();
  if(field === 'desc' && el.textContent === 'No description.') return '';
  return el.textContent.trim();
}

function setDetailSaveStatus(message){
  var el = document.getElementById('detail-save-status');
  if(!el) return;
  el.textContent = message || '';
  if(message){
    setTimeout(function(){ if(el.textContent === message) el.textContent = ''; }, 1800);
  }
}

window.applyDetailAccessState = function(){
  var editable = canEditContent();
  var commentable = canComment();
  [
    'd-status-sel',
    'd-priority-sel',
    'd-owner-sel',
    'd-deadline-inp',
    'd-team-area',
    'd-subteam',
    'd-timeline-start',
    'd-stage',
    'd-confidence',
    'd-automation-scoped-hc',
    'd-actual-hc-savings',
    'd-excess-capacity-hc',
    'support-contact-name',
    'support-contact-email',
    'support-contact-team',
    'subtask-input',
    'subtask-deadline',
    'link-url-input',
    'link-label-input'
  ].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.disabled = !editable;
  });
  ['detail-delete-btn','detail-save-btn','detail-clear-deadline-btn','detail-add-subtask-btn','detail-add-link-btn','detail-add-workstream-btn','detail-add-support-contact-btn'].forEach(function(id){
    var btn = document.getElementById(id);
    if(btn) btn.disabled = !editable;
  });
  var commentInput = document.getElementById('d-comment-input');
  if(commentInput) commentInput.disabled = !commentable;
  var commentBtn = document.getElementById('detail-comment-post-btn');
  if(commentBtn) commentBtn.disabled = !commentable;
  ['title','desc'].forEach(function(field){
    var el = document.getElementById('d-' + field);
    if(!el) return;
    el.style.cursor = editable ? 'text' : 'default';
    el.title = editable ? 'Double-click to edit' : '';
  });
};

window.refreshDetailFields = function(t, options){
  options = options || {};
  renderStaticDetailText('title', t.title, options.forceText);
  renderStaticDetailText('desc', t.desc, options.forceText);
  var priorityBadge = document.getElementById('d-priority-badge');
  if(priorityBadge){ priorityBadge.className='priority-badge '+pbClass(t.priority); priorityBadge.textContent=t.priority||'p1'; }
  var statusBadge = document.getElementById('d-status-badge');
  if(statusBadge){ statusBadge.className='status-badge '+statusClass(t.status); statusBadge.textContent=statusDisplayLabel(t.status); }
  setDetailStatusOptions(t.status);
  var prioritySel = document.getElementById('d-priority-sel');
  if(prioritySel) prioritySel.value=t.priority||'p1';
  var deadlineInp = document.getElementById('d-deadline-inp');
  if(deadlineInp) deadlineInp.value=t.deadline||'';
  var ownerSel = document.getElementById('d-owner-sel');
  if(ownerSel){
    var owner = detailOwnerValue(t);
    ownerSel.innerHTML = ownerOptions(owner);
    ownerSel.value = owner;
  }
  renderDeadlineStatus(t.deadline,t.status);
  if(typeof populateSprintDetail === 'function') populateSprintDetail(t);
  applyDetailAccessState();
};

window.editDetailField = function(field){
  if(!requireContentEditAccess('edit projects')) return;
  var el=document.getElementById('d-'+field); if(!el) return;
  var ticket=App.allTickets[App.selectedTicketId] || {};
  var current=field==='title' ? (ticket.title || el.textContent) : (ticket.desc || '');
  var isTitle=field==='title';
  var input=document.createElement(isTitle?'input':'textarea');
  input.value=current;
  input.id='d-'+field;
  input.setAttribute('data-detail-edit-field',field);
  input.style.cssText='width:100%;padding:6px 8px;border-radius:var(--radius);border:1px solid var(--accent);background:var(--surface2);color:var(--text);font-family:var(--font);font-size:'+(isTitle?'17px':'13px')+';font-weight:'+(isTitle?'500':'400')+';outline:none;resize:vertical';
  if(!isTitle) input.rows=3;
  el.replaceWith(input);
  input.focus();
  input.select();
  var done = false;
  function save(){
    if(done) return;
    done = true;
    var newVal=input.value.trim()||current;
    var dbField=field==='title'?'title':'desc';
    var id = App.selectedTicketId;
    var upd = {};
    upd[dbField] = newVal;
    activeTicketRef(id).update(upd);
    var t=App.allTickets[id];
    if(t&&newVal!==current) logActivity('edited'+dbField,t.title,'',id,current.slice(0,40),newVal.slice(0,40));
    if(typeof refreshAfterTicketUpdate === 'function') refreshAfterTicketUpdate(id, upd, {forceText:true});
    else input.replaceWith(staticDetailTextEl(field, field==='desc' ? (newVal || 'No description.') : newVal));
    setDetailSaveStatus('Saved');
  }
  function cancel(){
    if(done) return;
    done = true;
    input.replaceWith(staticDetailTextEl(field, field==='desc' ? (current || 'No description.') : current));
  }
  input.addEventListener('blur',save);
  input.addEventListener('keydown',function(e){
    if(isTitle&&e.key==='Enter'){e.preventDefault();save();input.blur();}
    if(e.key==='Escape'){e.preventDefault();cancel();}
  });
};

window.saveDetailChanges = function(){
  if(!App.selectedTicketId) return;
  if(!requireContentEditAccess('save project changes')) return;
  if(isSprintView() && typeof commitSupportTeamInput === 'function') commitSupportTeamInput('detail');
  var id = App.selectedTicketId;
  var upd = {
    title: readDetailTextField('title') || 'Untitled',
    desc: readDetailTextField('desc') || 'No description.',
    status: document.getElementById('d-status-sel').value || 'open',
    priority: document.getElementById('d-priority-sel').value || 'p1',
    deadline: document.getElementById('d-deadline-inp').value || null,
    contributors: App.dSelectedContribs.length ? App.dSelectedContribs : null,
    assignee: isSprintView() ? (document.getElementById('d-owner-sel').value || 'Unassigned') : (App.dSelectedContribs[0] || 'Unassigned')
  };
  if(isSprintView()){
    var ticket = App.allTickets[id] || {};
    var defaultTimelineStart = ticket.timelineStart || (ticket.createdTs ? ymd(ticket.createdTs) : ymd(new Date()));
    upd.teamArea = normalizeTeamName(document.getElementById('d-team-area').value);
    upd.subteam = normalizeSubteamName(document.getElementById('d-subteam').value);
    upd.timelineStart = document.getElementById('d-timeline-start').value || defaultTimelineStart;
    upd.stage = document.getElementById('d-stage').value || null;
    upd.confidence = document.getElementById('d-confidence').value || null;
    upd.automationScopedHc = normalizeTicketFieldValue('automationScopedHc', document.getElementById('d-automation-scoped-hc').value);
    upd.actualHcSavings = normalizeTicketFieldValue('actualHcSavings', document.getElementById('d-actual-hc-savings').value);
    upd.excessCapacityHc = normalizeTicketFieldValue('excessCapacityHc', document.getElementById('d-excess-capacity-hc').value);
  }
  activeTicketRef(id).update(upd);
  refreshAfterTicketUpdate(id, upd, {forceText:true});
  setDetailSaveStatus('Saved');
};

window.openDetailModal = function(id){
  App.selectedTicketId=id;
  var t=App.allTickets[id]; if(!t)return;
  setDetailSaveStatus('');
  document.getElementById('d-id').textContent='#'+id.slice(-6).toUpperCase();
  refreshDetailFields(t, {forceText:true});
  App.dSelectedContribs=t.contributors?t.contributors.slice():(t.assignee&&t.assignee!=='Unassigned'?[t.assignee]:[]);
  App.stSelectedContribs=[];
  renderContribPicker('d-contributor-picker',App.dSelectedContribs,function(sel){App.dSelectedContribs=sel;saveContributors();});
  renderContributorsDisplay();
  renderContribPicker('subtask-contributor-picker',App.stSelectedContribs,function(sel){App.stSelectedContribs=sel;});
  populateSprintDetail(t);
  if(typeof updateDetailLayoutForView === 'function') updateDetailLayoutForView();
  renderSubtasks(id);
  renderLinks(id);
  renderComments(id);
  updateWho();
  applyDetailAccessState();
  document.getElementById('detail-modal').style.display='flex';
  setTimeout(function(){var el=document.getElementById('d-comment-input');if(el)el.focus();},100);
};

window.closeDetailModal = function(){ document.getElementById('detail-modal').style.display='none'; App.selectedTicketId=null; };
