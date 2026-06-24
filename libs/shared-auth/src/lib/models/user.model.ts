export interface UserProfile {
  id: string;
  username: string;
  email: string;
  nomeCivil: string;
  nomeSocial?: string;
  cpf: string;
  roles: string[];
}

export type UserRole = 'admin' | 'gestor' | 'avaliador' | 'candidato' | 'plataforma-admin';

export const DOMAIN_ROLES = new Set<string>([
  'admin',
  'gestor',
  'avaliador',
  'candidato',
  'plataforma-admin',
] satisfies UserRole[]);

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  avaliador: 'Avaliador',
  candidato: 'Candidato',
  'plataforma-admin': 'Administrador da Plataforma',
};
