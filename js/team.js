function refreshAllPickers(){
  renderContribPicker('nt-contributor-picker', App.ntSelectedContribs, function(sel){ App.ntSelectedContribs=sel; });
  if(App.selectedTicketId) renderContribPicker('d-contributor-picker', App.dSelectedContribs, function(sel){ App.dSelectedContribs=sel; saveContributors(); });
  renderContribPicker('subtask-contributor-picker', App.stSelectedContribs, function(sel){ App.stSelectedContribs=sel; });
}

function renderContribPicker(containerId, selected, onChange){
  var el = document.getElementById(containerId); if(!el) return;
  if(!App.teamMembers.length){
    el.innerHTML='<div style="font-size:12px;color:var(--text3)">No team members yet. Add them via "Manage team".</div>';
    return;
  }
  el.innerHTML = App.teamMembers.map(function(m){
    var isSel = selected.indexOf(m.name)>-1;
    var c = colorFor(m.name);
    return '<button class="contributor-chip'+(isSel?' selected':'')+'" onclick="toggleContrib(\''+containerId+'\',\''+m.name+'\')" type="button">'
      +'<div class="chip-av" style="background:'+c+'22;color:'+c+'">'+initials(m.name)+'</div>'
      +m.name+'</button>';
  }).join('');
}

window.toggleContrib = function(containerId, name){
  var sel, onChange;
  if(containerId==='nt-contributor-picker'){ sel=App.ntSelectedContribs; onChange=function(s){App.ntSelectedContribs=s;}; }
  else if(containerId==='d-contributor-picker'){ sel=App.dSelectedContribs; onChange=function(s){App.dSelectedContribs=s;saveContributors();}; }
  else { sel=App.stSelectedContribs; onChange=function(s){App.stSelectedContribs=s;}; }
  var idx=sel.indexOf(name);
  if(idx>-1) sel.splice(idx,1); else sel.push(name);
  onChange(sel);
  renderContribPicker(containerId, sel, onChange);
  if(containerId==='d-contributor-picker') renderContributorsDisplay();
};

function saveContributors(){
  if(!App.selectedTicketId) return;
  App.db.ref('tickets/'+App.selectedTicketId).update({
    contributors: App.dSelectedContribs.length ? App.dSelectedContribs : null,
    assignee: App.dSelectedContribs[0]||'Unassigned'
  });
  var t=App.allTickets[App.selectedTicketId];
  if(t) logActivity('updatedcontribs',t.title,App.dSelectedContribs.join(', ')||'none',App.selectedTicketId);
}

function renderContributorsDisplay(){
  var el=document.getElementById('d-contributors-display'); if(!el) return;
  if(!App.dSelectedContribs.length){ el.innerHTML=''; return; }
  el.innerHTML=App.dSelectedContribs.map(function(n){
    var c=colorFor(n);
    return '<div class="contrib-tag"><div style="width:14px;height:14px;border-radius:50%;background:'+c+'22;color:'+c+';display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:500">'+initials(n)+'</div><span style="font-size:12px;color:var(--text2)">'+n+'</span></div>';
  }).join('');
}

window.openTeamModal = function(){ document.getElementById('team-modal').style.display='flex'; setTimeout(function(){document.getElementById('team-add-input').focus();},100); };
window.closeTeamModal = function(){ document.getElementById('team-modal').style.display='none'; };
window.addTeamMember = function(){
  var input=document.getElementById('team-add-input');
  var name=input.value.trim(); if(!name) return;
  if(App.teamMembers.some(function(m){return m.name.toLowerCase()===name.toLowerCase();})){input.value='';return;}
  App.teamRef.push({name:name});
  input.value='';
};
window.removeTeamMember = function(id){
  App.teamRef.child(id).remove();
};
function renderTeamList(){
  var el=document.getElementById('team-member-list'); if(!el) return;
  if(!App.teamMembers.length){ el.innerHTML='<div style="font-size:12px;color:var(--text3);margin-bottom:.5rem">No team members yet.</div>'; return; }
  el.innerHTML=App.teamMembers.map(function(m){
    var c=colorFor(m.name);
    return '<div class="team-member-row">'
      +'<div style="width:24px;height:24px;border-radius:50%;background:'+c+'22;color:'+c+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:500;flex-shrink:0">'+initials(m.name)+'</div>'
      +'<span style="flex:1;font-size:13px">'+m.name+'</span>'
      +'<button class="btn-icon" onclick="removeTeamMember(\''+m.id+'\')" title="Remove">✕</button>'
      +'</div>';
  }).join('');
}
