import { SENHA_DAS_PERSONAS } from '@uniplus/shared-e2e';
export const STORAGE_STATE_PATH_ADMIN = '.playwright-auth/storage-state-admin.json';

export const ADMIN_USER = {
  username: process.env['CONFIGURACAO_E2E_USERNAME'] || 'admin',
  password: SENHA_DAS_PERSONAS,
} as const;
