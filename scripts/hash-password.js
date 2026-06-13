'use strict';

/** Генерация scrypt-хеша пароля для ADMIN_PASSWORD_HASH в .env
 *  Использование:  npm run hash -- "ваш-длинный-пароль"
 */

const { hashPassword } = require('../src/auth/password');

const pw = process.argv[2];
if (!pw) {
  console.error('Использование: npm run hash -- "ваш-пароль"');
  process.exit(1);
}
console.log('\nВставьте это в .env как ADMIN_PASSWORD_HASH:\n');
console.log(hashPassword(pw));
console.log('\nИ уберите/очистите ADMIN_PASSWORD.');
