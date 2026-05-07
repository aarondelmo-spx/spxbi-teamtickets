window.addWhitelist = function(){
  var emailInput = document.getElementById('wl-email-input');
  var nameInput = document.getElementById('wl-name-input');
  var email = emailInput.value.trim().toLowerCase();
  var name = nameInput.value.trim();
  if(!email||!name) return;
  App.whitelistRef.push({email:email, name:name});
  emailInput.value=''; nameInput.value='';
};
window.removeWhitelist = function(id){
  App.whitelistRef.child(id).remove();
};
function renderWhitelistPanel(){
  var adminSection = document.getElementById('admin-section');
  if(!adminSection) return;
  if(App.currentUserEmail !== App.ADMIN_EMAIL){ adminSection.style.display='none'; return; }
  adminSection.style.display='block';
  var listEl = document.getElementById('whitelist-list'); if(!listEl) return;
  App.whitelistRef.once('value', function(snap){
    var data = snap.val()||{};
    var entries = Object.entries(data);
    if(!entries.length){ listEl.innerHTML='<div style="font-size:12px;color:var(--text3);margin-bottom:.5rem">No entries yet.</div>'; return; }
    listEl.innerHTML = entries.map(function(e){
      var id=e[0],en=e[1];
      return '<div class="whitelist-row">'
        +'<span class="whitelist-name">'+en.name+'</span>'
        +'<span class="whitelist-email">'+en.email+'</span>'
        +'<button class="btn-icon" onclick="removeWhitelist(&quot;'+id+'&quot;)" title="Remove">✕</button>'
        +'</div>';
    }).join('');
  });
}
window.saveName = function(name){ if(!name)return; App.currentUser=name; localStorage.setItem('spxbi_username',name); updateWho(); };
