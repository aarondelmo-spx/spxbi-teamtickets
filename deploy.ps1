param(
  [string]$msg = ("deploy " + (Get-Date -Format "yyyy-MM-dd HH:mm"))
)

$projectDir = "C:\Users\SPXPH3027\Claude\spxbi-teamtickets"
$firebase   = "C:\Users\SPXPH3027\AppData\Local\npm\firebase.cmd"

Set-Location $projectDir

function Fail-Deploy([string]$message) {
  Write-Host $message -ForegroundColor Red
  exit 1
}

Write-Host "`n=== Git ===" -ForegroundColor Cyan
git rev-parse --is-inside-work-tree *> $null
if($LASTEXITCODE -ne 0){
  Fail-Deploy "Deployment blocked: current directory is not a git repository."
}

$upstream = git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
if($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($upstream)){
  Fail-Deploy "Deployment blocked: current branch has no upstream tracking branch."
}

$aheadCount = [int](git rev-list --count "$upstream..HEAD")
if($aheadCount -gt 0){
  Write-Host "Deployment blocked: branch is already ahead of $upstream by $aheadCount commit(s)." -ForegroundColor Red
  Write-Host "Push those commits manually before running deploy.ps1 again." -ForegroundColor Yellow
  exit 1
}

$pendingChanges = @(git status --porcelain=v1)
if($LASTEXITCODE -ne 0){
  Fail-Deploy "Deployment blocked: unable to read git status."
}

if($pendingChanges.Count -gt 0){
  Write-Host "Staging local changes..." -ForegroundColor Yellow
  git add -A
  if($LASTEXITCODE -ne 0){
    Fail-Deploy "Deployment blocked: git add -A failed."
  }

  $stagedChanges = @(git diff --cached --name-only)
  if($LASTEXITCODE -ne 0){
    Fail-Deploy "Deployment blocked: unable to inspect staged changes."
  }

  if($stagedChanges.Count -eq 0){
    Write-Host "git status still shows changes, but nothing was staged:" -ForegroundColor Red
    git status --short
    Fail-Deploy "Deployment blocked: staging did not capture local changes."
  }

  Write-Host "Committing $($stagedChanges.Count) file(s)..." -ForegroundColor Yellow
  git commit -m $msg
  if($LASTEXITCODE -ne 0){
    Fail-Deploy "Deployment blocked: git commit failed."
  }
}
else {
  Write-Host "No local changes to commit." -ForegroundColor Yellow
}

git push
if($LASTEXITCODE -ne 0){
  Fail-Deploy "Deployment blocked: git push failed."
}

Write-Host "`n=== Firebase ===" -ForegroundColor Cyan
& $firebase deploy --only hosting,database
if($LASTEXITCODE -ne 0){
  Fail-Deploy "Deployment blocked: Firebase deploy failed."
}
