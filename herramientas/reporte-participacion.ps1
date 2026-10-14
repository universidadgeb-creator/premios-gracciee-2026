# Imagen de participación (Premios GRACCIEE 2026) con los colores del cartel.
param([string]$Datos, [string]$Salida, [string]$Logo)
Add-Type -AssemblyName System.Drawing

# ── Datos ──
$p = Get-Content -LiteralPath $Datos -Raw -Encoding UTF8 | ConvertFrom-Json
$grupos = @{}
$p.grupos.PSObject.Properties | ForEach-Object { $grupos[$_.Name] = $_.Value }
function Pct($v) { if ($v.total -eq 0) { 0 } else { [int][Math]::Round(100.0 * $v.nominaron / $v.total, [MidpointRounding]::AwayFromZero) } }
$unidades = $grupos.Keys | Where-Object { $_ -ne '*' -and $_ -notmatch ' \| ' } |
  Sort-Object @{ Expression = { Pct $grupos[$_] }; Descending = $true }, @{ Expression = { $_ } }
$sucursalesDe = @{}
foreach ($u in $unidades) {
  $sucursalesDe[$u] = @($grupos.Keys | Where-Object { $_.StartsWith("$u | ") } |
    Sort-Object @{ Expression = { Pct $grupos[$_] }; Descending = $true }, @{ Expression = { $_ } })
}
$corte = [DateTime]::Parse($p.corte).ToUniversalTime().AddHours(-6)   # hora del centro de México
$meses = 'enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'
$hora = $corte.ToString('h:mm') + $(if ($corte.Hour -lt 12) { ' a.m.' } else { ' p.m.' })
$textoCorte = "Corte: $($corte.Day) de $($meses[$corte.Month - 1]) de $($corte.Year) · $hora"

# ── Colores y letras ──
function C($hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }
$crema = C '#f8f3e9'; $tarjeta = C '#fffdf9'; $cafe = C '#4b2311'; $cobre = C '#8f4418'
$cobreClaro = C '#c0814f'; $pista = C '#ece2d3'; $tinto = C '#6d0e1b'; $tenue = C '#75604f'; $linea = C '#e3d6c3'
function F($familia, $tam, $estilo = 'Regular') { New-Object System.Drawing.Font($familia, $tam, [System.Drawing.FontStyle]$estilo, [System.Drawing.GraphicsUnit]::Pixel) }
function B($color) { New-Object System.Drawing.SolidBrush $color }

# ── Medidas ──
$W = 1080; $M = 64
$altoEncabezado = 640; $altoUnidad = 104; $altoSucursal = 58; $altoPie = 150
$H = $altoEncabezado + $altoPie + 40
foreach ($u in $unidades) { $H += $altoUnidad + 18 + $sucursalesDe[$u].Count * $altoSucursal }

$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'
$g.Clear($crema)
$tipo = [System.Drawing.StringFormat]::GenericTypographic.Clone(); $tipo.FormatFlags = $tipo.FormatFlags -bor [System.Drawing.StringFormatFlags]::MeasureTrailingSpaces
$derecha = New-Object System.Drawing.StringFormat; $derecha.Alignment = 'Far'
$centro = New-Object System.Drawing.StringFormat; $centro.Alignment = 'Center'

function Redondeado($x, $y, $w, $h, $r) {
  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = [Math]::Min(2 * $r, [Math]::Min($w, $h))
  $gp.AddArc($x, $y, $d, $d, 180, 90); $gp.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $gp.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $gp.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $gp.CloseFigure(); $gp
}
function Barra($x, $y, $w, $h, $pct, $color) {
  $ruta = Redondeado $x $y $w $h ($h / 2)
  $g.FillPath((B $pista), $ruta)
  if ($pct -gt 0) {
    $g.SetClip($ruta); $g.FillRectangle((B $color), $x, $y, [float]($w * $pct / 100.0), $h); $g.ResetClip()
  }
}

# ── Papel picado (banderitas tinto con cortes) ──
$hilo = New-Object System.Drawing.Pen((C '#9b5a63'), 2)
$g.DrawLine($hilo, 0, 8, $W, 8)
for ($x = 6; $x -lt $W; $x += 74) {
  $color = if ((($x - 6) / 74) % 2 -eq 0) { $tinto } else { C '#8a2a36' }
  $pts = New-Object System.Collections.Generic.List[System.Drawing.PointF]
  $pts.Add((New-Object System.Drawing.PointF($x, 8))); $pts.Add((New-Object System.Drawing.PointF(($x + 64), 8)))
  for ($k = 0; $k -le 8; $k++) { $px = $x + 64 - $k * 8; $py = if ($k % 2 -eq 0) { 48 } else { 56 }; $pts.Add((New-Object System.Drawing.PointF($px, $py))) }
  $g.FillPolygon((B $color), $pts.ToArray())
  $g.FillEllipse((B $crema), $x + 14, 22, 7, 7); $g.FillEllipse((B $crema), $x + 43, 22, 7, 7)
  $rombo = @((New-Object System.Drawing.PointF(($x + 32), 17)), (New-Object System.Drawing.PointF(($x + 38), 25)),
             (New-Object System.Drawing.PointF(($x + 32), 33)), (New-Object System.Drawing.PointF(($x + 26), 25)))
  $g.FillPolygon((B $crema), $rombo)
}

# ── Logo y títulos ──
$y = 86
if ($Logo -and (Test-Path -LiteralPath $Logo)) {
  $img = [System.Drawing.Image]::FromFile($Logo)
  $alto = 132; $ancho = [int]($img.Width * $alto / $img.Height)
  $cx = ($W - $ancho) / 2
  $g.FillPath((B ([System.Drawing.Color]::White)), (Redondeado ($cx - 16) ($y - 12) ($ancho + 32) ($alto + 24) 18))
  $g.DrawImage($img, [int]$cx, $y, $ancho, $alto); $img.Dispose()
  $y += $alto + 44
}
$fTitulo = F 'Georgia' 60 'Bold'
$partes = @(@('Premios ', $cafe), @('GRACCIEE', $cobre), @(' 2026', $cafe))
$anchoTotal = 0; foreach ($pt in $partes) { $anchoTotal += $g.MeasureString($pt[0], $fTitulo, 2000, $tipo).Width }
$x = ($W - $anchoTotal) / 2
foreach ($pt in $partes) { $g.DrawString($pt[0], $fTitulo, (B $pt[1]), $x, $y, $tipo); $x += $g.MeasureString($pt[0], $fTitulo, 2000, $tipo).Width }
$y += 80
$g.DrawString('Avance de nominaciones por unidad y sucursal', (F 'Segoe UI' 30 'Bold'), (B $cafe), (New-Object System.Drawing.RectangleF(0, $y, $W, 44)), $centro)
$y += 46
$g.DrawString($textoCorte, (F 'Segoe UI' 22), (B $tenue), (New-Object System.Drawing.RectangleF(0, $y, $W, 34)), $centro)
$y += 40
$g.FillRectangle((B $tinto), ($W / 2 - 26), $y + 6, 52, 3)   # detalle tinto
$y += 32

# ── Resumen general ──
$tot = $grupos['*']; $pctTot = Pct $tot
$caja = Redondeado $M $y ($W - 2 * $M) 150 22
$g.FillPath((B $tarjeta), $caja); $g.DrawPath((New-Object System.Drawing.Pen($linea, 2)), $caja)
$g.DrawString("$pctTot%", (F 'Georgia' 92 'Bold'), (B $cobre), ($M + 34), ($y + 16), $tipo)
$g.DrawString('de los colaboradores ya envió', (F 'Segoe UI' 30 'Bold'), (B $cafe), ($M + 300), ($y + 30), $tipo)
$g.DrawString('sus nominaciones', (F 'Segoe UI' 30 'Bold'), (B $cafe), ($M + 300), ($y + 68), $tipo)
$g.DrawString("$($tot.nominaron) de $($tot.total) personas", (F 'Segoe UI' 24), (B $tenue), ($M + 300), ($y + 108), $tipo)
$y += 150 + 46

# ── Unidades y sucursales ──
foreach ($u in $unidades) {
  $v = $grupos[$u]; $pc = Pct $v
  $g.DrawString($u, (F 'Georgia' 36 'Bold'), (B $cafe), $M, $y, $tipo)
  $g.DrawString("$pc%", (F 'Georgia' 36 'Bold'), (B $cobre), (New-Object System.Drawing.RectangleF($M, ($y - 2), ($W - 2 * $M), 50)), $derecha)
  $g.DrawString("$($v.nominaron) de $($v.total)", (F 'Segoe UI' 22), (B $tenue), (New-Object System.Drawing.RectangleF($M, ($y + 6), ($W - 2 * $M - 110), 40)), $derecha)
  Barra $M ($y + 54) ($W - 2 * $M) 24 $pc $cobre
  $y += $altoUnidad
  foreach ($s in $sucursalesDe[$u]) {
    $vs = $grupos[$s]; $ps = Pct $vs; $nombre = $s.Substring($u.Length + 3)
    $xs = $M + 30
    $g.DrawString($nombre, (F 'Segoe UI' 24 'Bold'), (B $cafe), $xs, $y, $tipo)
    $g.DrawString("$ps%  ·  $($vs.nominaron) de $($vs.total)", (F 'Segoe UI' 22), (B $tenue), (New-Object System.Drawing.RectangleF($xs, ($y + 2), ($W - $M - $xs), 34)), $derecha)
    Barra $xs ($y + 34) ($W - $M - $xs) 12 $ps $cobreClaro
    $y += $altoSucursal
  }
  $g.FillRectangle((B $linea), $M, ($y + 4), ($W - 2 * $M), 2)
  $y += 18
}

# ── Pie: franja tinto como en el cartel ──
$yPie = $H - $altoPie
$g.FillRectangle((B $tinto), 0, $yPie, $W, 84)
$g.DrawString('VOTACIONES  ·  5 AL 14 DE OCTUBRE', (F 'Segoe UI' 30 'Bold'), (B $crema), (New-Object System.Drawing.RectangleF(0, ($yPie + 22), $W, 44)), $centro)
$g.DrawString('Participación = personas que ya enviaron sus nominaciones ÷ personas en la lista de cada unidad o sucursal.', (F 'Segoe UI' 18), (B $tenue), (New-Object System.Drawing.RectangleF(40, ($yPie + 98), ($W - 80), 40)), $centro)

$bmp.Save($Salida, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"Imagen: $Salida ($W x $H)"
