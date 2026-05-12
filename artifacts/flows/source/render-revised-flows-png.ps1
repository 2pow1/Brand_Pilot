Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$flowRoot = Split-Path -Parent $scriptDir
$finalDir = Join-Path $flowRoot 'final'
if (-not (Test-Path -LiteralPath $finalDir)) {
    New-Item -ItemType Directory -Path $finalDir | Out-Null
}

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

function Text($g, $s, $x, $y, $size, $color = '#111827', $style = 'Regular') {
    $g.DrawString($s, (FontK $size $style), (Brush $color), [float]$x, [float]$y)
}

function Rect($g, $x, $y, $ww, $hh, $stroke, $fill = '#ffffff') {
    $r = New-Object System.Drawing.Rectangle $x, $y, $ww, $hh
    $g.FillRectangle((Brush $fill), $r)
    $g.DrawRectangle((PenC $stroke 4), $r)
}

function Arrow($g, $x1, $y1, $x2, $y2, $color = '#1f2937', $dash = $false) {
    $p = PenC $color 5
    if ($dash) { $p.DashPattern = @(12, 8) }
    $cap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap 8, 10
    $p.CustomEndCap = $cap
    $g.DrawLine($p, $x1, $y1, $x2, $y2)
}

function Diamond($g, $cx, $cy, $rw, $rh, $stroke) {
    $poly = @(
        [System.Drawing.Point]::new($cx, $cy - $rh),
        [System.Drawing.Point]::new($cx + $rw, $cy),
        [System.Drawing.Point]::new($cx, $cy + $rh),
        [System.Drawing.Point]::new($cx - $rw, $cy)
    )
    $g.FillPolygon((Brush '#ffffff'), $poly)
    $g.DrawPolygon((PenC $stroke 5), $poly)
}

function New-Canvas($path, $w, $h) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#f8fafc'))
    return @{ Bitmap = $bmp; Graphics = $g; Path = $path }
}

function Save-Canvas($canvas) {
    $canvas.Bitmap.Save($canvas.Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Graphics.Dispose()
    $canvas.Bitmap.Dispose()
    Write-Output $canvas.Path
}

function Render-UserFlow {
    $path = Join-Path $finalDir 'brand-pilot-client-user-flow-v2.png'
    $c = New-Canvas $path 1700 2350
    $g = $c.Graphics

    Text $g '클라이언트 사용 흐름도' 120 90 54 '#111827' 'Bold'
    Text $g '타사를 브랜딩하는 클라이언트가 자사 홍보 콘텐츠를 자동으로 확보하는 흐름' 120 158 27 '#475569'

    Rect $g 150 240 1400 185 '#4f46e5'
    Text $g '1회' 215 286 28 '#4f46e5' 'Bold'
    Text $g '자사 홍보 설정' 390 278 36 '#111827' 'Bold'
    Text $g '클라이언트의 회사 소개, 서비스, 홍보 톤, CTA, 채널 템플릿을 등록합니다.' 390 344 27 '#334155'
    Text $g 'Discord 검수 채널과 Notion 기록 공간도 연결합니다.' 390 385 23 '#64748b'
    Arrow $g 850 425 850 505

    Rect $g 150 505 1400 205 '#059669'
    Text $g '자동' 215 555 28 '#059669' 'Bold'
    Text $g '해외 자료 탐색' 390 548 36 '#111827' 'Bold'
    Text $g '등록된 해외 사이트에서 브랜딩, 홍보, 마케팅 관련 소재를 찾습니다.' 390 612 27 '#334155'
    Text $g '소스는 추후 추가/삭제될 수 있습니다.' 390 655 23 '#64748b'
    Arrow $g 850 710 850 790

    Rect $g 150 790 1400 205 '#0f766e'
    Text $g '자동' 215 840 28 '#0f766e' 'Bold'
    Text $g '공통 초안 생성' 390 833 36 '#111827' 'Bold'
    Text $g 'GPT API가 해외 자료를 바탕으로 클라이언트 자사 홍보용 초안을 작성합니다.' 390 897 27 '#334155'
    Text $g '이 단계에서는 아직 채널별 콘텐츠를 만들거나 게시하지 않습니다.' 390 940 23 '#64748b'
    Arrow $g 850 995 850 1075

    Rect $g 150 1075 1400 205 '#f97316'
    Text $g '검수' 215 1125 28 '#f97316' 'Bold'
    Text $g 'Discord에서 초안 확인' 390 1118 36 '#111827' 'Bold'
    Text $g '클라이언트가 초안을 보고 승인 또는 거절만 선택합니다.' 390 1182 27 '#334155'
    Text $g '초안이 대기 중이어도 시스템은 다음 후보를 계속 찾을 수 있습니다.' 390 1225 23 '#64748b'
    Arrow $g 850 1280 850 1365

    Diamond $g 850 1515 250 150 '#ea580c'
    Text $g '초안 승인?' 755 1490 36 '#111827' 'Bold'
    Text $g '승인 또는 거절' 767 1540 24 '#64748b'

    Arrow $g 600 1515 340 1515 '#475569'
    Arrow $g 340 1515 340 1760 '#475569'
    Text $g '거절' 400 1468 27 '#111827' 'Bold'

    Rect $g 150 1760 560 185 '#dc2626'
    Text $g '종료' 215 1806 28 '#dc2626' 'Bold'
    Text $g '게시하지 않음' 350 1800 34 '#111827' 'Bold'
    Text $g '해당 초안은 콘텐츠로 생성하지 않습니다.' 350 1862 25 '#334155'
    Text $g '다음 후보 초안 검수로 넘어갑니다.' 350 1902 23 '#64748b'

    Arrow $g 1100 1515 1360 1515 '#475569'
    Arrow $g 1360 1515 1360 1760 '#475569'
    Text $g '승인' 1220 1468 27 '#111827' 'Bold'

    Rect $g 850 1760 700 240 '#2563eb'
    Text $g '자동' 915 1810 28 '#2563eb' 'Bold'
    Text $g '채널별 콘텐츠 생성' 1070 1802 34 '#111827' 'Bold'
    Text $g '승인된 초안을 채널별 템플릿으로 변환합니다.' 1050 1864 25 '#334155'
    Text $g '예: Instagram, 블로그, LinkedIn/Facebook' 1050 1904 22 '#64748b'
    Arrow $g 1200 2000 1200 2080

    Rect $g 500 2080 800 120 '#111827'
    Text $g '반복' 570 2116 28 '#111827' 'Bold'
    Text $g '다음 자료 탐색 및 초안 검수로 반복' 760 2110 31 '#111827' 'Bold'
    Text $g '검수 대기와 다음 초안 준비는 동시에 진행될 수 있습니다.' 760 2154 23 '#64748b'

    Arrow $g 340 1945 340 2140 '#475569'
    Arrow $g 340 2140 500 2140 '#475569'
    Arrow $g 1300 2140 1600 2140 '#2563eb' $true
    Arrow $g 1600 2140 1600 607 '#2563eb' $true
    Arrow $g 1600 607 1550 607 '#2563eb' $true

    Save-Canvas $c
}

function Render-ProgramFlow {
    $path = Join-Path $finalDir 'brand-pilot-program-flow-v2.png'
    $c = New-Canvas $path 1900 3450
    $g = $c.Graphics

    Text $g '프로그램 동작 순서도' 120 92 56 '#111827' 'Bold'
    Text $g '해외 자료 수집, 공통 초안 검수, 승인 후 채널별 콘텐츠 생성이 병렬 큐로 반복되는 구조' 120 160 28 '#475569'

    Rect $g 150 245 1600 225 '#4f46e5'
    Text $g '1회' 220 300 28 '#4f46e5' 'Bold'
    Text $g '초기 설정' 420 292 38 '#111827' 'Bold'
    Text $g '클라이언트 자사 브랜드 정보, 홍보 톤, CTA, 채널 템플릿을 등록합니다.' 420 360 27 '#334155'
    Text $g '자료 소스 목록, Discord 검수 채널, Notion DB, 게시 채널/API 설정을 연결합니다.' 420 404 23 '#64748b'
    Arrow $g 950 470 950 550

    Rect $g 150 550 1600 225 '#059669'
    Text $g '반복' 220 604 28 '#059669' 'Bold'
    Text $g '자료 소스 스케줄러 실행' 420 596 37 '#111827' 'Bold'
    Text $g '등록된 해외 사이트를 주기적으로 확인합니다.' 420 662 27 '#334155'
    Text $g 'Baemin CEO, The Branding Journal, OpenSurvey, Stone, TrendWatching, Hootsuite 등' 420 705 22 '#64748b'
    Arrow $g 950 775 950 855

    Rect $g 150 855 1600 230 '#0f766e'
    Text $g '자동' 220 910 28 '#0f766e' 'Bold'
    Text $g '콘텐츠 후보 수집 및 정리' 420 902 37 '#111827' 'Bold'
    Text $g '본문 추출, 중복 제거, 언어/주제 분류, 브랜딩/마케팅 관련성 점수를 계산합니다.' 420 968 26 '#334155'
    Text $g '2주 MVP에서는 먼저 지정 사이트와 제공 URL 중심으로 범위를 제한합니다.' 420 1012 23 '#64748b'
    Arrow $g 950 1085 950 1165

    Rect $g 150 1165 1600 230 '#0f766e'
    Text $g '자동' 220 1220 28 '#0f766e' 'Bold'
    Text $g 'GPT API: 공통 초안 작성' 420 1212 37 '#111827' 'Bold'
    Text $g '해외 자료의 핵심 인사이트를 클라이언트 자사 홍보 메시지로 재구성합니다.' 420 1278 26 '#334155'
    Text $g '아직 Instagram이나 블로그 같은 채널별 포맷으로 확정하지 않습니다.' 420 1322 23 '#64748b'
    Arrow $g 950 1395 950 1475

    Rect $g 150 1475 1600 230 '#f97316'
    Text $g '대기열' 220 1530 28 '#f97316' 'Bold'
    Text $g '초안 저장 및 검수 요청' 420 1522 37 '#111827' 'Bold'
    Text $g '초안을 Notion에 저장하고 Discord에 승인/거절 버튼과 함께 전송합니다.' 420 1588 26 '#334155'
    Text $g '상태: draft_created → pending_review' 420 1632 23 '#64748b'
    Arrow $g 950 1705 950 1785

    Diamond $g 950 1945 270 160 '#ea580c'
    Text $g '검수 승인?' 850 1918 37 '#111827' 'Bold'
    Text $g '승인 또는 거절' 864 1970 24 '#64748b'

    Arrow $g 680 1945 390 1945 '#475569'
    Arrow $g 390 1945 390 2230 '#475569'
    Text $g '거절' 455 1898 28 '#111827' 'Bold'

    Rect $g 150 2230 650 220 '#dc2626'
    Text $g '종료' 220 2285 28 '#dc2626' 'Bold'
    Text $g '거절 상태 기록' 395 2278 36 '#111827' 'Bold'
    Text $g 'Notion에 rejected 상태를 기록합니다.' 330 2342 24 '#334155'
    Text $g '해당 초안의 채널별 생성은 실행하지 않습니다.' 330 2384 22 '#64748b'

    Arrow $g 1220 1945 1510 1945 '#475569'
    Arrow $g 1510 1945 1510 2230 '#475569'
    Text $g '승인' 1355 1898 28 '#111827' 'Bold'

    Rect $g 900 2230 850 240 '#2563eb'
    Text $g '자동' 970 2288 28 '#2563eb' 'Bold'
    Text $g '채널별 템플릿 적용' 1160 2278 36 '#111827' 'Bold'
    Text $g '공통 초안을 채널 템플릿에 맞춰 변환합니다.' 1160 2342 24 '#334155'
    Text $g 'Instagram 활성, 기타 채널은 확장 구조로 유지합니다.' 1160 2384 22 '#64748b'
    Arrow $g 1325 2470 1325 2550

    Rect $g 900 2550 850 240 '#e11d48'
    Text $g 'IG' 975 2608 28 '#e11d48' 'Bold'
    Text $g 'Instagram 콘텐츠 생성' 1160 2598 36 '#111827' 'Bold'
    Text $g '카드뉴스 5장 문구, 캡션, 해시태그, CTA를 생성합니다.' 1160 2662 24 '#334155'
    Text $g '필요 시 1080x1080 캐러셀 이미지를 렌더링합니다.' 1160 2704 22 '#64748b'
    Arrow $g 1325 2790 1325 2870

    Rect $g 550 2870 1000 220 '#111827'
    Text $g '출력' 630 2925 28 '#111827' 'Bold'
    Text $g '채널별 콘텐츠 저장 또는 게시' 830 2918 36 '#111827' 'Bold'
    Text $g '생성 결과와 게시 상태를 Notion에 기록합니다.' 830 2982 25 '#334155'
    Text $g 'Instagram은 API 게시까지 연결, 기타 채널은 확장 대상입니다.' 830 3024 22 '#64748b'

    Rect $g 550 3180 1000 110 '#2563eb'
    Text $g '동시 반복' 630 3216 28 '#2563eb' 'Bold'
    Text $g '다음 후보 수집/초안 생성은 검수 대기와 별도로 진행' 840 3210 27 '#111827' 'Bold'

    Arrow $g 390 2450 390 3235 '#475569'
    Arrow $g 390 3235 550 3235 '#475569'
    Arrow $g 1050 3090 1050 3180 '#475569'

    Arrow $g 1550 3235 1820 3235 '#2563eb' $true
    Arrow $g 1820 3235 1820 662 '#2563eb' $true
    Arrow $g 1820 662 1750 662 '#2563eb' $true

    # Concurrency hint from pending review back to source scheduler.
    Arrow $g 1750 1590 1820 1590 '#2563eb' $true
    Text $g '검수 대기 중에도 다음 후보 준비' 1420 1548 22 '#2563eb' 'Bold'

    Save-Canvas $c
}

Render-UserFlow
Render-ProgramFlow
