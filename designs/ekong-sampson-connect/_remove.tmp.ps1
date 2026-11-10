$path = Join-Path $PSScriptRoot 'index.html'
$lines = Get-Content $path
$start = -1; $end = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($start -lt 0 -and $lines[$i] -match '<section class="section manifesto" id="manifesto"') { $start = $i }
  if ($start -ge 0 -and $lines[$i] -match '</section>' ) { $end = $i; break }
}
if ($start -lt 0 -or $end -lt 0) { Write-Error 'manifesto section not found'; exit 1 }
$new = $lines[0..($start-1)] + $lines[($end+1)..($lines.Count-1)]
Set-Content -Path $path -Value $new -Encoding UTF8
Write-Output ("Removed lines {0}-{1}" -f ($start+1), ($end+1))

# site.js: remove manifesto logic
$js = Join-Path $PSScriptRoot 'site.js'
$j = Get-Content $js -Raw
$j = $j -replace '(?s)\r?\n  const manifestoSearch[\s\S]*?\r?\n  \}\r?\n\r?\n  const projectFilters', "`r`n  const projectFilters"
Set-Content -Path $js -Value $j -Encoding UTF8

# index.html: drop manifesto references in nav/agenda
$h = Get-Content $path -Raw
$h = $h -replace '<a class="metric" href="#manifesto"><strong>Policies</strong><span>Read theme frameworks</span></a>', ''
$h = $h -replace '<div class="agenda-strip"><div class="wrap"><strong>Development agenda</strong>.{0,4000}?</div></div>', ''
Set-Content -Path $path -Value $h -Encoding UTF8
Write-Output 'Done'
