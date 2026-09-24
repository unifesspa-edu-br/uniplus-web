import type { CertameNaVitrineDto } from '@uniplus/shared-data/selecao';

import type { EventoHistoricoPublicacao, Publicacao } from './publicacoes.model';

/**
 * Dado simulado de Publicações — some quando a consulta pública da API
 * estiver disponível. Só `PublicacoesRepository` o lê.
 *
 * Toda publicação é montada a partir do próprio certame (número, nome,
 * situação e período de inscrição), então nenhum edital exibe a linha do
 * tempo de outro. O id da publicação é o `processoSeletivoId` do certame.
 */

/** O que basta saber de um certame da vitrine para simular suas publicações. */
export type CertameParaPublicacoes = Pick<
  CertameNaVitrineDto,
  'processoSeletivoId' | 'numero' | 'nome' | 'situacao' | 'inscricoesDe' | 'inscricoesAte'
>;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** O edital costuma sair antes da abertura das inscrições — dias de antecedência simulados. */
const ANTECEDENCIA_DO_EDITAL_DIAS = 15;

/** `AAAA-MM-DD` (o que o `dateBr` lê) de um instante ISO, deslocado em `dias`. */
function diaIso(instante: string, dias = 0): string {
  const ms = Date.parse(instante);
  return Number.isNaN(ms) ? instante.slice(0, 10) : new Date(ms + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

export function montarPublicacaoMock(certame: CertameParaPublicacoes): Publicacao {
  const { processoSeletivoId: id } = certame;
  const historico: EventoHistoricoPublicacao[] = [
    {
      id: `${id}-edital`,
      categoria: 'edital',
      data: diaIso(certame.inscricoesDe, -ANTECEDENCIA_DO_EDITAL_DIAS),
      titulo: 'Edital publicado',
      descricao: `${certame.numero ?? 'Edital'} publicado no Diário Oficial e no site da Unifesspa.`,
      documentoArquivo: `edital-${id.slice(-8)}.pdf`,
    },
  ];

  if (certame.situacao !== 'emBreve') {
    historico.push({
      id: `${id}-inscricoes-abertas`,
      categoria: 'inscricoes',
      data: diaIso(certame.inscricoesDe),
      titulo: 'Inscrições abertas',
    });
  }

  if (certame.situacao === 'encerradas') {
    historico.push({
      id: `${id}-inscricoes-encerradas`,
      categoria: 'inscricoes',
      data: diaIso(certame.inscricoesAte),
      titulo: 'Inscrições encerradas',
    });
  }

  return {
    id,
    numeroEdital: certame.numero ?? '',
    titulo: certame.nome,
    descricao: `Publicações do processo seletivo ${certame.nome}.`,
    situacao: certame.situacao === 'encerradas' ? 'encerrado' : 'inscricoesAbertas',
    dataPublicacao: historico[historico.length - 1].data,
    historico,
  };
}

/**
 * O documento de um evento abre numa aba nova, que nasce sem memória do app —
 * por isso o que o mock gerou fica também no `localStorage` (só dado público
 * simulado, nada de credencial).
 */
const CHAVE_STORAGE = 'uniplus.portal.publicacoes-mock';

export function lerPublicacoesMock(): Publicacao[] {
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE);
    const lido: unknown = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lido) ? (lido as Publicacao[]) : [];
  } catch {
    return [];
  }
}

export function gravarPublicacoesMock(publicacoes: readonly Publicacao[]): void {
  try {
    const porId = new Map(lerPublicacoesMock().map((item) => [item.id, item]));
    publicacoes.forEach((item) => porId.set(item.id, item));
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify([...porId.values()]));
  } catch {
    // Storage indisponível (navegação privada): o documento só abre na mesma aba.
  }
}
