export interface Cota {
  id: string;
  codigo: ModalidadeConcorrencia;
  descricao: string;
  percentual: number;
  ordemRemanejamento: ModalidadeConcorrencia[];
}

export type ModalidadeConcorrencia =
  | 'AC'
  | 'V'
  | 'LB_PPI'
  | 'LB_Q'
  | 'LB_PcD'
  | 'LB_EP'
  | 'LI_PPI'
  | 'LI_Q'
  | 'LI_PcD'
  | 'LI_EP';
