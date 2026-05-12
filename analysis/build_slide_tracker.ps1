param(
  [string]$InputPath = "analysis\data\firebase-export.json",
  [string]$OutputDir = "analysis\output",
  [int]$Year = 2026
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Num($Value) {
  if ($null -eq $Value -or $Value -eq "") { return 0.0 }
  return [double]$Value
}

function Get-Field($Object, [string]$Name, $Default = $null) {
  if ($null -eq $Object) { return $Default }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop) { return $Default }
  return $prop.Value
}

function Sum-Prop($Items, [string]$PropertyName) {
  $values = @($Items | ForEach-Object { Get-Field $_ $PropertyName 0 })
  if ($values.Count -eq 0) { return 0.0 }
  return ($values | Measure-Object -Sum).Sum
}

function Normalize-Status($Status) {
  $value = [string]$Status
  if ([string]::IsNullOrWhiteSpace($value)) { return "open" }
  $value = $value.Trim().ToLowerInvariant()
  switch ($value) {
    "inprogress" { return "in progress" }
    "in-progress" { return "in progress" }
    "in_progress" { return "in progress" }
    "progress" { return "in progress" }
    "wip" { return "in progress" }
    "complete" { return "done" }
    "completed" { return "done" }
    "closed" { return "done" }
    "finished" { return "done" }
    "resolved" { return "done" }
    default { return $value }
  }
}

function Get-TargetDate($Ticket) {
  $timelineEnd = [string](Get-Field $Ticket "timelineEnd" "")
  if (-not [string]::IsNullOrWhiteSpace($timelineEnd)) { return $timelineEnd }
  $deadline = [string](Get-Field $Ticket "deadline" "")
  if (-not [string]::IsNullOrWhiteSpace($deadline)) { return $deadline }
  return ""
}

function Get-GoLiveMonth($TargetDate) {
  if ([string]::IsNullOrWhiteSpace($TargetDate)) { return "" }
  return (Get-Date $TargetDate).ToString("MMM ''yy")
}

function Normalize-Name($Value, [string]$Default = "Other") {
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return $Default }
  return $text.Trim()
}

function Normalize-TeamName($Value) {
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return "" }
  $trimmed = $text.Trim()
  if ($trimmed.ToLowerInvariant() -eq "other") { return "" }
  return $trimmed
}

function Get-SupportingTeams($Ticket) {
  $teams = @()
  $supportingTeams = Get-Field $Ticket "supportingTeams" @()
  if ($null -ne $supportingTeams) {
    foreach ($team in $supportingTeams) {
      if (-not [string]::IsNullOrWhiteSpace([string]$team)) { $teams += [string]$team }
    }
  }
  return ($teams -join "; ")
}

if (-not (Test-Path $InputPath)) {
  throw "Input file not found: $InputPath"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$root = Get-Content $InputPath -Raw | ConvertFrom-Json

$subteamSizes = @{}
$teamFallbackSizes = @{}
$teamHasExplicitSize = @{}
$teamReviewedCoverage = @{}
$allTeams = New-Object System.Collections.Generic.HashSet[string]
$allSubteamKeys = New-Object System.Collections.Generic.HashSet[string]
$subteamDisplayNames = @{}

function Get-SubteamKey($Team, $Subteam) {
  return ((Normalize-TeamName $Team).ToLowerInvariant() + "|" + (Normalize-Name $Subteam "Other").ToLowerInvariant())
}

if ($null -ne $root.automationSubteams) {
  @($root.automationSubteams.PSObject.Properties) | ForEach-Object {
    $sub = $_.Value
    if ([bool](Get-Field $sub "deleted" $false)) { return }
    $teamName = Normalize-TeamName (Get-Field $sub "teamName" "")
    $subteamName = Normalize-Name (Get-Field $sub "name" "") "Other"
    if ([string]::IsNullOrWhiteSpace($teamName)) { return }
    $key = Get-SubteamKey $teamName $subteamName
    $size = Get-Field $sub "subteamSizeHc" $null
    if ($null -eq $size -or $size -eq "") { $size = Get-Field $sub "currentHc" 0 }
    $sizeNum = Num $size
    $subteamSizes[$key] = $sizeNum
    $subteamDisplayNames[$key] = [pscustomobject]@{ Team = $teamName; Subteam = $subteamName }
    [void]$allTeams.Add($teamName)
    [void]$allSubteamKeys.Add($key)
    if (-not $teamReviewedCoverage.ContainsKey($teamName)) { $teamReviewedCoverage[$teamName] = 0.0 }
    if ([bool](Get-Field $sub "automationReviewed" $false)) {
      $teamReviewedCoverage[$teamName] = [double]$teamReviewedCoverage[$teamName] + $sizeNum
    }
  }
}

if ($null -ne $root.automationTeams) {
  @($root.automationTeams.PSObject.Properties) | ForEach-Object {
    $team = $_.Value
    if ([bool](Get-Field $team "deleted" $false)) { return }
    $name = Normalize-TeamName (Get-Field $team "name" "")
    if ([string]::IsNullOrWhiteSpace($name)) { return }
    $size = Get-Field $team "teamSizeHc" $null
    if ($null -eq $size -or $size -eq "") { $size = Get-Field $team "currentHc" $null }
    $hasExplicitSize = -not ($null -eq $size -or $size -eq "")
    $teamFallbackSizes[$name] = $(if ($hasExplicitSize) { Num $size } else { 0.0 })
    $teamHasExplicitSize[$name] = $hasExplicitSize
    [void]$allTeams.Add($name)
  }
}

function Get-SubteamCurrentHc($Team, $Subteam) {
  $teamName = Normalize-TeamName $Team
  $subteamName = Normalize-Name $Subteam "Other"
  if ([string]::IsNullOrWhiteSpace($teamName)) { return 0.0 }
  $key = Get-SubteamKey $teamName $subteamName
  if ($subteamSizes.ContainsKey($key)) { return [double]$subteamSizes[$key] }
  return 0.0
}

function Get-TeamCurrentHc($Team) {
  $teamName = Normalize-TeamName $Team
  if ([string]::IsNullOrWhiteSpace($teamName)) { return "" }
  if ($teamHasExplicitSize.ContainsKey($teamName) -and [bool]$teamHasExplicitSize[$teamName]) {
    return [double]$teamFallbackSizes[$teamName]
  }
  $sum = 0.0
  foreach ($key in $subteamSizes.Keys) {
    if ($key.StartsWith($teamName.ToLowerInvariant() + "|")) {
      $sum += [double]$subteamSizes[$key]
    }
  }
  if ($sum -eq 0 -and $teamFallbackSizes.ContainsKey($teamName)) { return [double]$teamFallbackSizes[$teamName] }
  return $sum
}

$sprintEntries = @()
if ($null -ne $root.sprintProjects) {
  $sprintEntries = @($root.sprintProjects.PSObject.Properties | ForEach-Object {
    $ticket = $_.Value
    $scoped = Num (Get-Field $ticket "automationScopedHc" 0)
    $actual = Num (Get-Field $ticket "actualHcSavings" 0)
    $excess = Num (Get-Field $ticket "excessCapacityHc" 0)
    $totalOutcome = $actual + $excess
    $status = Normalize-Status (Get-Field $ticket "status" "open")
    $targetDate = Get-TargetDate $ticket
    [pscustomobject]@{
      Id = $_.Name
      Title = [string](Get-Field $ticket "title" "")
      Team = Normalize-TeamName (Get-Field $ticket "teamArea" "")
      Subteam = Normalize-Name (Get-Field $ticket "subteam" "") "Other"
      Owner = [string](Get-Field $ticket "assignee" "")
      Status = $status
      Stage = [string](Get-Field $ticket "stage" "")
      Confidence = [string](Get-Field $ticket "confidence" "")
      Priority = [string](Get-Field $ticket "priority" "")
      ScopedHC = $scoped
      ActualizedHC = $actual
      ExcessHC = $excess
      CompletionOutcomeHC = $totalOutcome
      TargetDate = $targetDate
      GoLiveMonth = Get-GoLiveMonth $targetDate
      NextAction = [string](Get-Field $ticket "nextAction" "")
      SupportingTeams = Get-SupportingTeams $ticket
    }
  })
}

$allInitiativeEntries = @($sprintEntries)
foreach ($entry in $allInitiativeEntries) {
  if (-not [string]::IsNullOrWhiteSpace($entry.Team)) { [void]$allTeams.Add($entry.Team) }
}

$hcEntries = @($allInitiativeEntries | Where-Object {
  $_.ScopedHC -gt 0 -or $_.ActualizedHC -gt 0 -or $_.ExcessHC -gt 0
})

$latestActivity = ""
if ($null -ne $root.activity) {
  $tsValues = @($root.activity.PSObject.Properties | ForEach-Object { [double]($_.Value.ts) })
  if ($tsValues.Count -gt 0) {
    $latestTs = ($tsValues | Measure-Object -Maximum).Maximum
    $latestActivity = [DateTimeOffset]::FromUnixTimeMilliseconds([int64]$latestTs).ToString("yyyy-MM-dd HH:mm")
  }
}

$activeHcEntries = @($hcEntries | Where-Object { $_.Status -ne "done" })
$doneHcEntries = @($hcEntries | Where-Object { $_.Status -eq "done" })
$inProgressScoped = ($hcEntries | Where-Object { $_.Status -eq "in progress" } | Measure-Object -Property ScopedHC -Sum).Sum
$withTargetDate = @($hcEntries | Where-Object { -not [string]::IsNullOrWhiteSpace($_.TargetDate) })
$withoutTargetDate = @($hcEntries | Where-Object { [string]::IsNullOrWhiteSpace($_.TargetDate) })

$summaryRows = @(
  [pscustomobject]@{ Metric = "Snapshot date"; Value = (Get-Date).ToString("yyyy-MM-dd") }
  [pscustomobject]@{ Metric = "Latest activity in export"; Value = $latestActivity }
  [pscustomobject]@{ Metric = "HC-backed initiatives"; Value = $hcEntries.Count }
  [pscustomobject]@{ Metric = "Active HC-backed initiatives"; Value = $activeHcEntries.Count }
  [pscustomobject]@{ Metric = "Completed HC-backed initiatives"; Value = $doneHcEntries.Count }
  [pscustomobject]@{ Metric = "Total scoped for automation HC"; Value = (Sum-Prop $hcEntries "ScopedHC") }
  [pscustomobject]@{ Metric = "Total actualized HC"; Value = (Sum-Prop $hcEntries "ActualizedHC") }
  [pscustomobject]@{ Metric = "Total excess HC kept"; Value = (Sum-Prop $hcEntries "ExcessHC") }
  [pscustomobject]@{ Metric = "Total completion outcome HC"; Value = (Sum-Prop $hcEntries "CompletionOutcomeHC") }
  [pscustomobject]@{ Metric = "In-progress scoped for automation HC"; Value = $inProgressScoped }
  [pscustomobject]@{ Metric = "HC-backed initiatives with target date"; Value = $withTargetDate.Count }
  [pscustomobject]@{ Metric = "HC-backed initiatives without target date"; Value = $withoutTargetDate.Count }
)

$versionHistoryRows = @(
  [pscustomobject]@{
    VersionLabel = "Current Firebase Snapshot"
    SnapshotDate = (Get-Date).ToString("yyyyMMdd")
    TotalScopedForAutomationHC = (Sum-Prop $hcEntries "ScopedHC")
    TotalActualizedHC = (Sum-Prop $hcEntries "ActualizedHC")
    TotalExcessHC = (Sum-Prop $hcEntries "ExcessHC")
    TotalCompletionOutcomeHC = (Sum-Prop $hcEntries "CompletionOutcomeHC")
    InProgressScopedHC = $inProgressScoped
    Notes = "Add prior V1/V2/V3 rows manually if needed; Firebase export only contains current-state data."
  }
)

$monthRows = @()
for ($month = 1; $month -le 12; $month++) {
  $monthKey = "{0:D4}-{1:D2}" -f $Year, $month
  $monthLabel = (Get-Date ("{0}-01" -f $monthKey)).ToString("MMM ''yy")
  $items = @($hcEntries | Where-Object { $_.TargetDate -like "$monthKey-*" })
  $monthRows += [pscustomobject]@{
    Month = $monthLabel
    MonthKey = $monthKey
    InitiativeCount = $items.Count
    ScopedHC = (Sum-Prop $items "ScopedHC")
    ActualizedHC = (Sum-Prop $items "ActualizedHC")
    ExcessHC = (Sum-Prop $items "ExcessHC")
    CompletionOutcomeHC = (Sum-Prop $items "CompletionOutcomeHC")
    Initiatives = (($items | Sort-Object Title | Select-Object -ExpandProperty Title) -join "; ")
  }
}

$teamRows = @($hcEntries | Group-Object Team | Sort-Object Name | ForEach-Object {
  $items = @($_.Group)
  [pscustomobject]@{
    Team = $_.Name
    TeamCurrentHC = (Get-TeamCurrentHc $_.Name)
    HCInitiatives = $items.Count
    ActiveInitiatives = @($items | Where-Object { $_.Status -ne "done" }).Count
    DoneInitiatives = @($items | Where-Object { $_.Status -eq "done" }).Count
    TotalScopedForAutomationHC = (Sum-Prop $items "ScopedHC")
    InProgressScopedHC = (Sum-Prop @($items | Where-Object { $_.Status -eq "in progress" }) "ScopedHC")
    ActualizedHC = (Sum-Prop $items "ActualizedHC")
    ExcessHC = (Sum-Prop $items "ExcessHC")
    CompletionOutcomeHC = (Sum-Prop $items "CompletionOutcomeHC")
    UnassignedInitiatives = @($items | Where-Object { [string]::IsNullOrWhiteSpace($_.Owner) -or $_.Owner -eq "Unassigned" }).Count
  }
})

$initiativeRows = @($allInitiativeEntries |
  Sort-Object @{ Expression = { if ($_.TargetDate) { [datetime]::Parse($_.TargetDate) } else { [datetime]::MaxValue } } },
              @{ Expression = { -1 * $_.ScopedHC } },
              @{ Expression = { $_.Title } } |
  Select-Object Title, Team, Subteam, Owner, Status, Stage, Confidence, Priority,
                ScopedHC, ActualizedHC, ExcessHC, CompletionOutcomeHC,
                TargetDate, GoLiveMonth, NextAction, SupportingTeams)

$snapshotDate = (Get-Date).ToString("yyyy-MM-dd")
$rawRows = @()

$sortedSubteamKeys = @($allSubteamKeys |
  Sort-Object {
    $display = $subteamDisplayNames[[string]$_]
    "{0}|{1}" -f $display.Team, $display.Subteam
  })

$lastBaselineTeam = $null
$rawRows += @($sortedSubteamKeys | ForEach-Object {
  $display = $subteamDisplayNames[[string]$_]
  $teamName = if ($null -ne $display -and -not [string]::IsNullOrWhiteSpace($display.Team)) { $display.Team } else { "Other" }
  $subteamName = if ($null -ne $display -and -not [string]::IsNullOrWhiteSpace($display.Subteam)) { $display.Subteam } else { "Other" }
  $teamCurrentHcValue = if ($teamName -ne $lastBaselineTeam) { Get-TeamCurrentHc $teamName } else { "" }
  $lastBaselineTeam = $teamName
  [pscustomobject]@{
    SnapshotDate = $snapshotDate
    RowType = "SUBTEAM"
    InitiativeId = ""
    Title = ""
    Team = $teamName
    Subteam = $subteamName
    Owner = ""
    Status = ""
    Stage = ""
    Confidence = ""
    Priority = ""
    TeamCurrentHC = $teamCurrentHcValue
    SubteamCurrentHC = (Get-SubteamCurrentHc $teamName $subteamName)
    ScopedForAutomationHC = 0
    ActualizedHC = 0
    ExcessCapacityKeptHC = 0
    CompletionOutcomeHC = 0
    TargetDate = ""
    TargetMonth = ""
    TargetMonthSort = ""
    IsActive = 0
    IsDone = 0
    IsInProgress = 0
    HasTargetDate = 0
    IsUnassigned = 0
    NextAction = ""
    SupportingTeams = ""
  }
})

$rawRows += @($allInitiativeEntries |
  Sort-Object @{ Expression = { if ($_.TargetDate) { [datetime]::Parse($_.TargetDate) } else { [datetime]::MaxValue } } },
              @{ Expression = { -1 * $_.ScopedHC } },
              @{ Expression = { $_.Title } } |
  ForEach-Object {
    [pscustomobject]@{
      SnapshotDate = $snapshotDate
      RowType = "INITIATIVE"
      InitiativeId = $_.Id
      Title = $_.Title
      Team = $_.Team
      Subteam = $_.Subteam
      Owner = $_.Owner
      Status = $_.Status
      Stage = $_.Stage
      Confidence = $_.Confidence
      Priority = $_.Priority
      TeamCurrentHC = ""
      SubteamCurrentHC = ""
      ScopedForAutomationHC = $_.ScopedHC
      ActualizedHC = $_.ActualizedHC
      ExcessCapacityKeptHC = $_.ExcessHC
      CompletionOutcomeHC = $_.CompletionOutcomeHC
      TargetDate = $_.TargetDate
      TargetMonth = $_.GoLiveMonth
      TargetMonthSort = $(if ($_.TargetDate) { (Get-Date $_.TargetDate).ToString("yyyy-MM") } else { "" })
      IsActive = $(if ($_.Status -ne "done") { 1 } else { 0 })
      IsDone = $(if ($_.Status -eq "done") { 1 } else { 0 })
      IsInProgress = $(if ($_.Status -eq "in progress") { 1 } else { 0 })
      HasTargetDate = $(if ([string]::IsNullOrWhiteSpace($_.TargetDate)) { 0 } else { 1 })
      IsUnassigned = $(if ([string]::IsNullOrWhiteSpace($_.Owner) -or $_.Owner -eq "Unassigned") { 1 } else { 0 })
      NextAction = $_.NextAction
      SupportingTeams = $_.SupportingTeams
    }
  })

$assumptionRows = @(
  [pscustomobject]@{ Assumption = "Scoped for automation HC"; Detail = "Mapped from sprintProjects.automationScopedHc." }
  [pscustomobject]@{ Assumption = "Actualized HC"; Detail = "Mapped from sprintProjects.actualHcSavings." }
  [pscustomobject]@{ Assumption = "Excess HC kept"; Detail = "Mapped from sprintProjects.excessCapacityHc." }
  [pscustomobject]@{ Assumption = "Go-live month"; Detail = "Mapped from timelineEnd first, then deadline when timelineEnd is blank." }
  [pscustomobject]@{ Assumption = "Included initiatives"; Detail = "Raw output includes all sprint initiatives and adds one SUBTEAM baseline row per team/subteam pair, even when HC fields are zero." }
  [pscustomobject]@{ Assumption = "Historical V1/V2/V3 rows"; Detail = "Not reconstructed from Firebase because the export only contains current-state data, not historical snapshots." }
)

$rawRows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutputDir "slide_tracker_raw.csv")

Write-Host "Wrote tracker raw CSV to $OutputDir" -ForegroundColor Green
