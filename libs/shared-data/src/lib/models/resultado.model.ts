export interface Resultado {
  id: string;
  editalId: string;
  inscricaoId: string;
  candidatoNome: string;
  cursoNome: string;
  modalidade: string;
  notaFinal: number;
  classificacao: number;
  status: StatusResultado;
}

export type StatusResultado = 'CLASSIFICADO' | 'LISTA_ESPERA' | 'ELIMINADO' | 'DESCLASSIFICADO';
