export const STORAGE_STATE_PATH_ADMIN = '.playwright-auth/storage-state-admin.json';

export const ADMIN_USER = {
  username: process.env['CONFIGURACAO_E2E_USERNAME'] || 'admin',
  password: process.env['CONFIGURACAO_E2E_PASSWORD'] || 'Changeme!123',
} as const;
