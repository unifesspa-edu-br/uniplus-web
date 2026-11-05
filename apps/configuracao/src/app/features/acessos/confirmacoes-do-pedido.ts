export type Acao = 'aprovar' | 'recusar' | 'aceitar' | 'cancelar';

interface Confirmacao {
  readonly titulo: string;
  readonly mensagem: string;
  readonly rotulo: string;
}

export const CONFIRMACOES: Readonly<Record<Acao, Confirmacao>> = {
  aprovar: {
    titulo: 'Aprovar o pedido',
    mensagem:
      'Confirma a aprovação desta etapa? A decisão fica registrada na trilha com o seu nome.',
    rotulo: 'Aprovar',
  },
  aceitar: {
    titulo: 'Aceitar o pedido',
    mensagem: 'Confirma que você é o beneficiário e quer receber este acesso?',
    rotulo: 'Aceitar',
  },
  cancelar: {
    titulo: 'Cancelar o pedido',
    mensagem: 'O pedido sai das filas dos aprovadores. Deseja cancelá-lo?',
    rotulo: 'Cancelar pedido',
  },
  recusar: { titulo: 'Recusar o pedido', mensagem: '', rotulo: 'Recusar' },
};
