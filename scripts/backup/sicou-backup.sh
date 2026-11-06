#!/bin/sh
# Backup básico do Sicou (RNF-019). Executado pelo serviço "backup" do docker-compose (imagem postgres:16).
#
# Modos:
#   schedule  (padrão) backup diário em BACKUP_TIME; ao iniciar, faz um backup se o último tiver mais de 24 h
#   once      um backup imediato, seguido da retenção
#   prune     somente a retenção
#   next      mostra o horário do próximo backup agendado
#
# Conexão: variáveis padrão do PostgreSQL (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD).
# Configuração: BACKUP_DIR (/backups), UPLOADS_DIR (/uploads), BACKUP_TIME (02:00),
#               RETENTION_DAYS (14), KEEP_MIN (3), TZ (fuso do agendamento).

BACKUP_DIR="${BACKUP_DIR:-/backups}"
UPLOADS_DIR="${UPLOADS_DIR:-/uploads}"
BACKUP_TIME="${BACKUP_TIME:-02:00}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
KEEP_MIN="${KEEP_MIN:-3}"
LOG="$BACKUP_DIR/backup.log"

mkdir -p "$BACKUP_DIR"

log() {
    printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" | tee -a "$LOG"
}

validate_config() {
    case "$RETENTION_DAYS" in ''|*[!0-9]*|0) log "ERRO: RETENTION_DAYS deve ser um inteiro maior que zero."; exit 2 ;; esac
    case "$KEEP_MIN" in ''|*[!0-9]*|0) log "ERRO: KEEP_MIN deve ser um inteiro maior que zero."; exit 2 ;; esac
    if ! date -d "today $BACKUP_TIME" +%s >/dev/null 2>&1; then
        log "ERRO: BACKUP_TIME inválido ($BACKUP_TIME). Use HH:MM."
        exit 2
    fi
}

# Gera o dump em arquivo temporário e só o publica depois de conferir que pode ser lido pelo pg_restore.
backup_once() {
    stamp=$(date '+%Y%m%d_%H%M%S')
    name="sicou_${PGDATABASE:-db}_${stamp}"
    partial="$BACKUP_DIR/.${name}.dump.partial"
    started=$(date +%s)

    if ! pg_dump --format=custom --no-owner --no-privileges --file "$partial"; then
        rm -f "$partial"
        log "FALHA: pg_dump não concluiu ($name)."
        return 1
    fi
    if ! pg_restore --list "$partial" >/dev/null; then
        rm -f "$partial"
        log "FALHA: o arquivo gerado não pôde ser lido pelo pg_restore ($name)."
        return 1
    fi
    mv "$partial" "$BACKUP_DIR/$name.dump"
    (cd "$BACKUP_DIR" && sha256sum "$name.dump" > "$name.dump.sha256")

    uploads_note="sem pasta de uploads"
    if [ -d "$UPLOADS_DIR" ]; then
        if tar -czf "$BACKUP_DIR/.${name}.uploads.partial" -C "$UPLOADS_DIR" . 2>/dev/null; then
            mv "$BACKUP_DIR/.${name}.uploads.partial" "$BACKUP_DIR/$name.uploads.tar.gz"
            uploads_note="uploads $(du -h "$BACKUP_DIR/$name.uploads.tar.gz" | cut -f1)"
        else
            rm -f "$BACKUP_DIR/.${name}.uploads.partial"
            log "AVISO: não foi possível arquivar $UPLOADS_DIR; o dump do banco foi mantido ($name)."
            uploads_note="uploads com falha"
        fi
    fi

    log "OK $name.dump ($(du -h "$BACKUP_DIR/$name.dump" | cut -f1), $uploads_note, $(( $(date +%s) - started )) s)"
    prune
}

# Mantém sempre os KEEP_MIN backups mais recentes; os demais são removidos quando passam de RETENTION_DAYS dias.
prune() {
    ls -1t "$BACKUP_DIR"/sicou_*.dump 2>/dev/null | tail -n +"$((KEEP_MIN + 1))" | while read -r file; do
        if [ -n "$(find "$file" -mtime +"$((RETENTION_DAYS - 1))")" ]; then
            base="${file%.dump}"
            rm -f "$file" "$file.sha256" "$base.uploads.tar.gz"
            log "Removido pela retenção: $(basename "$file")"
        fi
    done
    # Restos de execuções interrompidas.
    find "$BACKUP_DIR" -maxdepth 1 -name '.*.partial' -mmin +1440 -exec rm -f {} \;
}

seconds_until_next() {
    now=$(date +%s)
    target=$(date -d "today $BACKUP_TIME" +%s)
    if [ "$target" -le "$now" ]; then
        target=$(date -d "tomorrow $BACKUP_TIME" +%s)
    fi
    echo $((target - now))
}

validate_config

case "${1:-schedule}" in
    once)
        backup_once
        ;;
    prune)
        prune
        ;;
    next)
        echo "Próximo backup: $(date -d "@$(( $(date +%s) + $(seconds_until_next) ))" '+%Y-%m-%d %H:%M %Z')"
        ;;
    schedule)
        log "Agendamento iniciado: diário às $BACKUP_TIME (${TZ:-UTC}), retenção de $RETENTION_DAYS dias, mínimo de $KEEP_MIN backups."
        if [ -z "$(find "$BACKUP_DIR" -maxdepth 1 -name 'sicou_*.dump' -mmin -1440)" ]; then
            log "Nenhum backup nas últimas 24 h: executando agora."
            backup_once || log "FALHA no backup inicial; nova tentativa no próximo horário."
        fi
        while :; do
            sleep "$(seconds_until_next)"
            backup_once || log "FALHA no backup agendado; nova tentativa no próximo horário."
        done
        ;;
    *)
        echo "Uso: sicou-backup.sh [schedule|once|prune|next]" >&2
        exit 2
        ;;
esac
