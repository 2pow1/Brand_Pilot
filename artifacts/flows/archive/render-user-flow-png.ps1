Add-Type -AssemblyName System.Drawing

$path = Join-Path (Get-Location) 'brand-pilot-user-flow-readable.png'
$w = 1600
$h = 2300
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

function Brush($hex) {
    return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function PenC($hex, $width) {
    return New-Object System.Drawing.Pen(([System.Drawing.ColorTranslator]::FromHtml($hex)), $width)
}

function FontK($size, $style = 'Regular') {
    $fs = [System.Drawing.FontStyle]::$style
    return New-Object System.Drawing.Font('Malgun Gothic', $size, $fs, [System.Drawing.GraphicsUnit]::Pixel)
}

function Rect($x, $y, $ww, $hh, $stroke, $fill = '#ffffff') {
    $r = New-Object System.Drawing.Rectangle $x, $y, $ww, $hh
    $g.FillRectangle((Brush $fill), $r)
    $g.DrawRectangle((PenC $stroke 3), $r)
}

function Text($s, $x, $y, $size, $color = '#111827', $style = 'Regular') {
    $g.DrawString($s, (FontK $size $style), (Brush $color), [float]$x, [float]$y)
}

function Arrow($x1, $y1, $x2, $y2, $color = '#1f2937') {
    $p = PenC $color 4
    $cap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap 7, 9
    $p.CustomEndCap = $cap
    $g.DrawLine($p, $x1, $y1, $x2, $y2)
}

$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#f8fafc'))

Text '사용자 흐름도' 110 80 50 '#111827' 'Bold'
Text '공통 초안 승인 후, 선택한 채널에 맞게 콘텐츠를 자동 변환하는 구조' 110 142 26 '#475569'

Rect 110 210 1380 180 '#4f46e5'
Text '1회' 156 245 24 '#4f46e5' 'Bold'
Text '처음 1회 정보 제공' 300 245 31 '#111827' 'Bold'
Text '회사/서비스 정보, 홍보 목표, 상담 링크 또는 오픈채팅 링크를 전달합니다.' 300 302 25 '#334155'
Text '대표/고객사는 별도 소프트웨어를 설치하지 않습니다.' 300 340 22 '#64748b'
Arrow 800 390 800 465

Rect 110 465 1380 190 '#059669'
Text '반복' 150 500 24 '#059669' 'Bold'
Text '콘텐츠 요청' 330 500 31 '#111827' 'Bold'
Text '홍보하고 싶은 주제, 참고 URL 또는 키워드를 전달합니다.' 330 557 25 '#334155'
Text '게시할 채널을 선택합니다.' 330 595 25 '#334155'
Arrow 800 655 800 730

Rect 110 730 1380 190 '#0f766e'
Text '반복' 150 765 24 '#0f766e' 'Bold'
Text '공통 초안 확인' 330 765 31 '#111827' 'Bold'
Text 'AI가 만든 핵심 메시지, 홍보 방향, CTA를 확인합니다.' 330 822 25 '#334155'
Text '이 단계에서는 아직 채널별 최종 콘텐츠가 게시되지 않습니다.' 330 860 22 '#64748b'
Arrow 800 920 800 1000

$poly = @(
    [System.Drawing.Point]::new(800, 1005),
    [System.Drawing.Point]::new(1030, 1145),
    [System.Drawing.Point]::new(800, 1285),
    [System.Drawing.Point]::new(570, 1145)
)
$g.FillPolygon((Brush '#ffffff'), $poly)
$g.DrawPolygon((PenC '#ea580c' 4), $poly)
Text '초안 승인?' 704 1120 31 '#111827' 'Bold'
Text '승인 또는 거절' 715 1164 22 '#64748b'

Arrow 570 1145 360 1145 '#475569'
Arrow 360 1145 360 1380 '#475569'
Text '거절' 370 1105 24 '#111827' 'Bold'

Rect 110 1380 500 185 '#dc2626'
Text '종료' 150 1415 24 '#dc2626' 'Bold'
Text '게시하지 않음' 280 1415 31 '#111827' 'Bold'
Text '이번 콘텐츠는 게시되지 않습니다.' 280 1472 25 '#334155'
Text '다음 요청 또는 다음 일정으로 이동합니다.' 280 1510 22 '#64748b'

Arrow 1030 1145 1240 1145 '#475569'
Arrow 1240 1145 1240 1380 '#475569'
Text '승인' 1140 1105 24 '#111827' 'Bold'

Rect 720 1380 770 185 '#2563eb'
Text '자동' 760 1415 24 '#2563eb' 'Bold'
Text '채널별 콘텐츠 생성' 900 1415 31 '#111827' 'Bold'
Text '선택한 채널에 맞게 콘텐츠가 자동 변환됩니다.' 900 1472 25 '#334155'
Text '현재 MVP는 Instagram만 실제 게시합니다.' 900 1510 22 '#64748b'
Arrow 1105 1565 1105 1635

Rect 110 1635 390 175 '#e11d48'
Text 'Instagram' 170 1680 31 '#111827' 'Bold'
Text '카드뉴스 5장' 170 1734 25 '#334155'
Text '캐러셀 게시' 170 1772 25 '#334155'

Rect 605 1635 390 175 '#64748b'
Text 'Blog' 665 1680 31 '#111827' 'Bold'
Text '긴 글 형식' 665 1734 25 '#334155'
Text '추후 확장' 665 1772 22 '#64748b'

Rect 1100 1635 390 175 '#64748b'
Text 'Facebook / LinkedIn' 1140 1680 28 '#111827' 'Bold'
Text '짧은 게시글' 1140 1734 25 '#334155'
Text '추후 확장' 1140 1772 22 '#64748b'

Arrow 305 1810 735 1910 '#475569'
Arrow 800 1810 800 1910 '#475569'
Arrow 1295 1810 865 1910 '#475569'

Rect 300 1910 1000 165 '#111827'
Text '게시 결과 확인' 540 1958 31 '#111827' 'Bold'
Text '게시 완료 여부와 게시 링크 또는 결과를 공유받습니다.' 540 2013 25 '#334155'
Text '승인된 콘텐츠만 게시됩니다.' 540 2050 22 '#64748b'

Rect 300 2140 1000 105 '#2563eb'
Text '다음 콘텐츠' 540 2175 31 '#111827' 'Bold'
Text '다음 콘텐츠 요청 또는 다음 게시 일정으로 반복합니다.' 540 2220 25 '#334155'

Arrow 360 1565 360 2192 '#475569'
Arrow 360 2192 300 2192 '#475569'
Arrow 800 2075 800 2140 '#475569'

$p = PenC '#2563eb' 4
$p.DashPattern = @(12, 8)
$cap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap 7, 9
$p.CustomEndCap = $cap
$g.DrawLine($p, 1300, 2192, 1510, 2192)
$g.DrawLine($p, 1510, 2192, 1510, 560)
$g.DrawLine($p, 1510, 560, 1490, 560)

$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output $path
