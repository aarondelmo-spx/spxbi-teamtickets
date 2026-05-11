function syncLoginAccessMessaging(source){
  App.allowedLoginDomains = AuthHelpers.collectAllowedLoginDomains(source);
  var sub = document.querySelector('.login-sub');
  if(sub) sub.textContent = AuthHelpers.getLoginSubtext(App.allowedLoginDomains);
}

function buildGoogleProvider(){
  var provider = new firebase.auth.GoogleAuthProvider();
  var hostedDomain = AuthHelpers.getLoginHostedDomain(App.allowedLoginDomains || []);
  var params = {prompt: 'select_account'};
  if(hostedDomain) params.hd = hostedDomain;
  provider.setCustomParameters(params);
  return provider;
}

function shouldUseRedirectFallback(err){
  var code = err && err.code;
  return code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/web-storage-unsupported';
}

function showLoginError(message){
  var error = document.getElementById('login-error');
  if(error){
    error.textContent = message;
    error.style.display = 'block';
  }
}

function setLoginLoading(message){
  var loading = document.getElementById('login-loading');
  if(!loading) return;
  loading.textContent = message || 'Signing in...';
  loading.style.display = 'block';
}

function stopLoginLoading(){
  var loading = document.getElementById('login-loading');
  if(loading) loading.style.display = 'none';
}

function resetLoginUi(){
  var btn = document.querySelector('.google-btn');
  if(btn) btn.style.display = 'flex';
  stopLoginLoading();
}

function fetchWhitelistForAuth(){
  return AuthHelpers.withTimeout(
    App.whitelistRef.once('value'),
    10000,
    'Whitelist read timed out.'
  ).then(function(snap){
    return snap.val() || {};
  });
}

function seedWhitelistIfEmpty(){
  App.whitelistRef.once('value', function(snap){
    if(snap.val()){
      syncLoginAccessMessaging(snap.val());
      return;
    }
    var initialList = [
      {email:'karl.kue@spxexpress.com', name:'Karl', role:'admin'},
      {email:'aaron.delmo@spxexpress.com', name:'Will', role:'admin'},
      {email:'aliya.galang@spxexpress.com', name:'Aliya', role:'admin'},
      {email:'charlie.dimaala@spxexpress.com', name:'Chao', role:'admin'},
      {email:'ryandrei.garcia@spxexpress.com', name:'RD', role:'admin'}
    ];
    initialList.forEach(function(entry){ App.whitelistRef.push(entry); });
    syncLoginAccessMessaging(initialList);
  });
}
seedWhitelistIfEmpty();
window.syncLoginAccessMessaging = syncLoginAccessMessaging;

window.signInWithGoogle = function(){
  var btn = document.querySelector('.google-btn');
  if(btn) btn.style.display = 'none';
  setLoginLoading('Signing in...');
  var error = document.getElementById('login-error');
  if(error) error.style.display = 'none';
  var provider = buildGoogleProvider();
  App.auth.signInWithPopup(provider).catch(function(err){
    if(shouldUseRedirectFallback(err)){
      showLoginError('Popup sign-in was blocked. Redirecting to Google...');
      return App.auth.signInWithRedirect(provider).catch(function(redirectErr){
        resetLoginUi();
        showLoginError('Sign in failed: ' + redirectErr.message);
      });
    }
    resetLoginUi();
    showLoginError('Sign in failed: ' + err.message);
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
    resetLoginUi();
    return;
  }
  if(!user.email){
    App.auth.signOut();
    showLoginError('Sign in failed: your Google account did not provide an email address.');
    return;
  }
  var email = user.email.toLowerCase();
  App.currentUserEmail = email;
  setLoginLoading('Checking access...');
  console.log('[auth] Google sign-in succeeded for', email);
  fetchWhitelistForAuth().then(function(wl){
    syncLoginAccessMessaging(wl);
    var rawMatch = AuthHelpers.findWhitelistedUser(wl, email);
    var mappedUser = rawMatch ? normalizeWhitelistUserRecord('auth-match', rawMatch) : null;
    console.log('[auth] whitelist loaded', { entries: Object.keys(wl || {}).length, matched: !!mappedUser, email: email });
    if(!mappedUser){
      App.auth.signOut();
      showLoginError('Access denied. Your email (' + email + ') is not authorized. Contact your admin.');
      resetLoginUi();
      return;
    }
    App.currentUser = mappedUser.name || mappedUser.email;
    App.currentUserRole = mappedUser.role;
    document.getElementById('login-screen').style.display = 'none';
    document.querySelector('.app').style.display = 'grid';
    updateWho();
    startApp();
  }).catch(function(err){
    console.error('[auth] whitelist load failed', err);
    App.auth.signOut();
    showLoginError(AuthHelpers.getWhitelistReadErrorMessage(err));
    resetLoginUi();
  });
});
