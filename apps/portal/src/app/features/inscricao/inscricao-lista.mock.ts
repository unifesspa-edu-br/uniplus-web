export type InscricaoStatus = 'rascunho' | 'analise' | 'aprovada' | 'reprovada';
interface InscricaoMock {
  id: string;
  editalLabel: string;
  status: InscricaoStatus;
  mensagem: string;
  nome: string;
  mensagemPrazo: string;
}
export const INSCRICOES_MOCK: InscricaoMock[] = [
  {
    id: '1',
    editalLabel: 'Edital 12/2026',
    status: 'rascunho',
    nome: 'Auxílio estudantil 2026',
    mensagem: 'Você está na etapa 3 de 5. Faltam só duas etapas para terminar.',
    mensagemPrazo: 'Prazo até 16 de abril',
  },
  {
    id: '2',
    editalLabel: 'Edital 08/2025',
    status: 'analise',
    nome: 'Bolsa de Iniciação científica',
    mensagem: 'Você está na etapa 3 de 5. Faltam só duas etapas para terminar.',
    mensagemPrazo: 'Enviada em 22 de outubro',
  },
  {
    id: '3',
    editalLabel: 'Edital 01/2025',
    status: 'aprovada',
    nome: 'Morada estudantil',
    mensagem: 'Sua situação foi aprovada neste edital.',
    mensagemPrazo: 'Resposta em 22 de outubro',
  },
  {
    id: '4',
    editalLabel: 'Edital 01/2025',
    status: 'reprovada',
    nome: 'Auxílio transporte',
    mensagem: 'Sua situação foi reprovada neste edital.',
    mensagemPrazo: 'Resposta em 22 de outubro',
  },
];
