#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Install or update the eagle-sdd skill. No repository clone required.

.DESCRIPTION
  Downloads the skill and links it into the directories agent harnesses read, so a
  change to this script's source is picked up by re-running it.

  Two modes, detected automatically:

    remote  The default. Downloads a tarball of the requested ref into the install
            root and links the skill roots at it.
    local   When this script sits next to skills/eagle-sdd (that is, you have the
            repository checked out), the skill roots link to your working tree
            instead, so edits show up immediately. Pass -Local to force it.

  Re-running is how you update. An already-correct link is left alone.

.PARAMETER Ref
  Branch, tag, or commit to install. Defaults to main, or $env:EAGLE_SDD_REF.

.PARAMETER Scope
  project, user, or both. Defaults to user for a remote install and both for a
  local one, or $env:EAGLE_SDD_SCOPE.

.PARAMETER Harness
  Comma-separated subset of: agents, claude, dsh, copilot, gemini.
  Defaults to agents,claude, or $env:EAGLE_SDD_HARNESS.

.PARAMETER InstallRoot
  Where the downloaded skill is kept. Defaults to ~/.eagle-sdd,
  or $env:EAGLE_SDD_HOME.

.PARAMETER Local
  Path to a checkout to link against. Implies local mode.

.PARAMETER Copy
  Copy the skill instead of linking it. Copies do not track later updates.

.PARAMETER Check
  Report whether an update is available. Changes nothing.

.PARAMETER Uninstall
  Remove the links and the downloaded skill.

.EXAMPLE
  irm https://raw.githubusercontent.com/pengls/eagle-sdd/main/install.ps1 | iex

.EXAMPLE
  & ([scriptblock]::Create((irm https://raw.githubusercontent.com/pengls/eagle-sdd/main/install.ps1))) -Scope both -Ref v1.0.0

.EXAMPLE
  # From a clone, link this working tree into every harness root
  .\install.ps1 -Local . -Scope both
#>
[CmdletBinding()]
param(
    [string]$Ref = $(if ($env:EAGLE_SDD_REF) { $env:EAGLE_SDD_REF } else { 'main' }),
    [string]$Scope = $(if ($env:EAGLE_SDD_SCOPE) { $env:EAGLE_SDD_SCOPE } else { '' }),
    [string]$Harness = $(if ($env:EAGLE_SDD_HARNESS) { $env:EAGLE_SDD_HARNESS } else { 'agents,claude' }),
    [string]$InstallRoot = $(if ($env:EAGLE_SDD_HOME) { $env:EAGLE_SDD_HOME } else { Join-Path $HOME '.eagle-sdd' }),
    [string]$Local,
    [switch]$Copy,
    [switch]$Check,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$SkillName = 'eagle-sdd'
$RepoSlug = 'pengls/eagle-sdd'
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

function Write-Step { param([string]$Text) Write-Host $Text -ForegroundColor Cyan }
function Write-Ok { param([string]$Text) Write-Host "  $Text" -ForegroundColor Green }
function Write-Skip { param([string]$Text) Write-Host "  $Text" -ForegroundColor DarkGray }
function Write-Warn2 { param([string]$Text) Write-Host "  $Text" -ForegroundColor Yellow }

# --------------------------------------------------------------- mode + roots

# Local mode: this script came from a checkout that still has the skill beside it.
$localSkill = $null
if ($Local) {
    $candidate = if (Test-Path (Join-Path $Local "skills\$SkillName")) { Join-Path $Local "skills\$SkillName" } else { $Local }
    if (-not (Test-Path (Join-Path $candidate 'SKILL.md'))) { throw "No SKILL.md under -Local $Local" }
    $localSkill = (Resolve-Path $candidate).Path
}
elseif (Test-Path (Join-Path $ScriptDir "skills\$SkillName\SKILL.md")) {
    $localSkill = (Resolve-Path (Join-Path $ScriptDir "skills\$SkillName")).Path
}
$isLocal = $null -ne $localSkill

if (-not $Scope) { $Scope = if ($isLocal) { 'both' } else { 'user' } }
if ($Scope -notin @('project', 'user', 'both')) { throw "-Scope must be project, user, or both (got '$Scope')" }

$harnesses = $Harness.Split(',') | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ }
$known = @('agents', 'claude', 'dsh', 'copilot', 'gemini')
$unknown = $harnesses | Where-Object { $_ -notin $known }
if ($unknown) { throw "-Harness has unknown values: $($unknown -join ', '). Known: $($known -join ', ')" }

# The project root is the nearest ancestor with .git, matching what harnesses do.
# Work in plain strings: Get-Location returns a PathInfo, which has no FullName.
function Get-ProjectRoot {
    $start = (Get-Location).Path
    $dir = $start
    while ($dir) {
        if (Test-Path -LiteralPath (Join-Path $dir '.git')) { return $dir }
        $parent = Split-Path $dir -Parent
        if (-not $parent -or $parent -eq $dir) { break }
        $dir = $parent
    }
    return $start
}

function Get-Targets {
    param(
        [string]$ForScope = $Scope,
        [string[]]$ForHarnesses = $harnesses
    )
    $projectRoot = Get-ProjectRoot
    $targets = [System.Collections.Generic.List[object]]::new()
    $inProject = $ForScope -in @('project', 'both')
    $inUser = $ForScope -in @('user', 'both')

    if ($inProject -and $ForHarnesses -contains 'agents') {
        $targets.Add([pscustomobject]@{ Root = Join-Path $projectRoot '.agents\skills'; Label = '.agents/skills'.PadRight(24) + ' project' })
    }
    if ($inProject -and $ForHarnesses -contains 'claude') {
        $targets.Add([pscustomobject]@{ Root = Join-Path $projectRoot '.claude\skills'; Label = '.claude/skills'.PadRight(24) + ' project' })
    }
    if ($inUser -and $ForHarnesses -contains 'agents') {
        $targets.Add([pscustomobject]@{ Root = Join-Path $HOME '.agents\skills'; Label = '~/.agents/skills'.PadRight(24) + ' user' })
    }
    if ($inUser -and $ForHarnesses -contains 'claude') {
        $targets.Add([pscustomobject]@{ Root = Join-Path $HOME '.claude\skills'; Label = '~/.claude/skills'.PadRight(24) + ' user' })
    }
    if ($inUser -and $ForHarnesses -contains 'dsh') {
        $targets.Add([pscustomobject]@{ Root = Join-Path $HOME '.dsh\skills'; Label = '~/.dsh/skills'.PadRight(24) + ' user' })
    }
    if ($inUser -and $ForHarnesses -contains 'copilot') {
        $targets.Add([pscustomobject]@{ Root = Join-Path $HOME '.copilot\skills'; Label = '~/.copilot/skills'.PadRight(24) + ' user' })
    }
    if ($inUser -and $ForHarnesses -contains 'gemini') {
        $targets.Add([pscustomobject]@{ Root = Join-Path $HOME '.gemini\skills'; Label = '~/.gemini/skills'.PadRight(24) + ' user' })
    }
    return $targets
}

# Uninstall sweeps EVERY documented root, not the requested scope. A link left
# behind by an earlier install at another scope would be left dangling the
# moment the shared download is removed.
function Get-AllTargets {
    return Get-Targets -ForScope 'both' -ForHarnesses @('agents', 'claude', 'dsh', 'copilot', 'gemini')
}

# --------------------------------------------------------------- link helpers

<#
  A directory fingerprint: sorted relative paths plus each file's SHA-256.

  Installed-ness is decided by CONTENT, never by comparing path strings.

  Windows keeps 8.3 short names alive (`PENGLI~1` and `Peng Liang` are the same
  directory), and Get-ChildItem normalises the CHILDREN it returns to the long
  form while the base string you passed stays short. Slicing FullName by the
  base length therefore shifts the slice by that length difference and silently
  corrupts every relative path, which made two identical trees hash differently.
  Resolve-Path -Relative is computed against the current location instead, so it
  is independent of the form the base arrived in.

  Content comparison also makes link and copy installs behave identically.
#>
function Get-LongPath {
    param([string]$Path)
    $parent = Split-Path $Path -Parent
    $leaf = Split-Path $Path -Leaf
    $hit = Get-ChildItem -LiteralPath $parent -Force -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq $leaf } | Select-Object -First 1
    if ($hit) { return $hit.FullName }
    return $Path
}

function Get-TreeHash {
    param([string]$Path)
    $base = Get-LongPath -Path (Get-Item -LiteralPath $Path).FullName
    Push-Location -LiteralPath $base
    try {
        $parts = Get-ChildItem -LiteralPath $base -Recurse -File -Force |
            Sort-Object FullName |
            ForEach-Object {
                $rel = (Resolve-Path -LiteralPath $_.FullName -Relative) -replace '^\.[\\/]', ''
                $rel = $rel.Replace('\', '/')
                $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
                "${rel}:$hash"
            }
    }
    finally { Pop-Location }

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes(($parts -join "`n"))
        return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally { $sha.Dispose() }
}

function Remove-Link {
    param([string]$Target)
    # rmdir removes a junction itself; Remove-Item -Recurse can delete the target
    # behind it on Windows PowerShell, which would be catastrophic here.
    $item = Get-Item -LiteralPath $Target -Force
    if ($item.LinkType) {
        cmd /c rmdir "$Target" 2>$null | Out-Null
        return
    }
    Remove-Item -LiteralPath $Target -Recurse -Force
}

function Install-One {
    param([string]$Source, [string]$Root, [string]$Label, [string]$SourceHash)

    $target = Join-Path $Root $SkillName
    if (-not (Test-Path -LiteralPath $Root)) { New-Item -ItemType Directory -Path $Root -Force | Out-Null }

    if (Test-Path -LiteralPath $target) {
        if ((Get-TreeHash -Path $target) -eq $SourceHash) {
            Write-Skip "$Label already up to date"
            return $false
        }
        Remove-Link -Target $target
    }

    if ($Copy) {
        Copy-Item -LiteralPath $Source -Destination $target -Recurse -Force
        Write-Ok "$Label copied"
        return $true
    }

    try {
        New-Item -ItemType Junction -Path $target -Target $Source -ErrorAction Stop | Out-Null
        Write-Ok "$Label linked"
        return $true
    }
    catch {
        Copy-Item -LiteralPath $Source -Destination $target -Recurse -Force
        Write-Warn2 "$Label junction unavailable, copied instead"
        return $true
    }
}

# ------------------------------------------------------------------- download

function Get-RemoteSha {
    param([string]$Repo, [string]$GitRef)
    foreach ($candidate in @($GitRef, "heads/$GitRef", "tags/$GitRef")) {
        try {
            $r = Invoke-RestMethod -UseBasicParsing -Headers @{ 'User-Agent' = 'eagle-sdd-installer' } `
                -Uri "https://api.github.com/repos/$Repo/commits/$candidate" -TimeoutSec 20
            if ($r.sha) { return $r.sha }
        }
        catch { }
    }
    return $null
}

function Get-Tarball {
    param([string]$Repo, [string]$GitRef, [string]$Destination)
    # A branch and a tag produce different codeload URLs; try branch, then tag,
    # then treat the ref as a raw commit.
    $urls = @(
        "https://codeload.github.com/$Repo/tar.gz/refs/heads/$GitRef",
        "https://codeload.github.com/$Repo/tar.gz/refs/tags/$GitRef",
        "https://codeload.github.com/$Repo/tar.gz/$GitRef"
    )
    $lastError = $null
    foreach ($url in $urls) {
        try {
            Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $Destination -TimeoutSec 120
            if ((Get-Item $Destination).Length -gt 0) { return $url }
        }
        catch { $lastError = $_.Exception.Message }
    }
    throw "Could not download ref '$GitRef' from $Repo. Last error: $lastError"
}

function Get-RemoteSkill {
    param([string]$Repo, [string]$GitRef, [string]$InstallRoot)

    $staging = Join-Path ([System.IO.Path]::GetTempPath()) ("eagle-sdd-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Path $staging -Force | Out-Null
    try {
        $tgz = Join-Path $staging 'source.tar.gz'
        Write-Step "Downloading $Repo@$GitRef"
        $null = Get-Tarball -Repo $Repo -GitRef $GitRef -Destination $tgz

        $extract = Join-Path $staging 'x'
        New-Item -ItemType Directory -Path $extract -Force | Out-Null
        & tar -xzf $tgz -C $extract
        if ($LASTEXITCODE -ne 0) { throw "tar failed to extract the tarball" }

        $found = Get-ChildItem -Path $extract -Recurse -Filter 'SKILL.md' -File |
            Where-Object { $_.Directory.Name -eq $SkillName } |
            Select-Object -First 1
        if (-not $found) { throw "The tarball does not contain skills/$SkillName/SKILL.md" }

        $source = $found.Directory.FullName
        $head = Get-Content (Join-Path $source 'SKILL.md') -TotalCount 6
        if (-not ($head -match "^name:\s*$SkillName\s*$")) {
            throw "Refusing to install: $source/SKILL.md does not declare name: $SkillName"
        }

        $target = Join-Path $InstallRoot 'skill'
        if (-not (Test-Path -LiteralPath $InstallRoot)) { New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null }
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
        Move-Item -LiteralPath $source -Destination $target
        return $target
    }
    finally {
        Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# ----------------------------------------------------------------------- state

function Read-State {
    param([string]$InstallRoot)
    $path = Join-Path $InstallRoot 'state'
    $state = @{}
    if (Test-Path -LiteralPath $path) {
        foreach ($line in Get-Content -LiteralPath $path) {
            $kv = [regex]::Match($line, '^([A-Za-z_]+)=(.*)$')
            if ($kv.Success) { $state[$kv.Groups[1].Value] = $kv.Groups[2].Value }
        }
    }
    return $state
}

function Write-State {
    param([string]$InstallRoot, [hashtable]$State)
    if (-not (Test-Path -LiteralPath $InstallRoot)) { New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null }
    $lines = $State.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Key)=$($_.Value)" }
    Set-Content -LiteralPath (Join-Path $InstallRoot 'state') -Value $lines -Encoding ASCII
}

# ------------------------------------------------------------------------ main

if ($Uninstall) {
    Write-Step "Uninstalling $SkillName"
    $removed = 0
    foreach ($t in (Get-AllTargets)) {
        $target = Join-Path $t.Root $SkillName
        if (Test-Path -LiteralPath $target) {
            Remove-Link -Target $target
            Write-Ok "$($t.Label) removed"
            $removed++
        }
    }
    foreach ($p in @((Join-Path $InstallRoot 'skill'), $InstallRoot)) {
        if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Recurse -Force }
    }
    Write-Host ""
    Write-Host "Removed $removed link(s) and $InstallRoot"
    exit 0
}

if ($Check) {
    $state = Read-State -InstallRoot $InstallRoot
    $target = Join-Path $InstallRoot 'skill'
    if (-not (Test-Path -LiteralPath $target)) {
        Write-Host "Not installed (no skill under $InstallRoot)."
        exit 1
    }
    $installedRef = if ($state['ref']) { $state['ref'] } else { '(unknown)' }
    $installedSha = if ($state['sha']) { $state['sha'] } else { '(none recorded)' }
    Write-Host "Installed ref:  $installedRef"
    Write-Host "Installed sha:  $installedSha"

    if ($state['mode'] -eq 'local') {
        Write-Host "Mode:           local checkout — updates track your working tree"
        exit 0
    }
    $latest = Get-RemoteSha -Repo $RepoSlug -GitRef $installedRef
    if (-not $latest) {
        Write-Host "Latest sha:     unavailable (GitHub API unreachable or rate limited)"
        exit 0
    }
    Write-Host "Latest sha:     $latest"
    if ($state['sha'] -and $state['sha'] -eq $latest) {
        Write-Host ""
        Write-Host "Up to date." -ForegroundColor Green
        exit 0
    }
    Write-Host ""
    Write-Host "An update is available. Re-run the installer to apply it." -ForegroundColor Yellow
    exit 2
}

Write-Host ""
if ($isLocal) {
    Write-Step "Installing $SkillName from the local checkout"
    Write-Host "  source: $localSkill" -ForegroundColor DarkGray
    $source = $localSkill
    $mode = 'local'
    $sha = $null
}
else {
    $sha = Get-RemoteSha -Repo $RepoSlug -GitRef $Ref
    $cached = Join-Path $InstallRoot 'skill'
    $previous = Read-State -InstallRoot $InstallRoot
    if ($sha -and $previous['sha'] -eq $sha -and (Test-Path -LiteralPath (Join-Path $cached 'SKILL.md'))) {
        # Fast path: the recorded commit is already the current one, so there is
        # nothing to download. Links are still checked below.
        Write-Step "$Ref is already current at $($sha.Substring(0, 8)); verifying links"
        $source = $cached
    }
    else {
        $source = Get-RemoteSkill -Repo $RepoSlug -GitRef $Ref -InstallRoot $InstallRoot
    }
    $mode = 'remote'
    Write-Host "  source: $source" -ForegroundColor DarkGray
}
Write-Host ""

$sourceHash = Get-TreeHash -Path $source
$changed = 0
foreach ($t in (Get-Targets)) {
    if (Install-One -Source $source -Root $t.Root -Label $t.Label -SourceHash $sourceHash) { $changed++ }
}

$state = @{
    ref          = if ($isLocal) { 'local' } else { $Ref }
    sha          = if ($sha) { $sha } else { '' }
    mode         = $mode
    scope        = $Scope
    harnesses    = ($harnesses -join ',')
    installed_at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    source       = $source
}
Write-State -InstallRoot $InstallRoot -State $state

Write-Host ""
if ($changed -eq 0) { Write-Host "Already up to date; nothing changed." } else { Write-Host "Updated $changed location(s)." }
Write-Host ""
Write-Host "Invoke it by name in a fresh session:" -ForegroundColor Cyan
Write-Host "  Claude Code / DeepSeek Harness   /$SkillName"
Write-Host "  Codex                            appears in the skill list; never auto-triggers"
Write-Host ""
Write-Host "  check for updates   .\install.ps1 -Check"
Write-Host "  remove              .\install.ps1 -Uninstall"
