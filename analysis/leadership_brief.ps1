[CmdletBinding()]
param(
  [string]$InputPath = "analysis\data\firebase-export.json",
  [string]$OutputPath = "analysis\output\leadership-context.md",
  [int]$Weeks = 5,
  [int]$RecentActivityLimit = 25,
  [int]$MaxInitiatives = 80,
  [int]$MaxTasks = 80,
  [switch]$IncludeMainProjects
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Today = (Get-Date).Date

function Resolve-AnalysisPath {
  param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path $RepoRoot $Path)
}

function Get-Field {
  param($Object, [string]$Name, $Default = $null)
  if ($null -eq $Object) { return $Default }
  if ($Object -is [System.Collections.IDictionary]) {
    if ($Object.Contains($Name) -and $null -ne $Object[$Name]) { return $Object[$Name] }
    return $Default
  }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop -or $null -eq $prop.Value) { return $Default }
  return $prop.Value
}

function Get-Entries {
  param($Object)
  if ($null -eq $Object) { return @() }
  if ($Object -is [System.Collections.IDictionary]) {
    return @($Object.Keys | ForEach-Object {
      [pscustomobject]@{ Id = [string]$_; Value = $Object[$_] }
    })
  }
  return @($Object.PSObject.Properties | ForEach-Object {
    [pscustomobject]@{ Id = $_.Name; Value = $_.Value }
  })
}

function Get-ValueList {
  param($Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [string]) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return @() }
    return @($Value)
  }
  if ($Value -is [System.Array]) { return @($Value) }
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [System.Management.Automation.PSCustomObject])) {
    return @($Value)
  }
  return @(Get-Entries $Value | ForEach-Object { $_.Value })
}

function Get-StringList {
  param($Value)
  return @(Get-ValueList $Value | ForEach-Object { [string]$_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Get-NullableNumber {
  param($Value)
  if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return $null }
  $n = 0.0
  $style = [System.Globalization.NumberStyles]::Any
  $culture = [System.Globalization.CultureInfo]::InvariantCulture
  if ([double]::TryParse([string]$Value, $style, $culture, [ref]$n)) { return $n }
  return $null
}

function Get-Number {
  param($Value)
  $n = Get-NullableNumber $Value
  if ($null -eq $n) { return 0.0 }
  return $n
}

function Format-Capacity {
  param($Value)
  $n = Get-Number $Value
  if ([math]::Abs($n - [math]::Round($n)) -lt 0.001) { return [string]([int][math]::Round($n)) }
  return $n.ToString("0.0", [System.Globalization.CultureInfo]::InvariantCulture)
}

function Parse-DateOnly {
  param($Value)
  if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return $null }
  $date = [datetime]::MinValue
  $ok = [datetime]::TryParseExact(
    [string]$Value,
    "yyyy-MM-dd",
    [System.Globalization.CultureInfo]::InvariantCulture,
    [System.Globalization.DateTimeStyles]::None,
    [ref]$date
  )
  if ($ok) { return $date.Date }
  return $null
}

function Format-UnixMs {
  param($Value)
  $n = Get-NullableNumber $Value
  if ($null -eq $n) { return "" }
  try {
    return [System.DateTimeOffset]::FromUnixTimeMilliseconds([int64]$n).LocalDateTime.ToString("yyyy-MM-dd HH:mm")
  } catch {
    return ""
  }
}

function Short-Id {
  param([string]$Id)
  if ([string]::IsNullOrWhiteSpace($Id)) { return "" }
  if ($Id.Length -le 6) { return $Id.ToUpperInvariant() }
  return $Id.Substring($Id.Length - 6).ToUpperInvariant()
}

function Normalize-Name {
  param($Value, [string]$Default = "Other")
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return $Default }
  return $text.Trim()
}

function Normalize-Status {
  param($Value)
  $status = [string]$Value
  if ([string]::IsNullOrWhiteSpace($status)) { return "open" }
  return $status.Trim().ToLowerInvariant()
}

function Get-AutomationScopedHc {
  param($Ticket)
  $explicit = Get-NullableNumber (Get-Field $Ticket "automationScopedHc")
  if ($null -ne $explicit) { return $explicit }
  return Get-Number (Get-Field $Ticket "scopedHc")
}

function Get-ActualHcSavings {
  param($Ticket)
  $explicit = Get-NullableNumber (Get-Field $Ticket "actualHcSavings")
  if ($null -ne $explicit) { return $explicit }
  return (Get-Number (Get-Field $Ticket "fteRepurpose")) + (Get-Number (Get-Field $Ticket "bpoNfteReduction"))
}

function Get-ExcessCapacityHc {
  param($Ticket)
  $explicit = Get-NullableNumber (Get-Field $Ticket "excessCapacityHc")
  if ($null -ne $explicit) { return $explicit }
  return Get-Number (Get-Field $Ticket "fteBuffer")
}

function Get-TaskEntriesForTicket {
  param([string]$TicketId, $Ticket)
  $workstreamNames = @{}
  Get-Entries (Get-Field $Ticket "workstreams") | ForEach-Object {
    $name = Normalize-Name (Get-Field $_.Value "name") "Group"
    $workstreamNames[$_.Id] = $name
  }

  return @(Get-Entries (Get-Field $Ticket "subtasks") | ForEach-Object {
    $task = $_.Value
    $contributors = @(Get-StringList (Get-Field $task "contributors"))
    $deadline = [string](Get-Field $task "deadline" "")
    $dueDate = Parse-DateOnly $deadline
    $daysUntil = $null
    if ($null -ne $dueDate) { $daysUntil = [int](($dueDate - $Today).TotalDays) }
    $workstreamId = [string](Get-Field $task "workstreamId" "")
    $workstream = "General"
    if (-not [string]::IsNullOrWhiteSpace($workstreamId) -and $workstreamNames.ContainsKey($workstreamId)) {
      $workstream = $workstreamNames[$workstreamId]
    }
    $owner = ""
    if ($contributors.Count -gt 0) { $owner = $contributors[0] }

    [pscustomobject]@{
      TicketId = $TicketId
      TaskId = $_.Id
      Text = [string](Get-Field $task "text" "Untitled task")
      Done = [bool](Get-Field $task "done" $false)
      Deadline = $deadline
      DueDate = $dueDate
      DaysUntil = $daysUntil
      Owner = $owner
      Contributors = $contributors
      Workstream = $workstream
      CreatedBy = [string](Get-Field $task "createdBy" "")
      Ts = Get-NullableNumber (Get-Field $task "ts")
    }
  })
}

function New-InitiativeRecord {
  param($Entry)
  $ticket = $Entry.Value
  $contributors = @(Get-StringList (Get-Field $ticket "contributors"))
  $tasks = @(Get-TaskEntriesForTicket $Entry.Id $ticket)
  $status = Normalize-Status (Get-Field $ticket "status" "open")
  $assignee = [string](Get-Field $ticket "assignee" "")
  if ([string]::IsNullOrWhiteSpace($assignee)) { $assignee = "Unassigned" }
  $owner = $assignee
  if (($owner -eq "Unassigned") -and $contributors.Count -gt 0) { $owner = $contributors[0] }
  $timelineStart = [string](Get-Field $ticket "timelineStart" "")
  $timelineEnd = [string](Get-Field $ticket "timelineEnd" "")
  $deadline = [string](Get-Field $ticket "deadline" "")
  $dueDate = Parse-DateOnly $(if ($timelineEnd) { $timelineEnd } else { $deadline })
  $daysUntil = $null
  if ($null -ne $dueDate) { $daysUntil = [int](($dueDate - $Today).TotalDays) }
  $scoped = Get-AutomationScopedHc $ticket
  $actual = Get-ActualHcSavings $ticket
  $excess = Get-ExcessCapacityHc $ticket

  [pscustomobject]@{
    Id = $Entry.Id
    ShortId = Short-Id $Entry.Id
    Title = [string](Get-Field $ticket "title" "Untitled initiative")
    Desc = [string](Get-Field $ticket "desc" "")
    Status = $status
    Priority = [string](Get-Field $ticket "priority" "p1")
    Owner = $owner
    Assignee = $assignee
    Contributors = $contributors
    Team = Normalize-Name (Get-Field $ticket "teamArea") "Other"
    Subteam = Normalize-Name (Get-Field $ticket "subteam") "Other"
    Stage = [string](Get-Field $ticket "stage" "")
    Confidence = [string](Get-Field $ticket "confidence" "")
    SprintCycle = [string](Get-Field $ticket "sprintCycle" "")
    TimelineStart = $timelineStart
    TimelineEnd = $timelineEnd
    Deadline = $deadline
    DueDate = $dueDate
    DaysUntil = $daysUntil
    Created = [string](Get-Field $ticket "created" "")
    CreatedTs = Get-NullableNumber (Get-Field $ticket "createdTs")
    ScopedHc = $scoped
    InProgressHc = $(if ($status -eq "in progress") { $scoped } else { 0.0 })
    ActualSavingsHc = $actual
    CountedSavingsHc = $(if ($status -eq "done") { $actual } else { 0.0 })
    ExcessCapacityHc = $excess
    Tasks = $tasks
    TaskTotal = $tasks.Count
    TaskDone = @($tasks | Where-Object { $_.Done }).Count
    TaskOpen = @($tasks | Where-Object { -not $_.Done }).Count
  }
}

function Format-MdCell {
  param($Value)
  $text = [string]$Value
  if ($null -eq $Value) { $text = "" }
  $text = $text -replace "\r?\n", " "
  $text = $text -replace "\|", "\|"
  return $text.Trim()
}

function Add-Line {
  param([string]$Line = "")
  $script:Lines.Add($Line) | Out-Null
}

function Add-Table {
  param([string[]]$Headers, [object[]]$Rows)
  if ($null -eq $Rows -or $Rows.Count -eq 0) {
    Add-Line "_None found._"
    Add-Line
    return
  }
  Add-Line ("| " + (($Headers | ForEach-Object { Format-MdCell $_ }) -join " | ") + " |")
  Add-Line ("| " + (($Headers | ForEach-Object { "---" }) -join " | ") + " |")
  foreach ($row in $Rows) {
    Add-Line ("| " + (($row | ForEach-Object { Format-MdCell $_ }) -join " | ") + " |")
  }
  Add-Line
}

$inputFullPath = Resolve-AnalysisPath $InputPath
$outputFullPath = Resolve-AnalysisPath $OutputPath
$outputDir = Split-Path -Parent $outputFullPath

if (-not (Test-Path $inputFullPath)) {
  throw "Input file not found: $inputFullPath. Export Firebase RTDB JSON there, or pass -InputPath."
}

if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$root = Get-Content -Raw -Path $inputFullPath | ConvertFrom-Json
$sprintTickets = Get-Field $root "sprintProjects"
$mainTickets = Get-Field $root "tickets"
$automationTeams = Get-Field $root "automationTeams"
$automationSubteams = Get-Field $root "automationSubteams"
$teamMembersRaw = Get-Field $root "team"
$activityRaw = Get-Field $root "activity"

$initiatives = @(Get-Entries $sprintTickets | ForEach-Object { New-InitiativeRecord $_ })
$mainProjectCount = @(Get-Entries $mainTickets).Count
$teamMemberCount = @(Get-Entries $teamMembersRaw).Count
$taskRows = @()
foreach ($initiative in $initiatives) {
  foreach ($task in $initiative.Tasks) {
    $taskRows += [pscustomobject]@{
      Initiative = $initiative
      Task = $task
    }
  }
}

$openInitiatives = @($initiatives | Where-Object { $_.Status -ne "done" })
$doneInitiatives = @($initiatives | Where-Object { $_.Status -eq "done" })
$inProgressInitiatives = @($initiatives | Where-Object { $_.Status -eq "in progress" })
$openTasks = @($taskRows | Where-Object { -not $_.Task.Done })
$doneTasks = @($taskRows | Where-Object { $_.Task.Done })
$overdueTasks = @($openTasks | Where-Object { $null -ne $_.Task.DaysUntil -and $_.Task.DaysUntil -lt 0 } | Sort-Object { $_.Task.DaysUntil })
$windowEnd = $Today.AddDays(($Weeks * 7) - 1)
$upcomingTasks = @($openTasks | Where-Object {
  $null -ne $_.Task.DueDate -and $_.Task.DueDate -ge $Today -and $_.Task.DueDate -le $windowEnd
} | Sort-Object { $_.Task.DueDate })
$unassignedInitiatives = @($openInitiatives | Where-Object { [string]::IsNullOrWhiteSpace($_.Owner) -or $_.Owner -eq "Unassigned" })
$unassignedTasks = @($openTasks | Where-Object { [string]::IsNullOrWhiteSpace($_.Task.Owner) })
$lowConfidence = @($openInitiatives | Where-Object { ([string]$_.Confidence).ToLowerInvariant() -eq "low" })
$missingTimeline = @($openInitiatives | Where-Object {
  [string]::IsNullOrWhiteSpace($_.TimelineStart) -and
  [string]::IsNullOrWhiteSpace($_.TimelineEnd) -and
  [string]::IsNullOrWhiteSpace($_.Deadline)
})
$noOpenTasks = @($openInitiatives | Where-Object { $_.TaskOpen -eq 0 })

$subteamSizes = @{}
$subteamReviewed = @{}
Get-Entries $automationSubteams | ForEach-Object {
  $sub = $_.Value
  if ([bool](Get-Field $sub "deleted" $false)) { return }
  $teamName = Normalize-Name (Get-Field $sub "teamName") "Other"
  $subteamName = Normalize-Name (Get-Field $sub "name") "Other"
  $key = ($teamName.ToLowerInvariant() + "|" + $subteamName.ToLowerInvariant())
  $size = Get-NullableNumber (Get-Field $sub "subteamSizeHc")
  if ($null -eq $size) { $size = Get-NullableNumber (Get-Field $sub "currentHc") }
  if ($null -ne $size) { $subteamSizes[$key] = $size }
  if ([bool](Get-Field $sub "automationReviewed" $false)) { $subteamReviewed[$key] = $true }
}

$teamFallbackSizes = @{}
Get-Entries $automationTeams | ForEach-Object {
  $team = $_.Value
  if ([bool](Get-Field $team "deleted" $false)) { return }
  $name = Normalize-Name (Get-Field $team "name") "Other"
  $size = Get-NullableNumber (Get-Field $team "teamSizeHc")
  if ($null -eq $size) { $size = Get-NullableNumber (Get-Field $team "currentHc") }
  if ($null -ne $size) { $teamFallbackSizes[$name.ToLowerInvariant()] = $size }
}

$teamSummaries = @()
foreach ($teamGroup in ($initiatives | Group-Object Team | Sort-Object Name)) {
  $items = @($teamGroup.Group)
  $teamKey = $teamGroup.Name.ToLowerInvariant()
  $teamSubteamKeys = @($subteamSizes.Keys | Where-Object { $_.StartsWith($teamKey + "|") })
  $teamSize = 0.0
  foreach ($key in $teamSubteamKeys) { $teamSize += Get-Number $subteamSizes[$key] }
  if ($teamSize -eq 0 -and $teamFallbackSizes.ContainsKey($teamKey)) { $teamSize = Get-Number $teamFallbackSizes[$teamKey] }
  $reviewed = 0.0
  foreach ($key in $teamSubteamKeys) {
    if ($subteamReviewed.ContainsKey($key)) { $reviewed += Get-Number $subteamSizes[$key] }
  }
  $teamSummaries += [pscustomobject]@{
    Team = $teamGroup.Name
    InitiativeCount = $items.Count
    ActiveCount = @($items | Where-Object { $_.Status -ne "done" }).Count
    DoneCount = @($items | Where-Object { $_.Status -eq "done" }).Count
    TeamSize = $teamSize
    ReviewedHc = $reviewed
    ScopedHc = ($items | Measure-Object ScopedHc -Sum).Sum
    InProgressHc = ($items | Measure-Object InProgressHc -Sum).Sum
    CountedSavingsHc = ($items | Measure-Object CountedSavingsHc -Sum).Sum
    ExcessCapacityHc = ($items | Measure-Object ExcessCapacityHc -Sum).Sum
  }
}

$subteamSummaries = @()
foreach ($group in ($initiatives | Group-Object Team, Subteam | Sort-Object Name)) {
  $items = @($group.Group)
  $team = $items[0].Team
  $subteam = $items[0].Subteam
  $key = ($team.ToLowerInvariant() + "|" + $subteam.ToLowerInvariant())
  $subteamSummaries += [pscustomobject]@{
    Team = $team
    Subteam = $subteam
    InitiativeCount = $items.Count
    ActiveCount = @($items | Where-Object { $_.Status -ne "done" }).Count
    SizeHc = $(if ($subteamSizes.ContainsKey($key)) { Get-Number $subteamSizes[$key] } else { 0.0 })
    Reviewed = $subteamReviewed.ContainsKey($key)
    ScopedHc = ($items | Measure-Object ScopedHc -Sum).Sum
    InProgressHc = ($items | Measure-Object InProgressHc -Sum).Sum
    CountedSavingsHc = ($items | Measure-Object CountedSavingsHc -Sum).Sum
    ExcessCapacityHc = ($items | Measure-Object ExcessCapacityHc -Sum).Sum
  }
}

$activity = @(Get-Entries $activityRaw | ForEach-Object {
  $item = $_.Value
  [pscustomobject]@{
    Id = $_.Id
    Type = [string](Get-Field $item "type" "")
    Who = [string](Get-Field $item "who" "")
    TicketTitle = [string](Get-Field $item "ticketTitle" "")
    Detail = [string](Get-Field $item "detail" "")
    From = [string](Get-Field $item "from" "")
    To = [string](Get-Field $item "to" "")
    ProjectView = [string](Get-Field $item "projectView" "main")
    Ts = Get-NullableNumber (Get-Field $item "ts")
  }
} | Where-Object { $IncludeMainProjects -or $_.ProjectView -eq "sprint" } | Sort-Object Ts -Descending | Select-Object -First $RecentActivityLimit)

$Lines = New-Object System.Collections.Generic.List[string]
$generatedAt = Get-Date -Format "yyyy-MM-dd HH:mm zzz"
$sourceLabel = $inputFullPath.Replace($RepoRoot, ".")

Add-Line "# Leadership Context For Codex"
Add-Line
Add-Line "Generated: $generatedAt"
Add-Line "Source: $sourceLabel"
Add-Line "Mode: read-only Firebase Realtime Database export analysis"
Add-Line
Add-Line "Use this file as context in Codex to draft a leadership-ready project update. The tables below are intentionally factual; ask Codex to turn them into the final narrative."
Add-Line

Add-Line "## Data Snapshot"
Add-Table @("Area", "Count") @(
  @("Sprint initiatives", $initiatives.Count),
  @("Active sprint initiatives", $openInitiatives.Count),
  @("Done sprint initiatives", $doneInitiatives.Count),
  @("Main projects", $mainProjectCount),
  @("Team members", $teamMemberCount),
  @("Open tasks", $openTasks.Count),
  @("Done tasks", $doneTasks.Count),
  @("Recent activity rows included", $activity.Count)
)

Add-Line "## Executive Facts"
$totalScoped = ($initiatives | Measure-Object ScopedHc -Sum).Sum
$totalInProgress = ($initiatives | Measure-Object InProgressHc -Sum).Sum
$totalSavings = ($initiatives | Measure-Object CountedSavingsHc -Sum).Sum
$totalExcess = ($initiatives | Measure-Object ExcessCapacityHc -Sum).Sum
$teamSizeTotal = ($teamSummaries | Measure-Object TeamSize -Sum).Sum
$reviewedTotal = ($teamSummaries | Measure-Object ReviewedHc -Sum).Sum
Add-Table @("Metric", "Value") @(
  @("Team size represented", (Format-Capacity $teamSizeTotal)),
  @("Reviewed HC", (Format-Capacity $reviewedTotal)),
  @("Scoped automation HC", (Format-Capacity $totalScoped)),
  @("In-progress automation HC", (Format-Capacity $totalInProgress)),
  @("Counted HC savings", (Format-Capacity $totalSavings)),
  @("Excess capacity HC", (Format-Capacity $totalExcess)),
  @("Overdue open tasks", $overdueTasks.Count),
  @("Unassigned active initiatives", $unassignedInitiatives.Count),
  @("Unassigned open tasks", $unassignedTasks.Count),
  @("Low-confidence active initiatives", $lowConfidence.Count)
)

Add-Line "## Risks And Gaps"
$riskRows = @()
if ($overdueTasks.Count -gt 0) { $riskRows += ,@("Overdue tasks", "$($overdueTasks.Count) open tasks are past deadline.") }
if ($unassignedInitiatives.Count -gt 0) { $riskRows += ,@("Unassigned initiatives", "$($unassignedInitiatives.Count) active initiatives do not have a clear owner.") }
if ($unassignedTasks.Count -gt 0) { $riskRows += ,@("Unassigned tasks", "$($unassignedTasks.Count) open tasks do not have an owner.") }
if ($lowConfidence.Count -gt 0) { $riskRows += ,@("Low confidence", "$($lowConfidence.Count) active initiatives are marked low confidence.") }
if ($missingTimeline.Count -gt 0) { $riskRows += ,@("Missing timeline", "$($missingTimeline.Count) active initiatives have no timeline or deadline.") }
if ($noOpenTasks.Count -gt 0) { $riskRows += ,@("No open tasks", "$($noOpenTasks.Count) active initiatives have no open next task.") }
Add-Table @("Risk", "Why it matters") $riskRows

Add-Line "## Team Rollup"
$teamRows = @($teamSummaries | Sort-Object Team | ForEach-Object {
  ,@(
    $_.Team,
    $_.InitiativeCount,
    $_.ActiveCount,
    $_.DoneCount,
    (Format-Capacity $_.TeamSize),
    (Format-Capacity $_.ReviewedHc),
    (Format-Capacity $_.ScopedHc),
    (Format-Capacity $_.InProgressHc),
    ((Format-Capacity $_.CountedSavingsHc) + " / " + (Format-Capacity $_.ExcessCapacityHc))
  )
})
Add-Table @("Team", "Initiatives", "Active", "Done", "Team size", "Reviewed", "Scoped", "In progress", "Savings / excess") $teamRows

Add-Line "## Subteam Rollup"
$subteamRows = @($subteamSummaries | Sort-Object Team, Subteam | ForEach-Object {
  ,@(
    $_.Team,
    $_.Subteam,
    $_.InitiativeCount,
    $_.ActiveCount,
    (Format-Capacity $_.SizeHc),
    $(if ($_.Reviewed) { "yes" } else { "no" }),
    (Format-Capacity $_.ScopedHc),
    (Format-Capacity $_.InProgressHc),
    ((Format-Capacity $_.CountedSavingsHc) + " / " + (Format-Capacity $_.ExcessCapacityHc))
  )
})
Add-Table @("Team", "Subteam", "Initiatives", "Active", "Size", "Reviewed", "Scoped", "In progress", "Savings / excess") $subteamRows

Add-Line "## Active Initiative Detail"
$initiativeRows = @($openInitiatives | Sort-Object Team, Subteam, Priority, Title | Select-Object -First $MaxInitiatives | ForEach-Object {
  $timeline = ""
  if ($_.TimelineStart -and $_.TimelineEnd) { $timeline = "$($_.TimelineStart) to $($_.TimelineEnd)" }
  elseif ($_.TimelineEnd) { $timeline = "Target $($_.TimelineEnd)" }
  elseif ($_.Deadline) { $timeline = "Due $($_.Deadline)" }
  elseif ($_.SprintCycle) { $timeline = $_.SprintCycle }
  $tasks = "$($_.TaskDone)/$($_.TaskTotal)"
  ,@(
    $_.ShortId,
    $_.Team,
    $_.Subteam,
    $_.Title,
    $_.Owner,
    $_.Status,
    $_.Stage,
    $_.Confidence,
    $timeline,
    $tasks,
    ((Format-Capacity $_.ScopedHc) + " scoped; " + (Format-Capacity $_.InProgressHc) + " in progress; " + (Format-Capacity $_.CountedSavingsHc) + " / " + (Format-Capacity $_.ExcessCapacityHc) + " savings/excess")
  )
})
Add-Table @("ID", "Team", "Subteam", "Initiative", "Owner", "Status", "Stage", "Confidence", "Timeline", "Tasks", "HC signal") $initiativeRows
if ($openInitiatives.Count -gt $MaxInitiatives) {
  Add-Line "Note: active initiative detail is truncated to $MaxInitiatives of $($openInitiatives.Count) records."
  Add-Line
}

Add-Line "## Overdue Open Tasks"
$overdueRows = @($overdueTasks | Select-Object -First $MaxTasks | ForEach-Object {
  ,@(
    $_.Initiative.Team,
    $_.Initiative.Subteam,
    $_.Initiative.Title,
    $_.Task.Workstream,
    $_.Task.Text,
    $_.Task.Owner,
    $_.Task.Deadline,
    ([math]::Abs($_.Task.DaysUntil).ToString() + "d overdue")
  )
})
Add-Table @("Team", "Subteam", "Initiative", "Group", "Task", "Owner", "Deadline", "Age") $overdueRows

Add-Line "## Due In Next $Weeks Weeks"
$upcomingRows = @($upcomingTasks | Select-Object -First $MaxTasks | ForEach-Object {
  ,@(
    $_.Initiative.Team,
    $_.Initiative.Subteam,
    $_.Initiative.Title,
    $_.Task.Workstream,
    $_.Task.Text,
    $_.Task.Owner,
    $_.Task.Deadline,
    $(if ($_.Task.DaysUntil -eq 0) { "today" } else { "$($_.Task.DaysUntil)d" })
  )
})
Add-Table @("Team", "Subteam", "Initiative", "Group", "Task", "Owner", "Deadline", "Due") $upcomingRows

Add-Line "## Ownership Gaps"
$ownerRows = @()
$ownerRows += @($unassignedInitiatives | Select-Object -First $MaxTasks | ForEach-Object {
  ,@("initiative", $_.Team, $_.Subteam, $_.Title, "", $_.Priority)
})
$ownerRows += @($unassignedTasks | Select-Object -First $MaxTasks | ForEach-Object {
  ,@("task", $_.Initiative.Team, $_.Initiative.Subteam, $_.Initiative.Title, $_.Task.Text, $_.Initiative.Priority)
})
Add-Table @("Type", "Team", "Subteam", "Initiative", "Task", "Priority") $ownerRows

Add-Line "## Recent Activity"
$activityRows = @($activity | ForEach-Object {
  $change = ""
  if ($_.From -or $_.To) { $change = "$($_.From) -> $($_.To)" }
  elseif ($_.Detail) { $change = $_.Detail }
  ,@(
    (Format-UnixMs $_.Ts),
    $_.Who,
    $_.Type,
    $_.TicketTitle,
    $change
  )
})
Add-Table @("When", "Who", "Action", "Item", "Detail") $activityRows

$templatePath = Join-Path $PSScriptRoot "templates\leadership_prompt.md"
if (Test-Path $templatePath) {
  Add-Line "## Codex Prompt"
  Add-Line
  Add-Line (Get-Content -Raw -Path $templatePath).Trim()
  Add-Line
}

$Lines | Set-Content -Path $outputFullPath -Encoding UTF8
Write-Host "Leadership context written to $outputFullPath"
