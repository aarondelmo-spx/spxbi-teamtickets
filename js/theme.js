function applyTheme(){
  document.body.classList.toggle('light', !App.isDark);
  var btn = document.getElementById('theme-btn');
  if(btn) btn.textContent = App.isDark ? '☀ Light mode' : '🌙 Dark mode';
}
window.toggleTheme = function(){
  App.isDark = !App.isDark;
  localStorage.setItem('spxbi_theme', App.isDark ? 'dark' : 'light');
  applyTheme();
};
applyTheme();
