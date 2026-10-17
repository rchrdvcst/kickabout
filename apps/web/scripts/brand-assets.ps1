# Gera as imagens do site a partir do logo oficial (docs/brand/LOGO_KICKABOUT.png, 1536x1024, fundo transparente).
# Uso (na raiz do repositório): powershell -NoProfile -File apps/web/scripts/brand-assets.ps1
Add-Type -AssemblyName System.Drawing
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$source = Join-Path $root 'docs\brand\LOGO_KICKABOUT.png'
$public = Join-Path $root 'apps\web\public'
New-Item -ItemType Directory -Force $public | Out-Null

function Save-Resized($dest, $cx, $cy, $cw, $ch, $w, $h) {
  $img = [System.Drawing.Image]::FromFile($source)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), (New-Object System.Drawing.Rectangle $cx, $cy, $cw, $ch), [System.Drawing.GraphicsUnit]::Pixel)
  $bmp.Save((Join-Path $public $dest), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
}

Save-Resized 'logo.png' 0 0 1536 1024 240 160          # cabeçalho (exibido com 40px de altura, nitidez até 4x)
Save-Resized 'icon-192.png' 440 0 820 820 192 192      # ícone do celular: o "K" com o jogador e a bola
Save-Resized 'favicon-32.png' 440 0 820 820 32 32      # ícone da aba
