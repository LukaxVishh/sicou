param([switch]$ValidateOnly)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $projectRoot '.env.smtp.local'
if (!(Test-Path -LiteralPath $configPath)) {
    throw 'Crie .env.smtp.local conforme o guia _mds/SMTP.md.'
}
$settings = @{}
foreach ($line in Get-Content -LiteralPath $configPath -Encoding UTF8) {
    if ($line -match '^\s*(SMTP_[A-Z_]+)=(.*)$') {
        $settings[$Matches[1]] = $Matches[2].Trim()
    }
}
foreach ($key in @('SMTP_HOST', 'SMTP_PORT', 'SMTP_ENABLE_SSL', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'SMTP_FROM_ADDRESS', 'SMTP_FRONTEND_BASE_URL')) {
    if ([string]::IsNullOrWhiteSpace($settings[$key])) {
        throw "Preencha $key em .env.smtp.local antes de iniciar."
    }
}
if ($ValidateOnly) {
    Write-Output 'Campos SMTP preenchidos. Autenticacao e entrega ainda precisam ser validadas.'
    return
}
$mapping = @{
    SMTP_HOST='Host'; SMTP_PORT='Port'; SMTP_ENABLE_SSL='EnableSsl';
    SMTP_USERNAME='Username'; SMTP_PASSWORD='Password';
    SMTP_FROM_ADDRESS='FromAddress'; SMTP_FRONTEND_BASE_URL='FrontendBaseUrl'
}
$previous = @{}
try {
    foreach ($key in $mapping.Keys) {
        $name = 'Email__' + $mapping[$key]
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $settings[$key], 'Process')
    }
    foreach ($name in @('DOTNET_CLI_HOME', 'ConnectionStrings__DefaultConnection')) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    }
    $env:DOTNET_CLI_HOME = Join-Path $projectRoot '.cache/dotnet-home'
    if (!$env:ConnectionStrings__DefaultConnection) {
        $env:ConnectionStrings__DefaultConnection = 'Host=127.0.0.1;Port=55439;Database=guide_test;Username=guide_test'
    }
    & (Join-Path $projectRoot '.tools/dotnet/dotnet.exe') run --project (Join-Path $projectRoot 'backend/src/Api') --launch-profile http --no-restore
    if ($LASTEXITCODE -ne 0) { throw 'A API encerrou com erro; consulte a saida acima.' }
}
finally {
    foreach ($name in $previous.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
    }
}
