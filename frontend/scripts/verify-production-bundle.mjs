import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const assets = new URL('../dist/assets/', import.meta.url);
const files = (await readdir(assets)).filter(file => file.endsWith('.js'));
const bundle = (await Promise.all(files.map(file => readFile(new URL(file, assets), 'utf8')))).join('\n');
const required = ['password-recovery', 'change-password', 'forgot-password', 'reset-password', 'notification-panel', 'mustChangePassword'];
if (!/getElementById\(["'`]root["'`]\)/.test(bundle) || required.some(value => !bundle.includes(value))) {
  throw new Error(`O build em ${join('dist', 'assets')} não preservou a inicialização e as telas da aplicação.`);
}
console.log('Pacote de produção preserva a inicialização React, recuperação de senha e notificações.');
