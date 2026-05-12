Add-Type -AssemblyName System.Drawing

$path = Join-Path (Get-Location) 'brand-pilot-program-flow-simple.png'
$w = 1800
$h = 3100
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

Text '프로그램 동작 순서도' 120 92 56 '#111827' 'Bold'
Text '초기 설정과 반복 자동화 구간을 분리하고, 승인 후 채널별 변환이 확장되도록 구성' 120 160 28 '#475569'

Rect 150 240 1500 215 '#4f46e5'
Text '1회' 215 290 28 '#4f46e5' 'Bold'
Text '초기 설정' 390 282 38 '#111827' 'Bold'
Text '브랜드 정보, Instagram 계정, Notion DB, Discord 검토 채널을 연결합니다.' 390 350 28 '#334155'
Text '카드뉴스 템플릿, 공개 스토리지, API 키/토큰도 이 단계에서 설정합니다.' 390 394 24 '#64748b'
Arrow 900 455 900 535

Rect 150 535 1500 190 '#059669'
Text '반복' 215 582 28 '#059669' 'Bold'
Text '캠페인 생성 또는 예약 실행' 390 575 36 '#111827' 'Bold'
Text '홍보 주제, 참고 URL/키워드, 게시 채널, 게시 희망 일정을 입력합니다.' 390 640 27 '#334155'
Arrow 900 725 900 805

Rect 150 805 1500 220 '#0f766e'
Text '자동' 215 855 28 '#0f766e' 'Bold'
Text '참고 자료 수집' 390 848 36 '#111827' 'Bold'
Text 'URL 본문 추출, 검색 결과 또는 해외 사례를 수집하고 핵심 내용을 요약합니다.' 390 912 27 '#334155'
Text '2주 MVP에서는 사용자가 제공한 URL/키워드 기반 수집으로 범위를 제한합니다.' 390 956 24 '#64748b'
Arrow 900 1025 900 1105

Rect 150 1105 1500 235 '#0f766e'
Text '자동' 215 1155 28 '#0f766e' 'Bold'
Text '공통 콘텐츠 초안 생성' 390 1148 36 '#111827' 'Bold'
Text 'GPT API가 채널 독립적인 Campaign Brief를 만듭니다.' 390 1212 27 '#334155'
Text '핵심 메시지, 타깃 고객, 문제/해결 구조, 주요 포인트, CTA를 포함합니다.' 390 1254 24 '#64748b'
Arrow 900 1340 900 1420

Rect 150 1420 1500 210 '#f97316'
Text '검토' 215 1468 28 '#f97316' 'Bold'
Text '초안 저장 및 검토 요청' 390 1462 36 '#111827' 'Bold'
Text '공통 초안을 Notion에 저장하고 Discord로 검토 요청을 보냅니다.' 390 1525 27 '#334155'
Text '검토자는 수정 없이 승인 또는 거절만 선택합니다.' 390 1568 24 '#64748b'
Arrow 900 1630 900 1715

$poly = @(
    [System.Drawing.Point]::new(900, 1715),
    [System.Drawing.Point]::new(1160, 1875),
    [System.Drawing.Point]::new(900, 2035),
    [System.Drawing.Point]::new(640, 1875)
)
$g.FillPolygon((Brush '#ffffff'), $poly)
$g.DrawPolygon((PenC '#ea580c' 5), $poly)
Text '검토자 승인?' 785 1850 36 '#111827' 'Bold'
Text '승인 또는 거절' 812 1900 24 '#64748b'

Arrow 640 1875 365 1875 '#475569'
Arrow 365 1875 365 2140 '#475569'
Text '거절' 430 1828 28 '#111827' 'Bold'

Rect 150 2140 590 210 '#dc2626'
Text '종료' 215 2190 28 '#dc2626' 'Bold'
Text '거절 처리' 370 2182 36 '#111827' 'Bold'
Text '게시하지 않고 Notion에 거절 상태를 기록합니다.' 315 2248 24 '#334155'
Text '이 콘텐츠 생성 작업은 종료됩니다.' 315 2290 22 '#64748b'

Arrow 1160 1875 1420 1875 '#475569'
Arrow 1420 1875 1420 2140 '#475569'
Text '승인' 1275 1828 28 '#111827' 'Bold'

Rect 860 2140 790 250 '#2563eb'
Text '자동' 925 2190 28 '#2563eb' 'Bold'
Text '채널별 콘텐츠 변환' 1080 2182 36 '#111827' 'Bold'
Text '공통 초안을 선택 채널 포맷으로 변환합니다.' 1080 2248 25 '#334155'
Text '활성: Instagram / 확장: Blog, Facebook, LinkedIn' 1080 2290 22 '#64748b'
Arrow 1255 2390 1255 2470

Rect 860 2470 790 250 '#e11d48'
Text 'IG' 930 2520 28 '#e11d48' 'Bold'
Text 'Instagram 카드뉴스 생성' 1080 2512 36 '#111827' 'Bold'
Text '5장 카드 문구, 캡션, 해시태그, CTA를 생성합니다.' 1080 2578 24 '#334155'
Text '1080x1080 캐러셀 이미지를 렌더링합니다.' 1080 2620 22 '#64748b'
Arrow 1255 2720 1255 2800

Rect 430 2800 940 210 '#111827'
Text '게시' 500 2850 28 '#111827' 'Bold'
Text 'Instagram 게시 및 기록' 670 2842 36 '#111827' 'Bold'
Text '이미지 업로드 후 Instagram API로 캐러셀을 게시합니다.' 670 2908 24 '#334155'
Text '게시 ID, 링크, 최종 상태를 Notion에 기록합니다.' 670 2950 22 '#64748b'

Rect 430 3040 940 55 '#2563eb'
Text '다음 캠페인 대기' 690 3049 28 '#111827' 'Bold'

Arrow 365 2350 365 3068 '#475569'
Arrow 365 3068 430 3068 '#475569'
Arrow 900 3010 900 3040 '#475569'

Arrow 1370 3068 1700 3068 '#2563eb' $true
Arrow 1700 3068 1700 630 '#2563eb' $true
Arrow 1700 630 1650 630 '#2563eb' $true

$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output $path
