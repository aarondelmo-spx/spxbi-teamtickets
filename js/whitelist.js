window.addWhitelist = function(){
  if(!requireAdminAccess('manage users')) return;
  var emailInput = document.getElementById('wl-email-input');
  var nameInput = document.getElementById('wl-name-input');
  var email = emailInput.value.trim().toLowerCase();
  var name = nameInput.value.trim();
  if(!email||!name) return;
  if(duplicateWhitelistEmail(email) || duplicateWhitelistName(name)) return;
  App.whitelistRef.push({email:email, name:name, role:'admin'});
  emailInput.value=''; nameInput.value='';
};

window.removeWhitelist = function(id){
  if(!requireAdminAccess('manage users')) return;
  var user = (App.users || []).find(function(entry){ return entry.id === id; });
  if(!user) return;
  if(isSelfUser(user) && userIsEffectiveAdmin(user)) return;
  if(userIsEffectiveAdmin(user) && managerAdminCount() <= 1) return;
  App.whitelistRef.child(id).remove();
};

function renderWhitelistPanel(){
  var adminSection = document.getElementById('admin-section');
  if(!adminSection) return;
  if(!isAccessAdmin()){ adminSection.style.display='none'; return; }
  adminSection.style.display='block';
  var listEl = document.getElementById('whitelist-list'); if(!listEl) return;
  var entries = App.users || [];
  if(!entries.length){
    listEl.innerHTML='<div style="font-size:12px;color:var(--text3);margin-bottom:.5rem">No entries yet.</div>';
    return;
  }
  listEl.innerHTML = entries.map(function(en){
    return '<div class="whitelist-row">'
      +'<span class="whitelist-name">'+safeText(en.name)+'</span>'
      +'<span class="whitelist-email">'+safeText(en.email)+' - '+safeText(en.role)+'</span>'
      +'<button class="btn-icon" onclick="removeWhitelist(&quot;'+en.id+'&quot;)" title="Remove">x</button>'
      +'</div>';
  }).join('');
}

window.saveName = function(name){ if(!name)return; App.currentUser=name; localStorage.setItem('spxbi_username',name); updateWho(); };
