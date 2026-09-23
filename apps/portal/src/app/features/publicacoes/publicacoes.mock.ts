import type { Publicacao } from './publicacoes.model';

/**
 * Dado simulado de Publicações — some quando a consulta pública da API
 * estiver disponível. Só `PublicacoesRepository` o lê.
 */
export const MOCK_PUBLICACOES: readonly Publicacao[] = [
  {
    id: 'medicina-2027',
    numeroEdital: '012/2026',
    titulo: 'Medicina 2027',
    descricao: 'Lista de classificação final por curso, campus e modalidade de concorrência.',
    situacao: 'resultadoDivulgado',
    dataPublicacao: '2026-04-16',
    historico: [
      {
        id: 'medicina-2027-1',
        categoria: 'edital',
        data: '2026-01-05',
        titulo: 'Edital publicado',
        descricao: 'Edital 012/2026 publicado no Diário Oficial e no site da Unifesspa.',
        documentoArquivo: 'edital-012-2026.pdf',
      },
      {
        id: 'medicina-2027-2',
        categoria: 'inscricoes',
        data: '2026-01-20',
        titulo: 'Inscrições abertas',
      },
      {
        id: 'medicina-2027-3',
        categoria: 'inscricoes',
        data: '2026-03-10',
        titulo: 'Inscrições encerradas',
      },
      {
        id: 'medicina-2027-4',
        categoria: 'resultadoPreliminar',
        data: '2026-04-01',
        titulo: 'Resultado preliminar divulgado',
        descricao: 'Lista preliminar sujeita a recurso até 08 de abril.',
        documentoArquivo: 'resultado-preliminar-medicina-2027.pdf',
      },
      {
        id: 'medicina-2027-6',
        categoria: 'recursos',
        data: '2026-04-08',
        titulo: 'Prazo de recursos encerrado',
        descricao: 'Encerrado o prazo para envio de recursos contra o resultado preliminar.',
      },
      {
        id: 'medicina-2027-5',
        categoria: 'resultado',
        data: '2026-04-16',
        titulo: 'Resultado final divulgado',
        descricao: 'Lista de classificação final por curso, campus e modalidade de concorrência.',
        documentoArquivo: 'resultado-final-medicina-2027.pdf',
      },
    ],
  },
  {
    id: 'ppgcf-2026',
    numeroEdital: '009/2026',
    titulo: 'PPGCF',
    descricao: 'Resultado preliminar, sujeito a recurso até 20 de abril.',
    situacao: 'resultadoPreliminar',
    dataPublicacao: '2026-04-02',
    historico: [
      {
        id: 'ppgcf-2026-1',
        categoria: 'edital',
        data: '2026-01-15',
        titulo: 'Edital publicado',
        documentoArquivo: 'edital-009-2026.pdf',
      },
      {
        id: 'ppgcf-2026-2',
        categoria: 'inscricoes',
        data: '2026-02-01',
        titulo: 'Inscrições abertas',
      },
      {
        id: 'ppgcf-2026-3',
        categoria: 'inscricoes',
        data: '2026-03-05',
        titulo: 'Inscrições encerradas',
      },
      {
        id: 'ppgcf-2026-4',
        categoria: 'resultadoPreliminar',
        data: '2026-04-02',
        titulo: 'Resultado preliminar divulgado',
        descricao: 'Sujeito a recurso até 20 de abril.',
        documentoArquivo: 'resultado-preliminar-ppgcf-2026.pdf',
      },
    ],
  },
  {
    id: 'tecnico-enfermagem-2026',
    numeroEdital: '007/2026',
    titulo: 'Técnico em Enfermagem',
    descricao: 'Inscrições abertas para vagas em Marabá e Altamira.',
    situacao: 'inscricoesAbertas',
    dataPublicacao: '2026-03-01',
    historico: [
      {
        id: 'tecnico-enfermagem-2026-1',
        categoria: 'edital',
        data: '2026-02-20',
        titulo: 'Edital publicado',
        documentoArquivo: 'edital-007-2026.pdf',
      },
      {
        id: 'tecnico-enfermagem-2026-2',
        categoria: 'inscricoes',
        data: '2026-03-01',
        titulo: 'Inscrições abertas',
        descricao: 'Período de inscrições até 30 de abril.',
      },
    ],
  },
  {
    id: 'pedagogia-2026',
    numeroEdital: '004/2026',
    titulo: 'Pedagogia — Ingresso 2026.2',
    descricao: 'Documentação em fase de homologação pela comissão do processo seletivo.',
    situacao: 'emHomologacao',
    dataPublicacao: '2026-03-18',
    historico: [
      {
        id: 'pedagogia-2026-1',
        categoria: 'edital',
        data: '2026-01-10',
        titulo: 'Edital publicado',
        documentoArquivo: 'edital-004-2026.pdf',
      },
      {
        id: 'pedagogia-2026-2',
        categoria: 'inscricoes',
        data: '2026-01-25',
        titulo: 'Inscrições abertas',
      },
      {
        id: 'pedagogia-2026-3',
        categoria: 'inscricoes',
        data: '2026-03-05',
        titulo: 'Inscrições encerradas',
      },
      {
        id: 'pedagogia-2026-4',
        categoria: 'homologacao',
        data: '2026-03-18',
        titulo: 'Documentação em homologação',
        descricao: 'Comissão avalia a documentação enviada pelos candidatos inscritos.',
      },
    ],
  },
  {
    id: 'direito-2026',
    numeroEdital: '015/2026',
    titulo: 'Direito — Vagas remanescentes',
    descricao: 'Edital publicado, inscrições abrem em breve.',
    situacao: 'inscricoesAbertas',
    dataPublicacao: '2026-04-10',
    historico: [
      {
        id: 'direito-2026-1',
        categoria: 'edital',
        data: '2026-04-10',
        titulo: 'Edital publicado',
        descricao: 'Inscrições abertas de 15 a 30 de abril.',
        documentoArquivo: 'edital-015-2026.pdf',
      },
    ],
  },
  {
    id: 'pos-educacao-2025',
    numeroEdital: '002/2025',
    titulo: 'Pós-graduação em Educação',
    descricao: 'Processo seletivo encerrado — matrículas já concluídas.',
    situacao: 'encerrado',
    dataPublicacao: '2025-12-10',
    historico: [
      {
        id: 'pos-educacao-2025-1',
        categoria: 'edital',
        data: '2025-09-01',
        titulo: 'Edital publicado',
        documentoArquivo: 'edital-002-2025.pdf',
      },
      {
        id: 'pos-educacao-2025-2',
        categoria: 'resultado',
        data: '2025-10-15',
        titulo: 'Resultado final divulgado',
        documentoArquivo: 'resultado-final-pos-educacao-2025.pdf',
      },
      {
        id: 'pos-educacao-2025-3',
        categoria: 'encerramento',
        data: '2025-12-10',
        titulo: 'Processo encerrado',
        descricao: 'Matrículas concluídas para todos os classificados.',
      },
    ],
  },
];

export function encontrarPublicacao(id: string): Publicacao | undefined {
  return MOCK_PUBLICACOES.find((publicacao) => publicacao.id === id);
}
