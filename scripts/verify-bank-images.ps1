# Verification de la structure bank/
$ErrorActionPreference = "Continue"

Write-Host "=== VERIFICATION STRUCTURE BANK ===" -ForegroundColor Cyan

$repo = Join-Path $env:APPDATA "NexaFlow\repository\bank"
Write-Host "`n[1] Repository: $repo" -ForegroundColor Green

if (Test-Path $repo) {
  $folders = Get-ChildItem -Directory -Force $repo
  Write-Host "Dossiers: $($folders.Count)"

  foreach ($folder in $folders) {
    $slug = $folder.Name
    $jpg = Join-Path $folder.FullName "$slug.jpg"
    $json = Join-Path $folder.FullName "$slug.json"

    $hasJpg = Test-Path $jpg
    $hasJson = Test-Path $json

    $status = if ($hasJpg -and $hasJson) { "OK" }
              elseif ($hasJpg) { "JSON MANQUANT" }
              elseif ($hasJson) { "JPG MANQUANT" }
              else { "VIDE" }

    $color = if ($status -eq "OK") { "Green" }
             elseif ($status -eq "VIDE") { "Yellow" }
             else { "Red" }

    Write-Host "  [$status] $slug" -ForegroundColor $color
  }
} else {
  Write-Host "  Repo non trouve" -ForegroundColor Yellow
}

Write-Host "`n[2] Fichiers hors dossier (JSON/JPG a la racine)" -ForegroundColor Green
if (Test-Path $repo) {
  $orphans = Get-ChildItem -File -Force $repo
  if ($orphans.Count -gt 0) {
    foreach ($orphan in $orphans) {
      if ($orphan.Name -ne ".placeholder") {
        Write-Host "  [HORS DOSSIER] $($orphan.Name)" -ForegroundColor Red
      }
    }
  } else {
    Write-Host "  Aucun" -ForegroundColor Green
  }
}

Write-Host "`n[3] Vecteurs ImagePair dans Chroma" -ForegroundColor Green
$chromaPath = Join-Path $env:APPDATA "NexaFlow\chroma\collections\default.json"

if (Test-Path $chromaPath) {
  $coll = Get-Content $chromaPath | ConvertFrom-Json
  $pairs = $coll.records.PSObject.Properties | Where-Object {
    $_.Value.file_type -eq "ImagePair"
  }
  Write-Host "ImagePair: $($pairs.Count)"
  $pairs | ForEach-Object {
    Write-Host "  path=$($_.Value.path)"
  }
} else {
  Write-Host "  Chroma non trouve" -ForegroundColor Yellow
}

Write-Host "`n=== FIN VERIFICATION ===" -ForegroundColor Cyan
