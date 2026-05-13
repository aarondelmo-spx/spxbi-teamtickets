# Firebase Leadership Analysis

This folder is a read-only analysis workspace for the SPX BI team tickets Firebase data. It is separate from the hosted app files, so analysis work can be committed without changing the production UI.

## What the app stores

The app uses Firebase Auth and Firebase Realtime Database. The main database branches are:

- `tickets`: main project tracker records.
- `sprintProjects`: Vibe Coding initiatives, tasks, timelines, owners, team/subteam, stage, confidence, and HC impact fields.
- `automationTeams`: editable team hierarchy metadata.
- `automationSubteams`: editable subteam hierarchy, size, and review status.
- `team`: team member names used for assignment pickers.
- `activity`: recent audit-style activity rows.
- `whitelist`: allowed login emails.

For leadership updates, `sprintProjects`, `automationSubteams`, and `activity` are the most important branches.

## Safe workflow

1. Export Firebase Realtime Database JSON into the ignored data folder:

   ```powershell
   firebase database:get / --project spxbi-teamtickets | Out-File -Encoding utf8 analysis\data\firebase-export.json
   ```

   If Firebase CLI access is not available, download a Realtime Database JSON export from Firebase Console and save it as `analysis\data\firebase-export.json`.

2. Generate a Codex-ready context file:

   ```powershell
   .\analysis\leadership_brief.ps1
   ```

3. In this Codex chat, ask it to read and analyze:

   ```text
   Please read analysis/output/leadership-context.md and draft a leadership-ready update.
   ```

The raw export and generated output are ignored by Git. Do not move live Firebase exports outside `analysis/data/` unless you intentionally want them tracked.

## Test with sample data

Run this before using live data:

```powershell
.\analysis\leadership_brief.ps1 -InputPath analysis\samples\firebase-export.sample.json -OutputPath analysis\output\sample-leadership-context.md
```

## Generated briefing sections

The script produces:

- Data snapshot and executive metrics.
- Risks and gaps.
- Team and subteam automation rollups.
- Active initiative detail.
- Overdue tasks and upcoming tasks.
- Ownership gaps.
- Recent activity.
- A Codex prompt for turning the factual context into a leadership narrative.

## Notes

- The script only reads a local JSON export and writes local Markdown.
- It does not write to Firebase.
- It does not call any LLM API.
- Generated outputs may contain sensitive project data and should stay ignored.
