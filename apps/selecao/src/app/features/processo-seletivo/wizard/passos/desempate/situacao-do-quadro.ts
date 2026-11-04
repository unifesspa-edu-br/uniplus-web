import type { CriterioDesempateConfigurado, WizardDraft } from '../../processo-seletivo.models';
import { motivoDaReleitura, type ClassificacaoGravada } from '../../classificacao-no-servidor';
import {
  areasComunsAoQuadro,
  colunasDoQuadro,
  ordemDasAreas,
  type ColunaDoQuadro,
  type GrupoDoQuadro,
} from '../../shared/quadro-de-pesos';
import { MOTIVO_DA_RELEITURA, type MotivoDaReleitura } from '../../shared/motivo-da-releitura';
import type { LeituraDoCadastro } from '../classificacao/leitura-do-cadastro-de-pesos.service';
import { exigeResolucaoPesoAreaEnem } from '../classificacao/classificacao-para-comando';
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
