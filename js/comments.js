window.postComment = function(){
  if(!App.selectedTicketId) return;
  var input=document.getElementById('d-comment-input');
  var text=input.value.trim(); if(!text) return;
  var ct=App.allTickets[App.selectedTicketId];
  App.db.ref('tickets/'+App.selectedTicketId+'/comments').push({author:App.currentUser||'Anonymous',text:text,time:fmtDate(),ts:Date.now()});
  if(ct) logActivity('comment',ct.title,'');
  input.value=''; App.replyingTo=null;
};

window.postReply = function(cid){
  var input=document.getElementById('reply-input-'+cid); if(!input)return;
  var text=input.value.trim(); if(!text)return;
  var t=App.allTickets[App.selectedTicketId];
  App.db.ref('tickets/'+App.selectedTicketId+'/comments/'+cid+'/replies').push({author:App.currentUser||'Anonymous',text:text,time:fmtDate(),ts:Date.now()});
  if(t) logActivity('replied',t.title,'',App.selectedTicketId);
  input.value=''; App.replyingTo=null;
};

window.toggleReplyBox = function(cid){
  document.querySelectorAll('.reply-box').forEach(function(el){el.style.display='none';});
  if(App.replyingTo===cid){App.replyingTo=null;return;}
  App.replyingTo=cid;
  var box=document.getElementById('reply-box-'+cid);
  if(box){box.style.display='flex';box.querySelector('input').focus();}
};

function renderComments(ticketId){
  var t=App.allTickets[ticketId]; if(!t) return;
  var comments=t.comments?Object.entries(t.comments).sort(function(a,b){return (a[1].ts||0)-(b[1].ts||0);}):[];
  document.getElementById('d-comment-count').textContent='Comments ('+countComments(t.comments)+')';
  if(!comments.length){document.getElementById('d-comments').innerHTML='<p style="font-size:12px;color:var(--text3);margin-bottom:8px">No comments yet.</p>';return;}
  document.getElementById('d-comments').innerHTML=comments.map(function(entry){
    var cid=entry[0],c=entry[1];
    var replies=c.replies?Object.entries(c.replies).sort(function(a,b){return (a[1].ts||0)-(b[1].ts||0);}):[];
    var rHtml=replies.length?'<div class="replies">'+replies.map(function(re){var r=re[1];return '<div class="comment" style="background:var(--surface3)"><div class="comment-header">'+avatarHtml(r.author,18)+'<span class="comment-author" style="font-size:12px">'+r.author+'</span><span class="comment-time">'+r.time+'</span></div><div class="comment-text">'+r.text+'</div></div>';}).join('')+'</div>':'';
    return '<div class="comment-thread"><div class="comment"><div class="comment-header">'+avatarHtml(c.author)+'<span class="comment-author">'+c.author+'</span><span class="comment-time">'+c.time+'</span></div><div class="comment-text">'+c.text+'</div><div class="comment-actions"><button class="btn btn-ghost" onclick="toggleReplyBox(\''+cid+'\')">↩ Reply</button></div></div>'+rHtml+'<div class="reply-box" id="reply-box-'+cid+'" style="display:none">'+avatarHtml(App.currentUser,20)+'<input id="reply-input-'+cid+'" placeholder="Reply to '+c.author+'..." onkeydown="if(event.key===\'Enter\')postReply(\''+cid+'\')" /><button class="btn btn-primary btn-sm" onclick="postReply(\''+cid+'\')">Reply</button></div></div>';
  }).join('');
}
