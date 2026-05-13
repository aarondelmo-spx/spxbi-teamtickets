param(
  [string]$msg = ("deploy " + (Get-Date -Format "yyyy-MM-dd HH:mm"))
)

$projectDir = $PSScriptRoot
$firebase = Join-Path $env:LOCALAPPDATA "npm\firebase.cmd"

Set-Location $projectDir

function Fail-Deploy([string]$message) {
  Write-Host $message -ForegroundColor Red
  exit 1
}

function Invoke-Git([string[]]$Arguments, [string]$errorMessage) {
  & git @Arguments
  if($LASTEXITCODE -ne 0){
    Fail-Deploy $errorMessage
  }
}

function Get-GitOutput([string[]]$Arguments, [string]$errorMessage) {
  $output = & git @Arguments
  if($LASTEXITCODE -ne 0){
    Fail-Deploy $errorMessage
  }
  return $output
}

function Get-RevisionCount([string]$Range, [string]$errorMessage) {
  $countText = Get-GitOutput @("rev-list", "--count", $Range) $errorMessage
  return [int]($countText | Select-Object -First 1)
}

function Get-WorktreeChanges() {
  $pendingChanges = @(Get-GitOutput @("status", "--porcelain=v1") "Deployment blocked: unable to read git status.")
  return $pendingChanges
}

function Assert-NoUnmergedChanges() {
  $unmerged = @(Get-WorktreeChanges | Where-Object { $_ -match '^(AA|AU|DD|DU|UA|UD|UU) ' })
  if($unmerged.Count -gt 0){
    Write-Host "Unmerged changes detected:" -ForegroundColor Red
    $unmerged | ForEach-Object { Write-Host $_ }
    Fail-Deploy "Deployment blocked: resolve merge conflicts before deploying."
  }
}

function Assert-OnMain() {
  $branch = (Get-GitOutput @("branch", "--show-current") "Deployment blocked: unable to determine the current branch." | Select-Object -First 1).Trim()
  if([string]::IsNullOrWhiteSpace($branch)){
    Fail-Deploy "Deployment blocked: current branch could not be determined."
  }
  if($branch -ne "main"){
    Fail-Deploy "Deployment blocked: deploy.ps1 only runs from main. Current branch: $branch"
  }
}

function Sync-MainWithOrigin() {
  Write-Host "Fetching origin/main..." -ForegroundColor Yellow
  Invoke-Git @("fetch", "origin", "main") "Deployment blocked: git fetch origin main failed."
  Invoke-Git @("rev-parse", "--verify", "origin/main") "Deployment blocked: origin/main is unavailable after fetch."

  $aheadCount = Get-RevisionCount "origin/main..HEAD" "Deployment blocked: unable to compare HEAD to origin/main."
  $behindCount = Get-RevisionCount "HEAD..origin/main" "Deployment blocked: unable to compare origin/main to HEAD."

  if($aheadCount -gt 0 -and $behindCount -gt 0){
    Fail-Deploy "Deployment blocked: local main has diverged from origin/main. Merge or rebase manually before deploying."
  }

  if($aheadCount -gt 0){
    Write-Host "Local main is ahead of origin/main by $aheadCount commit(s)." -ForegroundColor Red
    Fail-Deploy "Deployment blocked: deploy only from landed main. Push or merge your commits first."
  }

  if($behindCount -gt 0){
    Write-Host "Fast-forwarding local main to origin/main ($behindCount commit(s) behind)..." -ForegroundColor Yellow
    Invoke-Git @("merge", "--ff-only", "origin/main") "Deployment blocked: could not fast-forward local main to origin/main."
  }
}

function Commit-LocalChangesIfAny() {
  $pendingChanges = @(Get-WorktreeChanges)
  if($pendingChanges.Count -eq 0){
    Write-Host "No local changes to commit." -ForegroundColor Yellow
    return
  }

  Write-Host "`n=== Commit ===" -ForegroundColor Cyan
  git status --short

  Invoke-Git @("add", "-A") "Deployment blocked: git add -A failed."
  $stagedChanges = @(Get-GitOutput @("diff", "--cached", "--name-only") "Deployment blocked: unable to inspect staged changes.")
  if($stagedChanges.Count -eq 0){
    Fail-Deploy "Deployment blocked: changes were detected but nothing was staged."
  }

  Write-Host "Committing $($stagedChanges.Count) file(s)..." -ForegroundColor Yellow
  Invoke-Git @("commit", "-m", $msg) "Deployment blocked: git commit failed."
}

function Show-ReleaseSummary() {
  Write-Host "`n=== Release ===" -ForegroundColor Cyan
  Invoke-Git @("log", "--oneline", "--decorate", "-5") "Deployment blocked: unable to show recent commits."
}

function Run-PreflightTests() {
  Write-Host "`n=== Tests ===" -ForegroundColor Cyan
  $testDir = Join-Path $projectDir "tests"
  $testFiles = @()
  if(Test-Path $testDir){
    $testFiles = @(Get-ChildItem -Path $testDir -Filter "*.test.js" -File | Sort-Object Name)
  }

  if($testFiles.Count -eq 0){
    Write-Host "No tests/*.test.js files found. Skipping scripted test run." -ForegroundColor Yellow
    return
  }

  foreach($testFile in $testFiles){
    Write-Host "Running $($testFile.Name)..." -ForegroundColor Yellow
    & node $testFile.FullName
    if($LASTEXITCODE -ne 0){
      Fail-Deploy "Deployment blocked: $($testFile.Name) failed."
    }
  }
}

function Push-MainToOrigin() {
  Write-Host "`n=== Push ===" -ForegroundColor Cyan
  Invoke-Git @("fetch", "origin", "main") "Deployment blocked: final git fetch origin main failed."

  $aheadCount = Get-RevisionCount "origin/main..HEAD" "Deployment blocked: unable to compare HEAD to origin/main before push."
  $behindCount = Get-RevisionCount "HEAD..origin/main" "Deployment blocked: unable to compare origin/main to HEAD before push."

  if($aheadCount -gt 0 -and $behindCount -gt 0){
    Fail-Deploy "Deployment blocked: main diverged from origin/main during preflight. Pull latest main and rerun deploy.ps1."
  }
  if($behindCount -gt 0){
    Fail-Deploy "Deployment blocked: origin/main changed during preflight. Pull latest main and rerun deploy.ps1."
  }
  if($aheadCount -eq 0){
    Write-Host "Main is already pushed to origin." -ForegroundColor Yellow
    return
  }

  Invoke-Git @("push", "origin", "main") "Deployment blocked: git push origin main failed."
}

Write-Host "`n=== Git ===" -ForegroundColor Cyan
(Get-GitOutput @("rev-parse", "--is-inside-work-tree") "Deployment blocked: current directory is not a git repository.") | Out-Null

if(-not (Test-Path $firebase)){
  Fail-Deploy "Deployment blocked: Firebase CLI not found at $firebase"
}

Assert-OnMain
Assert-NoUnmergedChanges
Sync-MainWithOrigin
Run-PreflightTests
Commit-LocalChangesIfAny
Show-ReleaseSummary
Push-MainToOrigin

Write-Host "`n=== Firebase ===" -ForegroundColor Cyan
& $firebase deploy --only hosting,database
if($LASTEXITCODE -ne 0){
  Fail-Deploy "Deployment blocked: Firebase deploy failed."
}
