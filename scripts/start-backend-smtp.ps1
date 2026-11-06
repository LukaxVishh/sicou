param([switch]$ValidateOnly)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $projectRoot '.env.smtp.local'
if (!(Test-Path -LiteralPath $configPath)) {
    throw 'Crie .env.smtp.local a partir de .env.smtp.example (guia em _mds/ATUALIZACOES/2026-11-06.md).'
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
# SDK local (.tools, ignorado pelo Git) quando existir; senao, o dotnet do PATH.
$localSdk = Join-Path $projectRoot '.tools/dotnet/dotnet.exe'
if (Test-Path -LiteralPath $localSdk) {
    $dotnet = $localSdk
} elseif (Get-Command dotnet -ErrorAction SilentlyContinue) {
    $dotnet = 'dotnet'
} else {
    throw 'SDK do .NET 8 nao encontrado. Instale o SDK (comando dotnet no PATH) ou coloque um SDK local em .tools/dotnet.'
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
    $previous['DOTNET_CLI_HOME'] = [Environment]::GetEnvironmentVariable('DOTNET_CLI_HOME', 'Process')
    if ($dotnet -eq $localSdk) {
        $env:DOTNET_CLI_HOME = Join-Path $projectRoot '.cache/dotnet-home'
    }
    # Banco: ConnectionStrings__DefaultConnection, se definida; senao, o padrao do appsettings.json.
    if ($env:ConnectionStrings__DefaultConnection) {
        Write-Output 'Banco: definido em ConnectionStrings__DefaultConnection.'
    } else {
        Write-Output 'Banco: padrao do appsettings.json (localhost:5432, sicou-dev).'
    }
    & $dotnet run --project (Join-Path $projectRoot 'backend/src/Api') --launch-profile http
    if ($LASTEXITCODE -ne 0) { throw 'A API encerrou com erro; consulte a saida acima.' }
}
finally {
    foreach ($name in $previous.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
    }
}
