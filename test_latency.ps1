# 렌더 서버 HTTP 응답 시간 측정 스크립트
$url = 'https://fising-master.onrender.com'

Write-Host "렌더 서버 응답 시간 테스트 시작..." -ForegroundColor Green

for ($i = 1; $i -le 5; $i++) {
    $start = Get-Date
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 10
        $end = Get-Date
        $duration = ($end - $start).TotalMilliseconds
        Write-Host "테스트 $i : $([math]::Round($duration, 0))ms - 상태코드: $($response.StatusCode)" -ForegroundColor Cyan
    } catch {
        $end = Get-Date
        $duration = ($end - $start).TotalMilliseconds
        Write-Host "테스트 $i : $([math]::Round($duration, 0))ms - 오류: $($_.Exception.Message)" -ForegroundColor Red
    }
    Start-Sleep -Seconds 1
}

Write-Host "`n네트워크 진단 완료!" -ForegroundColor Green
