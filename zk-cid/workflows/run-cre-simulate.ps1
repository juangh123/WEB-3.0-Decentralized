<#
.SYNOPSIS
    Run the official Chainlink CRE CLI against the compliance-lifecycle workflow.

.DESCRIPTION
    The CRE CLI cannot build/simulate this workflow from a Windows path that
    contains spaces (it invokes `cre-compile.cmd` without quoting, which fails
    with `'F:\AI' is not recognized ...`). This script mirrors the workflow into
    a space-free scratch directory, puts `bun` on PATH, then runs:

        cre workflow build    compliance-lifecycle -T staging-settings
        cre workflow simulate compliance-lifecycle -T staging-settings

    `simulate` needs a Chainlink CRE account credential. Create one at
    https://app.chain.link and either run `cre login` once, or pass it here:

        $env:CRE_API_KEY = "<your key>"
        .\run-cre-simulate.ps1

    Console output is also written to
    compliance-lifecycle/evidence/cre-simulate-<timestamp>.log so it can be
    attached to the DoraHacks submission.

.EXAMPLE
    .\run-cre-simulate.ps1 -ApiKey "cre_xxx"

.EXAMPLE
    .\run-cre-simulate.ps1 -SkipBuild -SkipMirror   # re-run simulate only
#>
[CmdletBinding()]
param(
    [string]$ApiKey = $env:CRE_API_KEY,
    [string]$CliPath,
    [string]$ScratchDir = (Join-Path $env:TEMP "zk-cid-cre-build"),
    [switch]$SkipBuild,
    [switch]$SkipMirror,
    [switch]$BuildOnly
)

$ErrorActionPreference = "Stop"
$workflowDir = Join-Path $PSScriptRoot "compliance-lifecycle"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

if (-not (Test-Path -LiteralPath $workflowDir)) {
    throw "workflow directory not found: $workflowDir"
}
if ($ScratchDir -match "\s") {
    throw "ScratchDir must not contain spaces: $ScratchDir"
}

# ---------------------------------------------------------------- CRE CLI ----
function Resolve-CreCli {
    param([string]$Explicit)
    if ($Explicit) {
        if (-not (Test-Path -LiteralPath $Explicit)) { throw "CRE CLI not found: $Explicit" }
        return (Resolve-Path -LiteralPath $Explicit).Path
    }
    $onPath = Get-Command cre -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }
    $cliDir = Join-Path $repoRoot "tmp\cre-cli"
    if (Test-Path -LiteralPath $cliDir) {
        $candidate = Get-ChildItem -LiteralPath $cliDir -Filter "cre_v*_windows_amd64.exe" -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending | Select-Object -First 1
        if ($candidate) { return $candidate.FullName }
    }
    throw "CRE CLI not found. Install it (https://docs.chain.link/cre) or pass -CliPath."
}

# ------------------------------------------------------------------- bun -----
function Add-BunToPath {
    $bun = Get-Command bun -ErrorAction SilentlyContinue
    if ($bun) { return $bun.Source }
    $cacheRoot = Join-Path $env:LOCALAPPDATA "npm-cache\_npx"
    if (Test-Path -LiteralPath $cacheRoot) {
        $candidate = Get-ChildItem -LiteralPath $cacheRoot -Recurse -Filter "bun.exe" -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending | Select-Object -First 1
        if ($candidate) {
            $env:PATH = "$($candidate.DirectoryName);$env:PATH"
            return $candidate.FullName
        }
    }
    throw "bun not found on PATH. Install it from https://bun.com/docs/installation (the CRE CLI needs it for TypeScript workflows)."
}

# -------------------------------------------------------------- mirror -------
$mirror = Join-Path $ScratchDir "compliance-lifecycle"
if (-not $SkipMirror) {
    New-Item -ItemType Directory -Force -Path $ScratchDir | Out-Null
    Write-Host "[1/3] Mirroring workflow to $mirror (incremental, keeps node_modules in sync)..."
    $robocopyArgs = @($workflowDir, $mirror, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1")
    & robocopy @robocopyArgs | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "project.yaml") -Destination (Join-Path $ScratchDir "project.yaml") -Force
    $envFile = @((Join-Path $PSScriptRoot ".env"), (Join-Path $workflowDir ".env")) |
        Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($envFile) {
        Copy-Item -LiteralPath $envFile -Destination (Join-Path $ScratchDir ".env") -Force
        Write-Host "      loaded secrets from $envFile"
    }
} else {
    Write-Host "[1/3] Skipping mirror step (-SkipMirror)."
}

# The CRE CLI reads sensitive values (CRE_API_KEY, RPC URLs) from this file.
$cliEnvArgs = @()
if (Test-Path -LiteralPath (Join-Path $ScratchDir ".env")) {
    $cliEnvArgs = @("-e", ".env")
}

$cli = Resolve-CreCli -Explicit $CliPath
$bun = Add-BunToPath
Write-Host "      CRE CLI : $cli"
Write-Host "      bun     : $bun"

$evidenceDir = Join-Path $workflowDir "evidence"
New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
$logPath = Join-Path $evidenceDir ("cre-simulate-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")

Push-Location $ScratchDir
try {
    if (-not $SkipBuild) {
        Write-Host "[2/3] cre workflow build compliance-lifecycle -T staging-settings"
        & $cli workflow build compliance-lifecycle -T staging-settings @cliEnvArgs 2>&1 | Tee-Object -FilePath $logPath
        if ($LASTEXITCODE -ne 0) { throw "cre workflow build failed with exit code $LASTEXITCODE" }
    } else {
        Write-Host "[2/3] Skipping build (-SkipBuild)."
    }

    if ($BuildOnly) {
        Write-Host "[3/3] Skipping simulate (-BuildOnly)."
        return
    }

    if (-not $ApiKey) {
        Write-Warning "CRE_API_KEY is not set. Run 'cre login' first, or pass -ApiKey / set `$env:CRE_API_KEY."
    } else {
        $env:CRE_API_KEY = $ApiKey
    }

    Write-Host "[3/3] cre workflow simulate compliance-lifecycle -T staging-settings"
    & $cli workflow simulate compliance-lifecycle -T staging-settings @cliEnvArgs 2>&1 | Tee-Object -FilePath $logPath -Append
    if ($LASTEXITCODE -ne 0) { throw "cre workflow simulate failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Done. Evidence log: $logPath"
Write-Host "Next: link the log from workflows/compliance-lifecycle/evidence/README.md and the DoraHacks description."
