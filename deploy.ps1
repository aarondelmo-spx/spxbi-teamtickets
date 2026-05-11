param(
  [string]$msg = ("deploy " + (Get-Date -Format "yyyy-MM-dd HH:mm"))
)

$projectDir = "C:\Users\SPXPH3027\Claude\spxbi-teamtickets"
$firebase   = "C:\Users\SPXPH3027\AppData\Local\npm\firebase.cmd"

Set-Location $projectDir

Write-Host "`n=== Git ===" -ForegroundColor Cyan
git rev-parse --is-inside-work-tree *> $null
if($LASTEXITCODE -ne 0){
  Write-Host "Deployment blocked: current directory is not a git repository." -ForegroundColor Red
  exit 1
}

$upstream = git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
if($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($upstream)){
  Write-Host "Deployment blocked: current branch has no upstream tracking branch." -ForegroundColor Red
  exit 1
}

$aheadCount = [int](git rev-list --count "$upstream..HEAD")
if($aheadCount -gt 0){
  Write-Host "Deployment blocked: branch is already ahead of $upstream by $aheadCount commit(s)." -ForegroundColor Red
  Write-Host "Push those commits manually before running deploy.ps1 again." -ForegroundColor Yellow
  exit 1
}

git add .
git diff --cached --quiet
if($LASTEXITCODE -ne 0){
  git commit -m $msg
}
else {
  Write-Host "No local changes to commit." -ForegroundColor Yellow
}

git push

Write-Host "`n=== Firebase ===" -ForegroundColor Cyan
& $firebase deploy --only hosting,database
