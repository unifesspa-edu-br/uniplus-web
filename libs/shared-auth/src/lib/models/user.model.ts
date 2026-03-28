export interface UserProfile {
  id: string;
  username: string;
  email: string;
  nomeCivil: string;
  nomeSocial?: string;
  cpf: string;
  roles: string[];
}

export type UserRole = 'admin' | 'gestor' | 'avaliador' | 'candidato';
