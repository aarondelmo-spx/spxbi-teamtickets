function seedWhitelistIfEmpty(){
  App.whitelistRef.once('value', function(snap){
    if(snap.val()) return;
    var initialList = [
      {email:'karl.kue@spxexpress.com', name:'Karl'},
      {email:'aaron.delmo@spxexpress.com', name:'Will'},
      {email:'aliya.galang@spxexpress.com', name:'Aliya'},
      {email:'charlie.dimaala@spxexpress.com', name:'Chao'},
      {email:'ryandrei.garcia@spxexpress.com', name:'RD'}
    ];
    initialList.forEach(function(entry){ App.whitelistRef.push(entry); });
  });
}
seedWhitelistIfEmpty();

window.signInWithGoogle = function(){
  var btn = document.querySelector('.google-btn');
  var loading = document.getElementById('login-loading');
  var error = document.getElementById('login-error');
  if(btn) btn.style.display = 'none';
  if(loading) loading.style.display = 'block';
  if(error) error.style.display = 'none';
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({hd: 'spxexpress.com'});
  App.auth.signInWithPopup(provider).catch(function(err){
    if(btn) btn.style.display = 'flex';
    if(loading) loading.style.display = 'none';
    if(error){ error.textContent = 'Sign in failed: ' + err.message; error.style.display = 'block'; }
  });
};

window.signOut = function(){
  if(!confirm('Sign out?')) return;
  App.auth.signOut();
};

function updateWho(){
  var c=colorFor(App.currentUser);
  document.getElementById('who-name').textContent=App.currentUser||'...';
  var av=document.getElementById('who-avatar');
  av.style.cssText='width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:500;flex-shrink:0;background:'+c+'22;color:'+c;
  av.textContent=initials(App.currentUser);
  var da=document.getElementById('d-my-avatar');
  if(da) da.innerHTML=avatarHtml(App.currentUser,22);
}

App.auth.onAuthStateChanged(function(user){
  if(!user){
    document.getElementById('login-screen').style.display = 'flex';
    document.querySelector('.app') && (document.querySelector('.app').style.display = 'none');
    var btn = document.querySelector('.google-btn');
    var loading = document.getElementById('login-loading');
    if(btn) btn.style.display = 'flex';
    if(loading) loading.style.display = 'none';
    return;
  }
  var email = user.email.toLowerCase();
  App.currentUserEmail = email;
  App.whitelistRef.once('value', function(snap){
    var wl = snap.val()||{};
    var mappedName = null;
    Object.values(wl).forEach(function(entry){
      if(entry.email && entry.email.toLowerCase() === email) mappedName = entry.name;
    });
    if(!mappedName){
      App.auth.signOut();
      var error = document.getElementById('login-error');
      var btn = document.querySelector('.google-btn');
      if(error){ error.textContent = 'Access denied. Your email (' + email + ') is not authorized. Contact your admin.'; error.style.display = 'block'; }
      if(btn) btn.style.display = 'flex';
      document.getElementById('login-loading').style.display = 'none';
      return;
    }
    App.currentUser = mappedName;
    document.getElementById('login-screen').style.display = 'none';
    document.querySelector('.app').style.display = 'grid';
    updateWho();
    startApp();
  });
});
