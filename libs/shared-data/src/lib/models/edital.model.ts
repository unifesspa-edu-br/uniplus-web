export interface Edital {
  id: string;
  titulo: string;
  numero: string;
  ano: number;
  tipo: TipoProcesso;
  status: StatusEdital;
  dataPublicacao?: string;
  dataInicioInscricao?: string;
  dataFimInscricao?: string;
  quantidadeVagas: number;
  criadoEm: string;
  atualizadoEm: string;
}

export type TipoProcesso =
  | 'SISU'
  | 'PSIQ'
  | 'PSE_CAMPO'
  | 'PSVR'
  | 'TRANSFERENCIA_INTERNA'
  | 'TRANSFERENCIA_EXTERNA';

export type StatusEdital = 'RASCUNHO' | 'PUBLICADO' | 'INSCRICOES_ABERTAS' | 'EM_ANDAMENTO' | 'ENCERRADO' | 'CANCELADO';
