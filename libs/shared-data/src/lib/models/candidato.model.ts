export interface Candidato {
  id: string;
  cpf: string;
  nomeCivil: string;
  nomeSocial?: string;
  dataNascimento: string;
  email: string;
  telefone: string;
  sexo: 'M' | 'F';
  pcd: boolean;
  tipoPcd?: string;
}
