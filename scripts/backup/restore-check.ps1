<#
.SYNOPSIS
Valida um backup do Sicou restaurando-o em um PostgreSQL temporario e separado (RNF-019).

.DESCRIPTION
Sobe um container postgres:16 descartavel, sem portas publicadas, restaura o dump, confere o hash
(quando existir o arquivo .sha256), lista as contagens de todas as tabelas e a ultima migration aplicada.
Com -CompareWithContainer, compara as contagens com o banco de origem. O banco em uso nao e alterado,
e o container temporario e removido ao final, inclusive em caso de erro.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts/backup/restore-check.ps1 -DumpPath backups/sicou_sicou-dev_20261105_020000.dump

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts/backup/restore-check.ps1 -DumpPath backups/arquivo.dump -CompareWithContainer Sicou-DB
#>
param(
    [Parameter(Mandatory = $true)][string]$DumpPath,
    [string]$CompareWithContainer = '',
    [string]$CompareDatabase = 'sicou-dev',
    [string]$Image = 'postgres:16'
)

$ErrorActionPreference = 'Stop'
$dump = (Resolve-Path -LiteralPath $DumpPath).Path

$hashFile = "$dump.sha256"
if (Test-Path -LiteralPath $hashFile) {
    $expected = ((Get-Content -LiteralPath $hashFile -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
    $actual = (Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($expected -ne $actual) { throw "Hash SHA-256 diferente do registrado em $hashFile. O arquivo pode estar corrompido." }
    Write-Output 'Hash SHA-256 conferido.'
} else {
    Write-Output 'Aviso: arquivo .sha256 nao encontrado; integridade conferida apenas pela restauracao.'
}

# Contagem de linhas de todas as tabelas do schema public, uma por linha: tabela|quantidade
$countSql = "select table_name || '|' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name;"

function Get-TableCounts([string]$container, [string]$database) {
    $lines = docker exec $container psql -U postgres -d $database -At -c $countSql
    if ($LASTEXITCODE -ne 0) { throw "Falha ao contar as tabelas em $container/$database." }
    $counts = [ordered]@{}
    foreach ($line in $lines) {
        $parts = $line -split '\|'
        if ($parts.Count -eq 2) { $counts[$parts[0]] = [long]$parts[1] }
    }
    return $counts
}

$name = 'sicou-restore-check-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$password = [guid]::NewGuid().ToString('N')
$started = Get-Date
docker run -d --name $name -e "POSTGRES_PASSWORD=$password" -e POSTGRES_DB=restore_check $Image | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel iniciar o PostgreSQL temporario.' }

try {
    # O entrypoint reinicia o servidor apos a inicializacao; exige tres respostas seguidas da instancia definitiva.
    $ready = $false
    $streak = 0
    for ($i = 0; $i -lt 90; $i++) {
        docker exec $name sh -c "psql -U postgres -d restore_check -At -c 'select 1' >/dev/null 2>&1"
        if ($LASTEXITCODE -eq 0) { $streak++ } else { $streak = 0 }
        if ($streak -ge 3) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'O PostgreSQL temporario nao ficou pronto.' }

    docker cp $dump "${name}:/tmp/backup.dump" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao copiar o dump para o container temporario.' }

    docker exec $name pg_restore --no-owner --no-privileges --exit-on-error -U postgres -d restore_check /tmp/backup.dump
    if ($LASTEXITCODE -ne 0) { throw 'pg_restore falhou: o backup NAO foi validado.' }

    $restored = Get-TableCounts $name 'restore_check'
    if ($restored.Count -eq 0) { throw 'Nenhuma tabela restaurada.' }
    # Pela entrada padrao: o PowerShell 5.1 remove aspas duplas de argumentos de programas externos.
    $migration = 'select max("MigrationId") from "__EFMigrationsHistory";' | docker exec -i $name psql -U postgres -d restore_check -At

    Write-Output ''
    Write-Output ("Restauracao concluida em {0:N0} s, em container separado ({1})." -f ((Get-Date) - $started).TotalSeconds, $name)
    Write-Output ("Tabelas restauradas: {0}. Ultima migration: {1}" -f $restored.Count, $migration)
    foreach ($table in @('companies', 'units', 'users', 'user_area_accesses', 'process_instances', 'process_histories', 'guide_items', 'posts')) {
        if ($restored.Contains($table)) { Write-Output ("  {0}: {1}" -f $table, $restored[$table]) }
    }

    if ($CompareWithContainer) {
        $source = Get-TableCounts $CompareWithContainer $CompareDatabase
        $differences = @()
        foreach ($table in $source.Keys) {
            if (-not $restored.Contains($table)) { $differences += "$table ausente no backup" }
            elseif ($restored[$table] -ne $source[$table]) { $differences += ("{0}: origem {1}, backup {2}" -f $table, $source[$table], $restored[$table]) }
        }
        if ($differences.Count -gt 0) {
            Write-Output ''
            Write-Output 'Diferencas em relacao a origem (a origem pode ter mudado depois do backup):'
            $differences | ForEach-Object { Write-Output "  $_" }
            throw ("{0} tabela(s) com contagem diferente da origem." -f $differences.Count)
        }
        Write-Output ("Contagens iguais as da origem em todas as {0} tabelas ({1}/{2})." -f $source.Count, $CompareWithContainer, $CompareDatabase)
    }
    Write-Output 'Backup VALIDADO.'
}
finally {
    docker rm -f $name | Out-Null
}
