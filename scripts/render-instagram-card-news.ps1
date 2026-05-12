param(
    [Parameter(Mandatory = $true)]
    [string]$InputJsonPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputDir
)

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$raw = Get-Content -LiteralPath $InputJsonPath -Raw -Encoding UTF8
$payload = $raw | ConvertFrom-Json

if (-not (Test-Path -LiteralPath $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

function ColorFromHex($hex) {
    return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

function Brush($hex) {
    return New-Object System.Drawing.SolidBrush (ColorFromHex $hex)
}

function PenC($hex, $width) {
    return New-Object System.Drawing.Pen((ColorFromHex $hex), $width)
}

function FontK($size, $style = 'Regular') {
    $fontStyle = [System.Drawing.FontStyle]::$style
    return New-Object System.Drawing.Font('Malgun Gothic', $size, $fontStyle, [System.Drawing.GraphicsUnit]::Pixel)
}

function DrawText($g, $text, $x, $y, $w, $h, $size, $color, $style = 'Regular', $align = 'Center', $valign = 'Center') {
    $rect = New-Object System.Drawing.RectangleF ([float]$x), ([float]$y), ([float]$w), ([float]$h)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::$align
    $format.LineAlignment = [System.Drawing.StringAlignment]::$valign
    $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
    $format.FormatFlags = 0
    $g.DrawString([string]$text, (FontK $size $style), (Brush $color), $rect, $format)
}

function DrawPageDots($g, $active, $total, $width, $height, $accent, $muted) {
    $dotSize = 12
    $gap = 14
    $groupWidth = ($total * $dotSize) + (($total - 1) * $gap)
    $startX = ($width - $groupWidth) / 2
    $y = $height - 70

    for ($i = 0; $i -lt $total; $i++) {
        $color = if (($i + 1) -eq $active) { $accent } else { $muted }
        $g.FillEllipse((Brush $color), [float]($startX + ($i * ($dotSize + $gap))), [float]$y, [float]$dotSize, [float]$dotSize)
    }
}

function DrawAccentLabel($g, $text, $accent, $foreground) {
    if ([string]::IsNullOrWhiteSpace($text)) { return }

    $font = FontK 32 'Bold'
    $size = $g.MeasureString([string]$text, $font)
    $w = [Math]::Max(140, [int]$size.Width + 42)
    $h = 54
    $x = (1080 - $w) / 2
    $y = 310
    $g.FillRectangle((Brush $accent), [float]$x, [float]$y, [float]$w, [float]$h)
    DrawText $g $text $x ($y + 2) $w $h 28 $foreground 'Bold'
}

function DrawQrPlaceholder($g, $x, $y, $size, $accent, $foreground, $muted, $url) {
    if ([string]::IsNullOrWhiteSpace($url)) { return }

    $g.DrawRectangle((PenC $foreground 5), [float]$x, [float]$y, [float]$size, [float]$size)
    $inner = 24
    $cell = 18
    for ($row = 0; $row -lt 5; $row++) {
        for ($col = 0; $col -lt 5; $col++) {
            if ((($row + $col) % 2) -eq 0) {
                $g.FillRectangle((Brush $accent), [float]($x + $inner + ($col * 30)), [float]($y + $inner + ($row * 30)), [float]$cell, [float]$cell)
            }
        }
    }
    DrawText $g 'QR' $x ($y + 78) $size 44 36 $foreground 'Bold'
    DrawText $g 'target link' ($x - 40) ($y + $size + 18) ($size + 80) 36 22 $muted 'Regular'
}

function RenderSlide($payload, $slide, $index, $outputPath) {
    $width = [int]$payload.dimensions.width
    $height = [int]$payload.dimensions.height
    $design = $payload.design
    $background = if ($design.background) { $design.background } else { '#181818' }
    $foreground = if ($design.foreground) { $design.foreground } else { '#f8fafc' }
    $muted = if ($design.muted) { $design.muted } else { '#a3a3a3' }
    $accent = if ($design.accent) { $design.accent } else { '#f15a24' }
    $brandName = if ($payload.brandName) { $payload.brandName } else { 'Brand Pilot' }

    $bitmap = New-Object System.Drawing.Bitmap $width, $height
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear((ColorFromHex $background))

    DrawText $g $brandName 120 54 ($width - 240) 64 28 $muted 'Regular'

    if ($slide.role -eq 'hook') {
        DrawText $g $slide.headline 96 420 ($width - 192) 230 64 $foreground 'Bold'
        DrawText $g $slide.body 130 660 ($width - 260) 92 32 $muted 'Regular'
        if ($slide.emphasis) {
            DrawText $g $slide.emphasis 360 772 360 58 30 $foreground 'Bold'
            $g.FillRectangle((Brush $accent), 360, 830, 360, 10)
        }
    } elseif ($slide.role -eq 'cta') {
        DrawText $g $slide.headline 96 310 ($width - 192) 150 58 $foreground 'Bold'
        DrawText $g $slide.body 160 480 ($width - 320) 120 32 $muted 'Regular'
        DrawQrPlaceholder $g 440 650 200 $accent $foreground $muted $slide.qrTargetUrl
    } else {
        DrawAccentLabel $g $slide.label $accent $foreground
        DrawText $g $slide.headline 110 398 ($width - 220) 120 46 $foreground 'Bold'
        DrawText $g $slide.body 160 560 ($width - 320) 190 34 $muted 'Regular'
    }

    DrawText $g ([string]$payload.source.title) 96 ($height - 150) ($width - 192) 34 20 $muted 'Regular'
    DrawPageDots $g $index $payload.slides.Count $width $height $accent $muted

    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bitmap.Dispose()
}

$slidePaths = @()
$index = 1
foreach ($slide in $payload.slides) {
    $fileName = 'slide-{0:D2}.png' -f $index
    $path = Join-Path $OutputDir $fileName
    RenderSlide $payload $slide $index $path
    $slidePaths += $path
    $index += 1
}

$manifestPath = Join-Path $OutputDir 'manifest.json'
$manifest = @{
    outputDir = $OutputDir
    slides = $slidePaths
    caption = $payload.caption
    hashtags = $payload.hashtags
    source = $payload.source
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
@{
    outputDir = $OutputDir
    manifestPath = $manifestPath
    slides = $slidePaths
} | ConvertTo-Json -Depth 8 -Compress
