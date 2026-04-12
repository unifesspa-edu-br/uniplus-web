export interface Inscricao {
  nome: string;
  cpf: string;
  email: string;
  cursoId: string;
  cidadeId: string;
  modalidadeCota: string;
  opcaoCurso: 'primeira' | 'segunda';
}

export interface Curso {
  id: string;
  nome: string;
}

export interface Cidade {
  id: string;
  nome: string;
  uf: string;
}

export const CURSOS_MOCK: Curso[] = [
  { id: '1', nome: 'Ciência da Computação' },
  { id: '2', nome: 'Sistemas de Informação' },
  { id: '3', nome: 'Engenharia da Computação' },
  { id: '4', nome: 'Direito' },
  { id: '5', nome: 'Medicina' },
];

export const CIDADES_MOCK: Cidade[] = [
  { id: '1', nome: 'Marabá', uf: 'PA' },
  { id: '2', nome: 'Rondon do Pará', uf: 'PA' },
  { id: '3', nome: 'São Félix do Xingu', uf: 'PA' },
  { id: '4', nome: 'Xinguara', uf: 'PA' },
  { id: '5', nome: 'Santana do Araguaia', uf: 'PA' },
  { id: '6', nome: 'Tucuruí', uf: 'PA' },
  { id: '7', nome: 'Parauapebas', uf: 'PA' },
  { id: '8', nome: 'Canaã dos Carajás', uf: 'PA' },
];

export const MODALIDADES_COTA = [
  { id: 'AC', label: 'Ampla Concorrência' },
  { id: 'LB_EP', label: 'Escola pública (renda ≤ 1 SM)' },
  { id: 'LB_PPI', label: 'Preto, pardo ou indígena (renda ≤ 1 SM)' },
  { id: 'LB_PCD', label: 'Pessoa com deficiência (renda ≤ 1 SM)' },
  { id: 'LI_EP', label: 'Escola pública (independente de renda)' },
  { id: 'LI_PPI', label: 'Preto, pardo ou indígena (independente de renda)' },
  { id: 'LI_PCD', label: 'Pessoa com deficiência (independente de renda)' },
] as const;
