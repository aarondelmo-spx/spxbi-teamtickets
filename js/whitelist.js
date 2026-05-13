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

window.openManageUsersModal = function(){
  document.getElementById('manage-users-modal').style.display = 'flex';
  renderManageUsersList();
};

window.closeManageUsersModal = function(){
  document.getElementById('manage-users-modal').style.display = 'none';
};

function renderManageUsersList(){
  var isAdmin = App.currentUserEmail === App.ADMIN_EMAIL;
  var addRow = document.getElementById('manage-users-add-row');
  var noAdmin = document.getElementById('manage-users-noadmin');
  if(addRow) addRow.style.display = isAdmin ? 'flex' : 'none';
  if(noAdmin) noAdmin.style.display = isAdmin ? 'none' : 'block';
  App.whitelistRef.once('value', function(snap){
    var data = snap.val()||{};
    var entries = Object.entries(data);
    var listEl = document.getElementById('manage-users-list');
    if(!listEl) return;
    if(!entries.length){
      listEl.innerHTML = '<div style="font-size:12px;color:var(--text3);margin-bottom:.5rem">No users yet.</div>';
      return;
    }
    listEl.innerHTML = entries.map(function(e){
      var id=e[0], en=e[1];
      return '<div class="whitelist-row">'
        +'<span class="whitelist-name">'+en.name+'</span>'
        +'<span class="whitelist-email">'+en.email+'</span>'
        +(isAdmin?'<button class="btn-icon" onclick="removeManageUser(&quot;'+id+'&quot;)" title="Remove">✕</button>':'')
        +'</div>';
    }).join('');
  });
}

window.addManageUser = function(){
  if(App.currentUserEmail !== App.ADMIN_EMAIL) return;
  var emailInput = document.getElementById('mu-email-input');
  var nameInput = document.getElementById('mu-name-input');
  var email = emailInput.value.trim().toLowerCase();
  var name = nameInput.value.trim();
  if(!email||!name) return;
  App.whitelistRef.push({email:email, name:name});
  emailInput.value=''; nameInput.value='';
  setTimeout(renderManageUsersList, 300);
};

window.removeManageUser = function(id){
  if(App.currentUserEmail !== App.ADMIN_EMAIL) return;
  App.whitelistRef.child(id).remove();
  setTimeout(renderManageUsersList, 300);
};
