window.addLink = function(){
  if(!App.selectedTicketId) return;
  var urlInput=document.getElementById('link-url-input');
  var labelInput=document.getElementById('link-label-input');
  var url=urlInput.value.trim(); if(!url) return;
  url=ensureHttp(url);
  var label=labelInput.value.trim()||url;
  var t=App.allTickets[App.selectedTicketId];
  activeTicketRef(App.selectedTicketId).child('links').push({url:url,label:label,addedBy:App.currentUser||'Unknown',ts:Date.now()});
  if(t) logActivity('addedlink',t.title,label,App.selectedTicketId);
  urlInput.value=''; labelInput.value='';
};

window.deleteLink = function(lid){
  if(!App.selectedTicketId)return;
  var t=App.allTickets[App.selectedTicketId];
  var lnk=t&&t.links&&t.links[lid];
  if(t&&lnk) logActivity('deletedlink',t.title,lnk.label||lnk.url,App.selectedTicketId);
  activeTicketRef(App.selectedTicketId).child('links/'+lid).remove();
};

function renderLinks(ticketId){
  var t=App.allTickets[ticketId]; if(!t) return;
  var links=t.links?Object.entries(t.links).sort(function(a,b){return (a[1].ts||0)-(b[1].ts||0);}):[];
  var el=document.getElementById('d-link-list'); if(!el) return;
  var countEl=document.getElementById('d-link-count');
  if(countEl) countEl.textContent=links.length?links.length+' link'+(links.length>1?'s':''):'';
  if(links.length>0) openSection('links'); else closeSection('links');
  if(!links.length){el.innerHTML='<div style="font-size:12px;color:var(--text3);margin-bottom:4px">No links yet.</div>';return;}
  el.innerHTML=links.map(function(entry){
    var lid=entry[0],l=entry[1];
    return '<div class="link-item"><span class="link-icon">🔗</span><span class="link-label">'+l.label+'</span><a class="link-url" href="'+l.url+'" target="_blank" rel="noopener">'+l.url+'</a><button class="btn-icon" onclick="deleteLink(\''+lid+'\')" title="Remove">✕</button></div>';
  }).join('');
}
