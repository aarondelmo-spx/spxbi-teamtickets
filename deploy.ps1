param(
  [string]$msg = ("deploy " + (Get-Date -Format "yyyy-MM-dd HH:mm"))
)

$projectDir = "C:\Users\SPXPH3027\Claude\spxbi-teamtickets"
$firebase   = "C:\Users\SPXPH3027\AppData\Local\npm\firebase.cmd"

Set-Location $projectDir

Write-Host "`n=== Git ===" -ForegroundColor Cyan
git add .
git commit -m $msg
git push

Write-Host "`n=== Firebase ===" -ForegroundColor Cyan
& $firebase deploy --only hosting
