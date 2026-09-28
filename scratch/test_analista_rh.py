import urllib.request
import json

base_url = 'http://localhost:5175'

def login(email, password):
    req = urllib.request.Request(
        base_url + '/api/auth/login',
        data=json.dumps({'email': email, 'password': password}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        return data['accessToken'], data['user']

def build_multipart(fields):
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    lines = []
    for name, value in fields.items():
        lines.append(f'--{boundary}')
        lines.append(f'Content-Disposition: form-data; name="{name}"')
        lines.append('')
        lines.append(str(value))
    lines.append(f'--{boundary}--')
    lines.append('')
    return '\r\n'.join(lines), boundary

token, user = login('analista.rh@aurora.com', 'Senha@123')

req = urllib.request.Request(base_url + '/api/user-area-accesses/by-user/' + user['id'], headers={'Authorization': 'Bearer ' + token})
with urllib.request.urlopen(req) as resp:
    accesses = json.loads(resp.read().decode('utf-8'))
rh_access = accesses[0]
rh_area_id = rh_access['areaId']
print('RH Area ID:', rh_area_id, 'Name:', rh_access['areaName'])

body, boundary = build_multipart({
    'title': 'Comunicado RH: Novo Programa de Integracao',
    'content': 'Estamos iniciando o novo ciclo de integracao para todos os novos colaboradores.',
    'areaId': rh_area_id
})

req = urllib.request.Request(
    base_url + '/api/posts',
    data=body.encode('utf-8'),
    headers={
        'Authorization': 'Bearer ' + token,
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    }
)
with urllib.request.urlopen(req) as resp:
    post_data = json.loads(resp.read().decode('utf-8'))
    print('Post criado com sucesso!', post_data['id'], 'Titulo:', post_data['title'], 'Area:', post_data['areaName'])
