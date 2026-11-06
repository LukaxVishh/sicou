#!/usr/bin/env python3
"""Run a local command and report its lifecycle to Sicou (Python 3.10+, standard library).
The token is read only from SICOU_INTEGRATION_TOKEN. No remote commands, output upload,
password files or shell expansion are used. Configure scheduling with cron/Task Scheduler.
"""
import argparse
import json
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


class ApiError(Exception):
    def __init__(self, status):
        self.status = status
        super().__init__(f"Sicou retornou HTTP {status}.")


class Client:
    def __init__(self, base_url, token):
        url = urllib.parse.urlparse(base_url)
        if url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1', '::1')):
            raise ValueError('Use HTTPS para acessar o Sicou fora do computador local.')
        if url.username or url.password or url.query or url.fragment:
            raise ValueError('A URL deve conter somente esquema, host, porta e prefixo opcional.')
        self.base_url = base_url.rstrip('/')
        self.token = token

    def post(self, path, body=None, attempts=4):
        payload = json.dumps(body or {}).encode()
        for attempt in range(attempts):
            request = urllib.request.Request(self.base_url + path, data=payload, headers={
                'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json',
            }, method='POST')
            try:
                with urllib.request.urlopen(request, timeout=5) as response:
                    return json.load(response)
            except urllib.error.HTTPError as error:
                # Do not print response bodies, which can contain operational data.
                if error.code not in (429, 500, 502, 503, 504) or attempt == attempts - 1:
                    raise ApiError(error.code) from None
            except (urllib.error.URLError, TimeoutError, OSError):
                if attempt == attempts - 1:
                    raise ConnectionError('Não foi possível comunicar com o Sicou.') from None
            time.sleep(min(2 ** attempt, 4))


def stop_child(child):
    if child.poll() is not None:
        return
    # On POSIX, terminate the process group so local descendants do not outlive the run.
    if os.name == 'posix':
        os.killpg(child.pid, signal.SIGTERM)
    else:
        child.terminate()
    try:
        child.wait(timeout=5)
    except subprocess.TimeoutExpired:
        if os.name == 'posix':
            os.killpg(child.pid, signal.SIGKILL)
        else:
            child.kill()
        child.wait()


def main(argv=None):
    parser = argparse.ArgumentParser(description='Executa uma automação local e informa seu estado ao Sicou.')
    parser.add_argument('--url', default=os.environ.get('SICOU_API_URL'))
    parser.add_argument('--automation-id', default=os.environ.get('SICOU_AUTOMATION_ID'))
    parser.add_argument('command', nargs=argparse.REMAINDER, help='Comando local após --')
    args = parser.parse_args(argv)
    token = os.environ.get('SICOU_INTEGRATION_TOKEN', '')
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not args.url or not args.automation_id or not token or not command:
        parser.error('Configure SICOU_API_URL, SICOU_AUTOMATION_ID, SICOU_INTEGRATION_TOKEN e informe um comando após --.')
    try:
        automation_id = str(uuid.UUID(args.automation_id))
        client = Client(args.url, token)
    except ValueError as error:
        parser.error(str(error))
    child = None
    run_id = None
    interrupted = False

    def interrupt(_signal, _frame):
        nonlocal interrupted
        interrupted = True

    old_handlers = {sig: signal.signal(sig, interrupt) for sig in (signal.SIGINT, signal.SIGTERM)}
    try:
        # One UUID is preserved for every retry of this start. A later invocation creates
        # a new execution; this wrapper never replays an arbitrary previous run's command.
        run = client.post(f'/api/automations/{automation_id}/runs', {
            'externalId': str(uuid.uuid4()), 'host': socket.gethostname()[:100],
        })
        run_id = run['id']
        if interrupted:
            client.post(f'/api/automations/runs/{run_id}/complete', {'succeeded': False, 'message': 'Execução interrompida antes de iniciar o comando.'})
            return 130
        child = subprocess.Popen(command, start_new_session=os.name == 'posix')
        next_heartbeat = time.monotonic() + 10
        while child.poll() is None:
            if interrupted:
                stop_child(child)
                break
            if time.monotonic() >= next_heartbeat:
                try:
                    client.post(f'/api/automations/runs/{run_id}/heartbeat', attempts=2)
                except ApiError as error:
                    if error.status in (401, 403, 404, 409):
                        stop_child(child)
                        print(str(error) + ' Comando local interrompido.', file=sys.stderr)
                        return 1
                    print(str(error), file=sys.stderr)
                except ConnectionError as error:
                    print(str(error), file=sys.stderr)
                next_heartbeat = time.monotonic() + 10
            time.sleep(0.2)
        code = child.wait()
        client.post(f'/api/automations/runs/{run_id}/complete', {
            'succeeded': code == 0 and not interrupted, 'exitCode': code,
            'message': 'Comando interrompido localmente.' if interrupted else 'Comando finalizado.' if code == 0 else 'Comando terminou com código de erro.',
        })
        return 130 if interrupted else code if 0 <= code <= 255 else 1
    except (ApiError, ConnectionError, OSError) as error:
        if child is not None:
            stop_child(child)
        # A failed executable launch must be reflected as failure, rather than remaining Running.
        if run_id and child is None:
            try:
                client.post(f'/api/automations/runs/{run_id}/complete', {'succeeded': False, 'message': 'Não foi possível iniciar o comando local.'})
            except (ApiError, ConnectionError):
                pass
        print(str(error) if isinstance(error, (ApiError, ConnectionError)) else 'Falha ao executar o comando local.', file=sys.stderr)
        return 1
    finally:
        for sig, handler in old_handlers.items():
            signal.signal(sig, handler)


if __name__ == '__main__':
    sys.exit(main())
