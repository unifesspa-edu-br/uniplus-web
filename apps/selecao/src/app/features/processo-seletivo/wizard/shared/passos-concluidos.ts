import { OrigemCandidatosCodigo } from '@uniplus/shared-data/selecao';
import type { ItemConformidadeDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import { PASSOS } from '../processo-seletivo.data';
import type { RotuloDePasso } from '../processo-seletivo.data';
import { passosComPendencia } from '../passos/revisao/grupos-da-revisao';

/** Os passos que gravam conteúdo: a Revisão publica, não declara nada que o servidor devolva. */
type PassoQueGrava = Exclude<RotuloDePasso, 'Revisão e publicação'>;

/**
 * O que o servidor já tem gravado em cada passo, lido do detalhe do processo. Mapa exaustivo: um
 * passo novo não compila até ganhar a regra, em vez de ficar sempre pendente depois de recarregar.
 *
 * O FADA conta quando o processo declarou se aplica ou não o Fator de Atenuação (`aplicaFada`
 * existe, nas duas respostas). O Desempate conta com ao menos um critério, ou quando o resultado
 * é importado: a lista já vem classificada e o desempate não é obrigatório. Fórmula e Eliminação
 * gravam a mesma classificação, e as regras de eliminação são opcionais: o servidor não devolve
 * sinal de que a Eliminação foi visitada, e lista vazia é uma gravação válida. Por isso os dois
 * contam com a classificação gravada, e uma pendência do checklist tira a marca.
 */
function gravadoPorPasso(dto: ProcessoSeletivoDto): Record<PassoQueGrava, boolean> {
  return {
    'Tipo do processo': true,
    Identificação: (dto.identificadorLegivel ?? '').trim() !== '',
    Pagamento: dto.configuracaoTaxaInscricao != null,
    Vagas: (dto.distribuicaoVagas ?? []).length > 0 && dto.opcoesDeCurso != null,
    Cronograma: (dto.cronogramaFases ?? []).length > 0,
    'Fórmula e precisão': dto.classificacao != null,
    'Fator de Atenuação': dto.aplicaFada != null,
    Desempate: desempateGravado(dto),
    Eliminação: dto.classificacao != null,
    'Atend. especial': dto.atendimentoEspecializado != null,
    Formulários: (dto.formularios ?? []).length > 0,
  };
}

function desempateGravado(dto: ProcessoSeletivoDto): boolean {
  return (
    (dto.criteriosDesempate ?? []).length > 0 ||
    dto.origemCandidatos.codigo === OrigemCandidatosCodigo.IMPORTACAO_EXTERNA
  );
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
