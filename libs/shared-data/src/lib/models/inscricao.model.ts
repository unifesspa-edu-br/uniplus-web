export interface Inscricao {
  id: string;
  editalId: string;
  candidatoId: string;
  numero: string;
  status: StatusInscricao;
  modalidade: string;
  opcaoCurso1: OpcaoCurso;
  opcaoCurso2?: OpcaoCurso;
  criadoEm: string;
  atualizadoEm: string;
}

export interface OpcaoCurso {
  cursoId: string;
  cursoNome: string;
  campusId: string;
  campusNome: string;
  turno: 'MATUTINO' | 'VESPERTINO' | 'NOTURNO' | 'INTEGRAL';
}

export type StatusInscricao = 'RASCUNHO' | 'SUBMETIDA' | 'HOMOLOGADA' | 'INDEFERIDA' | 'CANCELADA';
