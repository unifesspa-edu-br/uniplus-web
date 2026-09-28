import type { CriterioDesempateConfigurado, WizardDraft } from '../../processo-seletivo.models';
import {
  motivoDaReleitura,
  type ClassificacaoGravada,
  type ProcessoSeletivoStore,
} from '../../processo-seletivo.store';
import {
  areasComunsAoQuadro,
  colunasDoQuadro,
  ordemDasAreas,
  type ColunaDoQuadro,
  type GrupoDoQuadro,
} from '../../shared/quadro-de-pesos';
import { MOTIVO_DA_RELEITURA, type MotivoDaReleitura } from '../../shared/motivo-da-releitura';
import type { LeituraDoCadastro } from '../classificacao/acompanhamento-do-cadastro-de-pesos.service';
import {
  ehCampoDaResolucao,
  exigeResolucaoPesoAreaEnem,
} from '../classificacao/classificacao-para-comando';
import { desempateUsaAreas } from './desempate-para-comando';

/**
 * Por que as áreas oferecidas não são simplesmente as da cópia gravada: a próxima gravação da
 * classificação copia o quadro do cadastro de novo, para a resolução do rascunho, e confere o
 * desempate gravado contra ele.
 *
 * - `outra-resolucao`: o rascunho escolheu outra resolução; valem as áreas que as duas aceitam;
 * - `cadastro-alterado`: a mesma resolução mudou no cadastro; valem as áreas que a cópia e o
 *   cadastro aceitam;
 * - `a-confirmar`: a resolução do rascunho não foi escolhida ou ainda não pôde ser lida, e só a
 *   gravada decide.
 */
export type Divergencia =
  | { readonly tipo: 'outra-resolucao'; readonly gravada: string; readonly escolhida: string }
  | { readonly tipo: 'cadastro-alterado'; readonly gravada: string }
  | { readonly tipo: 'a-confirmar'; readonly gravada: string };

/**
 * De onde vêm as áreas que o desempate pode citar, ou por que não há de onde.
 *
 * `rascunho-sem-quadro`: a gravada tem o quadro, e o rascunho deixou o ENEM pela média ponderada —
 * a próxima gravação da classificação recusa o critério por área com certeza. `por-reler`: só uma
 * releitura do processo diz o que a classificação gravada tem. `sem-area-em-todos-os-grupos`:
 * nenhuma área está em todos os grupos do quadro. `resolucoes-sem-area-em-comum`: a cópia gravada
 * e o quadro que a próxima gravação copia não têm área que os dois aceitem.
 */
export type SituacaoDoQuadro =
  | { readonly tipo: 'sem-quadro' }
  | { readonly tipo: 'rascunho-sem-quadro' }
  | { readonly tipo: 'por-reler'; readonly motivo: MotivoDaReleitura }
  | { readonly tipo: 'sem-resolucao' }
  | { readonly tipo: 'fora-do-cadastro' }
  | { readonly tipo: 'sem-area-em-todos-os-grupos'; readonly grupos: readonly GrupoDoQuadro[] }
  | {
      readonly tipo: 'resolucoes-sem-area-em-comum';
      readonly grupos: readonly GrupoDoQuadro[];
      readonly gravada: string;
      readonly escolhida: string;
    }
  | { readonly tipo: 'carregando' }
  | { readonly tipo: 'falha'; readonly mensagem: string }
  | {
      readonly tipo: 'lido';
      readonly grupos: readonly GrupoDoQuadro[];
      /** As áreas que o desempate pode citar, na ordem canônica. */
      readonly aceitas: readonly ColunaDoQuadro[];
      readonly divergencia: Divergencia | null;
    };

/**
 * O quadro contra o qual o servidor confere o desempate: com a classificação gravada com quadro, a
 * cópia que ela congelou. Sem quadro gravado, o quadro da resolução escolhida, lido do cadastro,
 * que é o que a gravação da classificação vai copiar — os critérios por área só são gravados
 * depois dela. Quando só uma releitura do processo diz o que a classificação gravada tem, não há
 * quadro a afirmar.
 */
export function situacaoDoQuadro(
  classificacao: WizardDraft['classificacao'],
  gravada: ClassificacaoGravada,
  cadastro: LeituraDoCadastro,
): SituacaoDoQuadro {
  const motivo = motivoDaReleitura(gravada);
  if (motivo !== null) return { tipo: 'por-reler', motivo };

  // `null` quando o rascunho não pede quadro; `''` quando pede e a resolução não foi escolhida.
  const escolhida = exigeResolucaoPesoAreaEnem(classificacao)
    ? classificacao.resolucaoPesoAreaEnem
    : null;

  if (gravada.estado === 'com-quadro') {
    return situacaoContraAGravada(gravada.resolucao, gravada.grupos, escolhida, cadastro);
  }

  if (escolhida === null) return { tipo: 'sem-quadro' };
  if (escolhida === '') return { tipo: 'sem-resolucao' };
  const doCadastro = gruposDoCadastro(cadastro);
  if (doCadastro === 'carregando') return { tipo: 'carregando' };
  if (doCadastro === 'falha') return { tipo: 'falha', mensagem: cadastro.falha ?? '' };
  return doCadastro.length === 0
    ? { tipo: 'fora-do-cadastro' }
    : situacaoDoQuadroLido(doCadastro, areasComuns(doCadastro, cadastro), null);
}

/**
 * Com a classificação gravada, o desempate vale contra a cópia agora e, depois da próxima gravação
 * da classificação, contra o quadro que ela copiar do cadastro para a resolução do rascunho. Com o
 * cadastro dessa resolução lido, valem as áreas que os dois aceitam; sem ele, só a cópia decide.
 * Com o cadastro lido sem a resolução, a próxima gravação a recusa.
 */
function situacaoContraAGravada(
  gravada: string,
  grupos: readonly GrupoDoQuadro[],
  escolhida: string | null,
  cadastro: LeituraDoCadastro,
): SituacaoDoQuadro {
  if (escolhida === null) return { tipo: 'rascunho-sem-quadro' };
  if (escolhida !== '' && cadastro.lido && cadastro.quadroDaResolucaoEscolhida.length === 0) {
    return { tipo: 'fora-do-cadastro' };
  }
  const daGravada = areasComuns(grupos, cadastro);

  const doCadastro = escolhida === '' ? [] : gruposDoCadastro(cadastro);
  if (typeof doCadastro === 'string' || doCadastro.length === 0) {
    return situacaoDoQuadroLido(
      grupos,
      daGravada,
      escolhida === gravada ? null : { tipo: 'a-confirmar', gravada },
    );
  }

  const daEscolhida = new Set(areasComuns(doCadastro, cadastro).map((area) => area.codigo));
  const aceitas = daGravada.filter((area) => daEscolhida.has(area.codigo));
  if (aceitas.length === 0 && daGravada.length > 0) {
    return { tipo: 'resolucoes-sem-area-em-comum', grupos, gravada, escolhida };
  }
  const divergencia: Divergencia | null =
    escolhida !== gravada
      ? { tipo: 'outra-resolucao', gravada, escolhida }
      : aceitas.length < daGravada.length
        ? { tipo: 'cadastro-alterado', gravada }
        : null;
  return situacaoDoQuadroLido(grupos, aceitas, divergencia);
}

function gruposDoCadastro(
  cadastro: LeituraDoCadastro,
): readonly GrupoDoQuadro[] | 'carregando' | 'falha' {
  if (cadastro.lido) return cadastro.quadroDaResolucaoEscolhida;
  return cadastro.carregando || cadastro.falha === null ? 'carregando' : 'falha';
}

function areasComuns(
  grupos: readonly GrupoDoQuadro[],
  cadastro: LeituraDoCadastro,
): readonly ColunaDoQuadro[] {
  return areasComunsAoQuadro(grupos, ordemDasAreas(cadastro.canonicas));
}

function situacaoDoQuadroLido(
  grupos: readonly GrupoDoQuadro[],
  aceitas: readonly ColunaDoQuadro[],
  divergencia: Divergencia | null,
): SituacaoDoQuadro {
  return aceitas.length === 0
    ? { tipo: 'sem-area-em-todos-os-grupos', grupos }
    : { tipo: 'lido', grupos, aceitas, divergencia };
}

/** O que depende da releitura, depois do motivo dela. */
export const DEPENDEM_DA_RELEITURA = 'as áreas que o desempate pode citar dependem disso';

/**
 * O que a tela diz quando não há área a oferecer: a dica sob o critério, e a mesma frase, sem a
 * maiúscula e o ponto, na recusa da validação.
 */
const TEXTO_SEM_AREAS = {
  'sem-quadro':
    'A nota de área do ENEM só desempata quando a classificação é baseada no ENEM pela média ponderada, com a resolução de Peso por Área escolhida no passo Fórmula.',
  'rascunho-sem-quadro':
    'A classificação escolhida no passo Fórmula não é baseada no ENEM pela média ponderada, e a gravação dela no passo Eliminação vai recusar o critério por área; troque a regra do critério ou remova-o, ou volte a classificação para o ENEM no passo Fórmula.',
  'sem-resolucao':
    'Escolha a resolução de Peso por Área no passo Fórmula: as áreas que o desempate pode citar vêm do quadro dela.',
  'fora-do-cadastro':
    'A resolução de Peso por Área escolhida não está no cadastro lido; escolha outra no passo Fórmula, ou atualize a lista lá se ela foi criada agora.',
  'sem-area-em-todos-os-grupos':
    'Nenhuma área do ENEM está em todos os grupos do quadro de Peso por Área, e só uma área comum a todos desempata; troque a regra do critério ou escolha outra resolução no passo Fórmula.',
} as const;

function textoSemAreas(situacao: SituacaoDoQuadro): string | null {
  switch (situacao.tipo) {
    case 'por-reler':
      return `${MOTIVO_DA_RELEITURA[situacao.motivo]}, e ${DEPENDEM_DA_RELEITURA}; releia o processo pelo aviso no início do passo.`;
    case 'resolucoes-sem-area-em-comum':
      return situacao.gravada === situacao.escolhida
        ? `A cópia gravada da resolução ${situacao.gravada} e o cadastro atual dela não têm área em comum a todos os grupos; troque a regra do critério, ou corrija a resolução no cadastro de Peso por Área.`
        : `A resolução ${situacao.gravada}, gravada, e a ${situacao.escolhida}, escolhida no passo Fórmula, não têm área em comum a todos os grupos; troque a regra do critério ou escolha outra resolução no passo Fórmula.`;
    case 'sem-quadro':
    case 'rascunho-sem-quadro':
    case 'sem-resolucao':
    case 'fora-do-cadastro':
    case 'sem-area-em-todos-os-grupos':
      return TEXTO_SEM_AREAS[situacao.tipo];
    default:
      return null;
  }
}

/**
 * A dica sob o critério que diz de onde vêm as áreas, ou por que não há nenhuma. `null` quando as
 * áreas vêm, sem ressalva, do quadro que vale.
 */
export function dicaDaSituacao(situacao: SituacaoDoQuadro): string | null {
  switch (situacao.tipo) {
    case 'carregando':
      return 'Carregando as áreas do cadastro de Peso por Área…';
    case 'falha':
      return 'As áreas vêm do cadastro de Peso por Área, que não foi lido. Veja o aviso no início do passo.';
    case 'lido':
      return situacao.divergencia === null ? null : dicaDaDivergencia(situacao.divergencia);
    default:
      return textoSemAreas(situacao);
  }
}

function dicaDaDivergencia(divergencia: Divergencia): string {
  switch (divergencia.tipo) {
    case 'outra-resolucao':
      return `Só as áreas que a resolução ${divergencia.gravada}, gravada, e a ${divergencia.escolhida}, escolhida no passo Fórmula, têm em todos os grupos podem desempatar: o critério vale antes e depois de a classificação ser gravada no passo Eliminação.`;
    case 'cadastro-alterado':
      return `A resolução ${divergencia.gravada} mudou no cadastro desde a gravação da classificação, e a próxima gravação no passo Eliminação copia o quadro de novo: só as áreas que a cópia gravada e o cadastro atual têm em todos os grupos podem desempatar.`;
    case 'a-confirmar':
      return `As áreas vêm da resolução ${divergencia.gravada}, a da classificação gravada. O que mudou no passo Fórmula só vale para o desempate depois de gravado no passo Eliminação.`;
  }
}

/** A recusa da validação quando não há área a oferecer, depois de "Critério de desempate N: ". */
export function recusaSemAreas(situacao: SituacaoDoQuadro): string | null {
  const texto = textoSemAreas(situacao);
  return texto === null ? null : comoRecusa(texto);
}

function comoRecusa(frase: string): string {
  return `${frase.charAt(0).toLowerCase()}${frase.slice(1, -1)}`;
}

/** As áreas citadas que não estão entre as aceitas — as que o servidor recusa. */
export function areasForaDoQuadro(
  areas: readonly string[],
  aceitas: readonly ColunaDoQuadro[],
): string[] {
  const codigos = new Set(aceitas.map((area) => area.codigo));
  return areas.filter((codigo) => !codigos.has(codigo));
}

/**
 * O rótulo de cada área: o do quadro quando ele a tem, senão o da lista canônica. Uma área que o
 * quadro não tem em grupo nenhum — o caso mais comum de área recusada — ainda sai pelo nome.
 */
export function rotulosDasAreas(
  canonicas: readonly { readonly codigo: string; readonly rotulo: string }[],
  grupos: readonly GrupoDoQuadro[],
): ReadonlyMap<string, string> {
  return new Map(
    [...canonicas, ...colunasDoQuadro(grupos, new Map())].map((area) => [area.codigo, area.rotulo]),
  );
}

/** As áreas citadas pelos critérios por área, na ordem dos critérios. */
export function areasCitadasPor(criterios: readonly CriterioDesempateConfigurado[]): string[] {
  return criterios
    .filter((criterio) => desempateUsaAreas(criterio.regraCodigo))
    .flatMap((criterio) => criterio.areas);
}

/**
 * O que a gravação da classificação do rascunho deixaria sem nota de área num critério de
 * desempate gravado: o quadro inteiro — o que é certo, pelo próprio rascunho —, ou as áreas, pelo
 * rótulo, que o cadastro lido não tem em todos os grupos — o que depende de o cadastro lido ser o
 * que o servidor tem.
 */
export interface PendenciaDoCriterioGravado {
  readonly posicao: number;
  readonly semQuadro: boolean;
  readonly fora: readonly string[];
  /** Nenhuma área do critério sobra: retirá-las deixaria o critério vazio. */
  readonly todas: boolean;
}

/**
 * A conferência do desempate gravado contra a classificação do rascunho. `nao-conferivel` quando
 * falta o que conferir — a resolução, ou o cadastro dela lido —, o que não é o mesmo que não haver
 * pendência.
 */
export type ConferenciaDoDesempateGravado =
  | { readonly resultado: 'sem-pendencia' }
  | {
      readonly resultado: 'com-pendencias';
      readonly pendencias: readonly PendenciaDoCriterioGravado[];
    }
  | { readonly resultado: 'nao-conferivel' };

export function conferirDesempateGravado(
  criterios: readonly CriterioDesempateConfigurado[],
  classificacao: WizardDraft['classificacao'],
  cadastro: LeituraDoCadastro,
): ConferenciaDoDesempateGravado {
  const porArea = criterios
    .map((criterio, indice) => ({ criterio, posicao: indice + 1 }))
    .filter(({ criterio }) => desempateUsaAreas(criterio.regraCodigo));
  if (porArea.length === 0) return { resultado: 'sem-pendencia' };

  const situacao = situacaoDoQuadro(classificacao, { estado: 'nunca-gravada' }, cadastro);
  if (situacao.tipo === 'sem-quadro') {
    return {
      resultado: 'com-pendencias',
      pendencias: porArea.map(({ posicao }) => ({
        posicao,
        semQuadro: true,
        fora: [],
        todas: true,
      })),
    };
  }
  if (situacao.tipo !== 'lido' && situacao.tipo !== 'sem-area-em-todos-os-grupos') {
    return { resultado: 'nao-conferivel' };
  }

  const aceitas = situacao.tipo === 'lido' ? situacao.aceitas : [];
  const rotulos = rotulosDasAreas(cadastro.canonicas, situacao.grupos);
  const pendencias = porArea.flatMap(({ criterio, posicao }) => {
    const fora = areasForaDoQuadro(criterio.areas, aceitas);
    return fora.length === 0
      ? []
      : [
          {
            posicao,
            semQuadro: false,
            fora: fora.map((codigo) => rotulos.get(codigo) ?? codigo),
            todas: fora.length === criterio.areas.length,
          },
        ];
  });
  return pendencias.length === 0
    ? { resultado: 'sem-pendencia' }
    : { resultado: 'com-pendencias', pendencias };
}

/**
 * Tira a recusa da classificação por um critério de desempate gravado quando ela acabou: os
 * critérios gravados, conferidos contra o rascunho da classificação, já não têm pendência. Com os
 * mesmos critérios que o servidor julgou, só um cadastro pedido depois da recusa pode mostrar
 * isso, porque o servidor julgou pelo cadastro dele; critérios regravados, ou nenhum por área,
 * são outro julgamento. Com os critérios gravados desconhecidos, ou sem ter como conferir, ela
 * fica.
 */
export function reavaliarRecusaPeloDesempate(
  store: ProcessoSeletivoStore,
  cadastro: LeituraDoCadastro,
): void {
  const gravados = store.criteriosDesempateGravados();
  if (store.recusaPeloDesempatePorArea() === null || gravados === null) return;
  const semCriterioPorArea = !gravados.some((criterio) => desempateUsaAreas(criterio.regraCodigo));
  const criteriosMudaram =
    JSON.stringify(gravados) !== JSON.stringify(store.criteriosNaRecusaPeloDesempate());
  const cadastroRelido =
    cadastro.lido && cadastro.leitura > store.leituraDoCadastroNaRecusaPeloDesempate();
  if (!semCriterioPorArea && !criteriosMudaram && !cadastroRelido) return;
  const conferencia = conferirDesempateGravado(gravados, store.draft().classificacao, cadastro);
  if (conferencia.resultado === 'sem-pendencia') store.recusaPeloDesempatePorArea.set(null);
}

const CRITERIO_GRAVADO_SEM_QUADRO =
  'compara a nota de área do ENEM, que só existe com a classificação baseada no ENEM pela média ponderada. Troque a regra do critério ou remova-o no passo Desempate e grave o passo, ou marque o ENEM e a média ponderada no passo Fórmula.';

/**
 * A recusa por um critério de desempate gravado que compara a nota de área do ENEM, com a
 * classificação fora do ENEM pela média ponderada — pela posição do critério, quando se sabe.
 */
export function recusaPorCriterioGravadoSemQuadro(posicao: number | null): string {
  return posicao === null
    ? `Um critério de desempate gravado ${CRITERIO_GRAVADO_SEM_QUADRO}`
    : `Critério de desempate ${posicao} gravado: ${CRITERIO_GRAVADO_SEM_QUADRO}`;
}

/**
 * O que a tela diz de uma área recusada num critério, depois de "Critério de desempate N: ". Sem o
 * rótulo — a recusa do servidor que não aponta a área —, a frase fala de uma das áreas.
 */
export const RECUSA_DA_AREA = {
  foraDoQuadro: (rotulo: string | null) =>
    `${aArea(rotulo)} não é comum a todos os grupos da resolução de Peso por Área`,
  repetida: (rotulo: string | null) =>
    `${aArea(rotulo)} aparece mais de uma vez na ordem de desempate`,
  citadaPorOutro: (rotulo: string | null, outro: number | null) =>
    outro === null
      ? `${aArea(rotulo)} já é citada por outro critério de desempate`
      : `${aArea(rotulo)} já é citada pelo critério ${outro}`,
  invalida: (rotulo: string | null) => `${aArea(rotulo)} não é uma área do ENEM`,
  obrigatorias: () => 'acrescente ao menos uma área do ENEM',
  emExcesso: () => 'o critério cita mais áreas do que o desempate admite',
} as const;

function aArea(rotulo: string | null): string {
  return rotulo === null ? 'uma das áreas' : `a área ${rotulo}`;
}

const PREFIXO_DA_RECUSA = 'uniplus.selecao.processo_seletivo.';
const FORA_DO_QUADRO = `${PREFIXO_DA_RECUSA}desempate_area_enem_fora_do_quadro`;
const SEM_QUADRO = `${PREFIXO_DA_RECUSA}desempate_area_enem_sem_quadro`;
const CITADA_POR_OUTRO_CRITERIO = `${PREFIXO_DA_RECUSA}area_enem_citada_por_outro_criterio`;
const PREFIXO_DA_RECUSA_DO_CRITERIO = 'uniplus.selecao.criterio_desempate.';

/**
 * O que a tela diz para a recusa do servidor a uma classificação que deixaria sem nota de área um
 * critério de desempate já gravado, pelo `code` e pelo campo — o `message` do servidor não é
 * contrato da tela. Sem quadro no campo da resolução, falta escolhê-la; nos campos do ENEM e da
 * regra de cálculo, falta a própria classificação pelo ENEM pela média ponderada.
 */
export function recusaDaClassificacaoPeloDesempate(erro: {
  readonly field: string;
  readonly code: string;
}): string | null {
  if (erro.code === FORA_DO_QUADRO) {
    return 'Um critério de desempate gravado cita área do ENEM que a resolução escolhida não tem em todos os grupos. No passo Desempate, retire a área — ou, se nenhuma área do critério sobrar, troque a regra dele ou remova-o — e grave o passo; ou escolha outra resolução.';
  }
  if (erro.code !== SEM_QUADRO) return null;
  return ehCampoDaResolucao(erro.field)
    ? 'Um critério de desempate gravado compara a nota de área do ENEM, que exige o quadro da resolução de Peso por Área. Troque a regra do critério no passo Desempate e grave o passo, ou escolha a resolução no passo Fórmula.'
    : recusaPorCriterioGravadoSemQuadro(null);
}

/**
 * As recusas do servidor à gravação do desempate que a tela explica, pelo `code`, com o rótulo da
 * área quando o campo da recusa aponta uma. São as mesmas frases da validação da tela.
 */
const RECUSA_AO_GRAVAR_O_DESEMPATE: ReadonlyMap<
  string,
  (rotulo: string | null, outro: number | null) => string
> = new Map([
  [FORA_DO_QUADRO, RECUSA_DA_AREA.foraDoQuadro],
  [CITADA_POR_OUTRO_CRITERIO, RECUSA_DA_AREA.citadaPorOutro],
  [`${PREFIXO_DA_RECUSA_DO_CRITERIO}area_repetida`, RECUSA_DA_AREA.repetida],
  [`${PREFIXO_DA_RECUSA_DO_CRITERIO}area_invalida`, RECUSA_DA_AREA.invalida],
  [`${PREFIXO_DA_RECUSA_DO_CRITERIO}areas_obrigatorias`, RECUSA_DA_AREA.obrigatorias],
  [`${PREFIXO_DA_RECUSA_DO_CRITERIO}areas_em_excesso`, RECUSA_DA_AREA.emExcesso],
  [
    SEM_QUADRO,
    () =>
      'a classificação gravada não tem o quadro de Peso por Área; escolha a resolução no passo Fórmula, se ainda não escolheu, e grave a classificação no passo Eliminação',
  ],
]);

/** A posição do primeiro critério, fora o de `indice`, que cita a área; `null` se nenhum. */
export function outroCriterioQueCita(
  criterios: readonly CriterioDesempateConfigurado[],
  codigo: string,
  indice: number,
): number | null {
  const outro = criterios.findIndex(
    (criterio, posicao) => posicao !== indice && criterio.areas.includes(codigo),
  );
  return outro < 0 ? null : outro + 1;
}

/** O campo da recusa: `criterios[i]`, e `.areas[j]` quando aponta uma área. */
const CAMPO_DO_CRITERIO = /criterios\[(\d+)\](?:\.areas\[(\d+)\])?/;

/**
 * A recusa do servidor à gravação do desempate, com o critério e a área que o campo aponta, ou
 * `null` quando a tela não tem texto para o `code`.
 */
export function recusaAoGravarODesempate(
  erro: { readonly field: string; readonly code: string },
  criterios: readonly CriterioDesempateConfigurado[],
  rotuloDaArea: (codigo: string) => string,
): string | null {
  const texto = RECUSA_AO_GRAVAR_O_DESEMPATE.get(erro.code);
  if (texto === undefined) return null;

  const campo = CAMPO_DO_CRITERIO.exec(erro.field);
  const indice = campo === null ? null : Number(campo[1]);
  const area =
    indice === null || campo?.[2] === undefined
      ? undefined
      : criterios[indice]?.areas[Number(campo[2])];
  const corpo =
    area === undefined || indice === null
      ? texto(null, null)
      : texto(rotuloDaArea(area), outroCriterioQueCita(criterios, area, indice));
  return indice === null
    ? `${corpo.charAt(0).toUpperCase()}${corpo.slice(1)}.`
    : `Critério de desempate ${indice + 1}: ${corpo}.`;
}
