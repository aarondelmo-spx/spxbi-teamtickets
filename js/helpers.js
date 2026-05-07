function colorFor(n){ return !n?App.COLORS[0]:App.COLORS[n.charCodeAt(0)%App.COLORS.length]; }
function initials(n){ return (n||'?').slice(0,2).toUpperCase(); }
function avatarHtml(n,s){ s=s||22; var c=colorFor(n); return '<div style="width:'+s+'px;height:'+s+'px;border-radius:50%;background:'+c+'22;color:'+c+';display:flex;align-items:center;justify-content:center;font-size:'+Math.floor(s*.45)+'px;font-weight:500;flex-shrink:0">'+initials(n)+'</div>'; }
function fmtDate(){ var m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],n=new Date(); return m[n.getMonth()]+' '+n.getDate(); }
function statusClass(s){ return s==='open'?'s-open':s==='in progress'?'s-progress':s==='review'?'s-review':'s-done'; }
function pbClass(p){ return p==='p0'?'pb-p0':p==='p1'?'pb-p1':p==='p2'?'pb-p2':'pb-p3'; }
function pOrder(p){ return p==='p0'?0:p==='p1'?1:p==='p2'?2:3; }
function countComments(c){ if(!c)return 0; return Object.values(c).reduce(function(a,x){return a+1+(x.replies?Object.keys(x.replies).length:0);},0); }
function deadlineDiff(dl){ if(!dl)return null; var t=new Date();t.setHours(0,0,0,0); var d=new Date(dl+'T00:00:00');d.setHours(0,0,0,0); return Math.round((d-t)/86400000); }
function deadlineTagHtml(dl,status){
  if(!dl||status==='done') return '';
  var diff=deadlineDiff(dl); if(diff===null) return '';
  if(diff<0) return '<span class="deadline-tag dl-overdue">⏰ overdue '+Math.abs(diff)+'d</span>';
  if(diff===0) return '<span class="deadline-tag dl-soon">⏰ due today</span>';
  if(diff<=3) return '<span class="deadline-tag dl-soon">⏰ in '+diff+'d</span>';
  return '<span class="deadline-tag dl-ok">📅 '+dl+'</span>';
}
function ensureHttp(url){ return url&&!/^https?:\/\//i.test(url)?'https://'+url:url; }
function subtaskStats(subtasks){ if(!subtasks) return {total:0,done:0}; var v=Object.values(subtasks); return {total:v.length,done:v.filter(function(s){return s.done;}).length}; }
function avatarStackHtml(names, size){
  size = size||20;
  if(!names||!names.length) return '';
  return '<div class="avatar-stack">'+names.slice(0,4).map(function(n){
    var c=colorFor(n);
    return '<div class="av" style="background:'+c+'22;color:'+c+';width:'+size+'px;height:'+size+'px;font-size:'+Math.floor(size*.45)+'px" title="'+n+'">'+initials(n)+'</div>';
  }).join('')+(names.length>4?'<div class="av" style="background:var(--surface2);color:var(--text3);font-size:9px;width:'+size+'px;height:'+size+'px">+'+(names.length-4)+'</div>':'')+'</div>';
}
