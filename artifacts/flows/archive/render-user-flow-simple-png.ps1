Add-Type -AssemblyName System.Drawing

$path = Join-Path (Get-Location) 'brand-pilot-user-flow-simple.png'
$w = 1600
$h = 2200
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
    $g.DrawRectangle((PenC $stroke 4), $r)
}

function Text($s, $x, $y, $size, $color = '#111827', $style = 'Regular') {
    $g.DrawString($s, (FontK $size $style), (Brush $color), [float]$x, [float]$y)
}

function Arrow($x1, $y1, $x2, $y2, $color = '#1f2937', $dash = $false) {
    $p = PenC $color 5
    if ($dash) { $p.DashPattern = @(12, 8) }
    $cap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap 8, 10
    $p.CustomEndCap = $cap
    $g.DrawLine($p, $x1, $y1, $x2, $y2)
}

$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#f8fafc'))

Text '사용자 흐름도' 110 86 54 '#111827' 'Bold'
Text '사용자가 실제로 알아야 하는 단계만 정리한 흐름' 110 152 28 '#475569'

Rect 150 230 1300 180 '#4f46e5'
Text '1회' 205 275 27 '#4f46e5' 'Bold'
Text '처음 1회 정보 제공' 365 270 35 '#111827' 'Bold'
Text '회사/서비스 정보, 홍보 목표, 상담 링크 또는 오픈채팅 링크를 전달합니다.' 365 330 27 '#334155'
Text '대표/고객사는 별도 소프트웨어를 설치하지 않습니다.' 365 372 23 '#64748b'
Arrow 800 410 800 490

Rect 150 490 1300 190 '#059669'
Text '반복' 205 535 27 '#059669' 'Bold'
Text '콘텐츠 요청' 365 530 35 '#111827' 'Bold'
Text '홍보하고 싶은 주제, 참고 URL 또는 키워드를 전달합니다.' 365 590 27 '#334155'
Text '게시할 채널을 선택합니다. 현재 MVP는 Instagram만 실제 게시합니다.' 365 632 23 '#64748b'
Arrow 800 680 800 760

Rect 150 760 1300 190 '#0f766e'
Text '반복' 205 805 27 '#0f766e' 'Bold'
Text '공통 초안 확인' 365 800 35 '#111827' 'Bold'
Text 'AI가 만든 핵심 메시지, 홍보 방향, CTA를 확인합니다.' 365 860 27 '#334155'
Text '아직 채널별 최종 콘텐츠가 게시되기 전 단계입니다.' 365 902 23 '#64748b'
Arrow 800 950 800 1035

$poly = @(
    [System.Drawing.Point]::new(800, 1035),
    [System.Drawing.Point]::new(1050, 1185),
    [System.Drawing.Point]::new(800, 1335),
    [System.Drawing.Point]::new(550, 1185)
)
$g.FillPolygon((Brush '#ffffff'), $poly)
$g.DrawPolygon((PenC '#ea580c' 5), $poly)
Text '초안 승인?' 705 1160 36 '#111827' 'Bold'
Text '승인 또는 거절' 718 1210 24 '#64748b'

Arrow 550 1185 315 1185 '#475569'
Arrow 315 1185 315 1430 '#475569'
Text '거절' 365 1138 27 '#111827' 'Bold'

Rect 150 1430 520 185 '#dc2626'
Text '종료' 205 1475 27 '#dc2626' 'Bold'
Text '게시하지 않음' 330 1470 33 '#111827' 'Bold'
Text '이번 콘텐츠는 게시되지 않습니다.' 330 1530 26 '#334155'
Text '다음 콘텐츠 요청으로 넘어갑니다.' 330 1570 23 '#64748b'

Arrow 1050 1185 1285 1185 '#475569'
Arrow 1285 1185 1285 1430 '#475569'
Text '승인' 1165 1138 27 '#111827' 'Bold'

Rect 820 1430 630 250 '#2563eb'
Text '자동' 875 1475 27 '#2563eb' 'Bold'
Text '선택 채널별 콘텐츠 생성' 1020 1470 33 '#111827' 'Bold'
Text '승인된 초안을 채널별 형식으로 변환합니다.' 1020 1530 25 '#334155'
Text 'Instagram: 카드뉴스 5장 / 캐러셀 게시' 1020 1572 23 '#334155'
Text '기타 채널: 추후 확장 가능한 구조' 1020 1612 23 '#64748b'
Arrow 1135 1680 1135 1765

Rect 400 1765 800 220 '#111827'
Text '게시 결과 확인' 600 1815 35 '#111827' 'Bold'
Text '게시 완료 여부와 게시 링크 또는 결과를 공유받습니다.' 600 1875 27 '#334155'
Text '승인된 콘텐츠만 게시됩니다.' 600 1915 23 '#64748b'

Rect 400 2015 800 130 '#2563eb'
Text '다음 콘텐츠' 600 2048 33 '#111827' 'Bold'
Text '다음 요청 또는 다음 게시 일정으로 반복' 600 2095 25 '#334155'

Arrow 315 1615 315 2078 '#475569'
Arrow 315 2080 400 2080 '#475569'
Arrow 800 1985 800 2015 '#475569'
Arrow 1200 2080 1500 2080 '#2563eb' $true
Arrow 1500 2080 1500 585 '#2563eb' $true
Arrow 1500 585 1450 585 '#2563eb' $true

$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output $path
