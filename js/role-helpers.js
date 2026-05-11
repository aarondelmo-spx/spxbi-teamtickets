(function(root, factory){
  var api = factory();
  root.RoleHelpers = api;
  if(typeof module === 'object' && module.exports){
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function(){
  function normalizeUserRole(role){
    role = String(role || '').trim().toLowerCase();
    return role === 'viewer' || role === 'editor' || role === 'admin' ? role : 'admin';
  }

  function resolveUserRole(role, email, adminEmail){
    return normalizeUserRole(role);
  }

  function roleCanEditContent(role){
    role = normalizeUserRole(role);
    return role === 'editor' || role === 'admin';
  }

  function roleCanManageUsers(role){
    return normalizeUserRole(role) === 'admin';
  }

  function roleIsAssignable(role){
    return roleCanEditContent(role);
  }

  function roleLabel(role){
    role = normalizeUserRole(role);
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  return {
    normalizeUserRole: normalizeUserRole,
    resolveUserRole: resolveUserRole,
    roleCanEditContent: roleCanEditContent,
    roleCanManageUsers: roleCanManageUsers,
    roleIsAssignable: roleIsAssignable,
    roleLabel: roleLabel
  };
});
