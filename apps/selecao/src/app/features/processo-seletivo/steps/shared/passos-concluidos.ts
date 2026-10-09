import type { ItemConformidadeDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import { PASSOS } from '../processo-seletivo.data';
import type { RotuloDePasso } from '../processo-seletivo.data';
import { passosComPendencia } from '../steps/revisao/publicacao-para-comando';

/** Os passos que gravam conteúdo: a Revisão publica, não declara nada que o servidor devolva. */
type PassoQueGrava = Exclude<RotuloDePasso, 'Revisão e publicação'>;

/**
 * O que o servidor já tem gravado em cada passo, lido do detalhe do processo. Mapa exaustivo: um
 * passo novo não compila até ganhar a regra, em vez de ficar sempre pendente depois de recarregar.
 *
 * Bônus e Desempate são opcionais, e o servidor não distingue "nunca gravado" de "gravado vazio":
 * só contam quando há conteúdo. Fórmula e Eliminação compartilham a classificação, gravada junto
 * no passo Eliminação.
 */
function gravadoPorPasso(dto: ProcessoSeletivoDto): Record<PassoQueGrava, boolean> {
  const classificacaoGravada = dto.classificacao != null;
  return {
    'Tipo do processo': true,
    Identificação: (dto.identificadorLegivel ?? '').trim() !== '',
    Pagamento: dto.configuracaoTaxaInscricao != null,
    Vagas: (dto.distribuicaoVagas ?? []).length > 0,
    Cronograma: (dto.cronogramaFases ?? []).length > 0,
    'Fórmula e precisão': classificacaoGravada,
    Bônus: dto.bonusRegional != null,
    Desempate: (dto.criteriosDesempate ?? []).length > 0,
    Eliminação: classificacaoGravada,
    'Atend. especial': dto.ofertaAtendimento != null,
    Formulários: (dto.formularios ?? []).length > 0,
  };
}

/**
 * Os passos concluídos de um processo já gravado: o conteúdo existe no servidor e o checklist
 * estrutural não aponta pendência nele. É o que o stepper mostra ao abrir ou recarregar um
 * rascunho, sem depender da navegação feita na sessão.
 */
export function passosConcluidosDe(
  dto: ProcessoSeletivoDto,
  checklist: readonly ItemConformidadeDto[],
): ReadonlySet<number> {
  const gravado = gravadoPorPasso(dto);
  const comPendencia = passosComPendencia(checklist);
  const concluidos = new Set<number>();

  PASSOS.forEach((passo, indice) => {
    const rotulo = passo.rotulo;
    if (rotulo === 'Revisão e publicação') return;
    if (gravado[rotulo] && !comPendencia.has(indice)) concluidos.add(indice);
  });
  return concluidos;
}
