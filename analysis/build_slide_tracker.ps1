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
      Team = [string](Get-Field $ticket "teamArea" "")
      Subteam = [string](Get-Field $ticket "subteam" "")
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

$hcEntries = @($sprintEntries | Where-Object {
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
  [pscustomobject]@{ Metric = "Total aligned HC (scoped)"; Value = (Sum-Prop $hcEntries "ScopedHC") }
  [pscustomobject]@{ Metric = "Total actualized HC"; Value = (Sum-Prop $hcEntries "ActualizedHC") }
  [pscustomobject]@{ Metric = "Total excess HC kept"; Value = (Sum-Prop $hcEntries "ExcessHC") }
  [pscustomobject]@{ Metric = "Total completion outcome HC"; Value = (Sum-Prop $hcEntries "CompletionOutcomeHC") }
  [pscustomobject]@{ Metric = "In-progress scoped HC"; Value = $inProgressScoped }
  [pscustomobject]@{ Metric = "HC-backed initiatives with target date"; Value = $withTargetDate.Count }
  [pscustomobject]@{ Metric = "HC-backed initiatives without target date"; Value = $withoutTargetDate.Count }
)

$versionHistoryRows = @(
  [pscustomobject]@{
    VersionLabel = "Current Firebase Snapshot"
    SnapshotDate = (Get-Date).ToString("yyyyMMdd")
    TotalAlignedHC = (Sum-Prop $hcEntries "ScopedHC")
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
    HCInitiatives = $items.Count
    ActiveInitiatives = @($items | Where-Object { $_.Status -ne "done" }).Count
    DoneInitiatives = @($items | Where-Object { $_.Status -eq "done" }).Count
    TotalAlignedHC = (Sum-Prop $items "ScopedHC")
    InProgressScopedHC = (Sum-Prop @($items | Where-Object { $_.Status -eq "in progress" }) "ScopedHC")
    ActualizedHC = (Sum-Prop $items "ActualizedHC")
    ExcessHC = (Sum-Prop $items "ExcessHC")
    CompletionOutcomeHC = (Sum-Prop $items "CompletionOutcomeHC")
    UnassignedInitiatives = @($items | Where-Object { [string]::IsNullOrWhiteSpace($_.Owner) -or $_.Owner -eq "Unassigned" }).Count
  }
})

$initiativeRows = @($hcEntries |
  Sort-Object @{ Expression = { if ($_.TargetDate) { [datetime]::Parse($_.TargetDate) } else { [datetime]::MaxValue } } },
              @{ Expression = { -1 * $_.ScopedHC } },
              @{ Expression = { $_.Title } } |
  Select-Object Title, Team, Subteam, Owner, Status, Stage, Confidence, Priority,
                ScopedHC, ActualizedHC, ExcessHC, CompletionOutcomeHC,
                TargetDate, GoLiveMonth, NextAction, SupportingTeams)

$snapshotDate = (Get-Date).ToString("yyyy-MM-dd")
$rawRows = @($hcEntries |
  Sort-Object @{ Expression = { if ($_.TargetDate) { [datetime]::Parse($_.TargetDate) } else { [datetime]::MaxValue } } },
              @{ Expression = { -1 * $_.ScopedHC } },
              @{ Expression = { $_.Title } } |
  ForEach-Object {
    [pscustomobject]@{
      SnapshotDate = $snapshotDate
      InitiativeId = $_.Id
      Title = $_.Title
      Team = $_.Team
      Subteam = $_.Subteam
      Owner = $_.Owner
      Status = $_.Status
      Stage = $_.Stage
      Confidence = $_.Confidence
      Priority = $_.Priority
      AlignedHC = $_.ScopedHC
      ActualizedHC = $_.ActualizedHC
      ExcessHC = $_.ExcessHC
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
  [pscustomobject]@{ Assumption = "Aligned HC"; Detail = "Mapped from sprintProjects.automationScopedHc." }
  [pscustomobject]@{ Assumption = "Actualized HC"; Detail = "Mapped from sprintProjects.actualHcSavings." }
  [pscustomobject]@{ Assumption = "Excess HC kept"; Detail = "Mapped from sprintProjects.excessCapacityHc." }
  [pscustomobject]@{ Assumption = "Go-live month"; Detail = "Mapped from timelineEnd first, then deadline when timelineEnd is blank." }
  [pscustomobject]@{ Assumption = "Included initiatives"; Detail = "Only initiatives with scoped, actualized, or excess HC greater than zero are included in the slide tracker outputs." }
  [pscustomobject]@{ Assumption = "Historical V1/V2/V3 rows"; Detail = "Not reconstructed from Firebase because the export only contains current-state data, not historical snapshots." }
)

$summaryRows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutputDir "slide_tracker_exec_summary.csv")
$versionHistoryRows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutputDir "slide_tracker_version_history_template.csv")
$monthRows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutputDir "slide_tracker_go_live_by_month.csv")
$teamRows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutputDir "slide_tracker_team_rollup.csv")
$initiativeRows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutputDir "slide_tracker_initiatives.csv")
$rawRows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutputDir "slide_tracker_raw.csv")
$assumptionRows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutputDir "slide_tracker_assumptions.csv")

Write-Host "Wrote tracker CSVs to $OutputDir" -ForegroundColor Green
