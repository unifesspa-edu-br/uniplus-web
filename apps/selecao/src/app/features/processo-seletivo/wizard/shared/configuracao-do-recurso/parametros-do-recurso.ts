import {
  EfeitoSuspensivoCodigo,
  GuardaDaVagaCodigo,
  UnidadePrazoCodigo,
  type EtapaProcessoInput,
  type FaseCronogramaInput,
} from '@uniplus/shared-data/selecao';

type RegraDeRecursoDaFaseInput = NonNullable<FaseCronogramaInput['regraRecurso']>;
type RecursoDaEtapaInput = NonNullable<EtapaProcessoInput['recursos']>[number];

/**
 * O que a configuração do recurso declara além da regra de contagem, da publicação de que o prazo
 * corre e dos procedimentos, que só a fase ou a etapa conhecem. É o estado que a tela edita e o
 * que o comando envia, igual para a regra de recurso da fase e para cada recurso da etapa.
 *
 * Os números são texto porque é o que o campo edita. Código ainda não escolhido é `''`, e a
 * instância superior ainda não respondida é `null`: a API não tem padrão para ela.
 */
export interface ParametrosDoRecurso {
  readonly prazoValor: string;
  readonly prazoUnidade: UnidadePrazoCodigo | '';
  readonly admiteInstanciaSuperior: boolean | null;
  readonly efeitoSuspensivo: EfeitoSuspensivoCodigo | '';
  readonly guardaDaVaga: GuardaDaVagaCodigo | '';
  readonly prazoSegundaInstanciaValor: string;
  readonly prazoSegundaInstanciaUnidade: UnidadePrazoCodigo | '';
}

/** Os campos dos parâmetros, presos por tipo aos que a fase e a etapa enviam em comum. */
export type CampoDosParametros = Extract<
  keyof ParametrosDoRecurso,
  keyof RegraDeRecursoDaFaseInput & keyof RecursoDaEtapaInput
>;

type CampoComRotulo =
  | 'prazoUnidade'
  | 'prazoSegundaInstanciaUnidade'
  | 'efeitoSuspensivo'
  | 'guardaDaVaga';

/**
 * O que a leitura trouxe e o envio ignora: o nome que a API deu a cada código lido e se o prazo da
 * 2ª instância veio gravado num recurso que não admite instância superior.
 */
export interface LeituraDoRecurso {
  readonly rotulos: Readonly<Partial<Record<CampoComRotulo, string>>>;
  readonly prazoDaSegundaInstanciaSemInstanciaSuperior: boolean;
}

export const LEITURA_EM_BRANCO: LeituraDoRecurso = {
  rotulos: {},
  prazoDaSegundaInstanciaSemInstanciaSuperior: false,
};

/** Um recurso que ainda não foi declarado: tudo por responder. */
export const PARAMETROS_EM_BRANCO: ParametrosDoRecurso = {
  prazoValor: '',
  prazoUnidade: '',
  admiteInstanciaSuperior: null,
  efeitoSuspensivo: '',
  guardaDaVaga: '',
  prazoSegundaInstanciaValor: '',
  prazoSegundaInstanciaUnidade: '',
};

/** Uma opção do vocabulário: o código que se grava, o nome que se lê e, às vezes, a explicação. */
export interface OpcaoDoVocabulario {
  readonly codigo: string;
  readonly rotulo: string;
  readonly descricao?: string;
}

/**
 * Uma opção da escolha. `foraDoVocabulario` marca o valor já gravado que o vocabulário não oferece
 * mais: ele segue à vista e marcado, para que a tela não mostre outra escolha no lugar dele.
 */
export interface OpcaoDeEscolha extends OpcaoDoVocabulario {
  readonly foraDoVocabulario: boolean;
}

export const MENSAGEM_DA_INSTANCIA_SUPERIOR_EM_ABERTO =
  'Responda se o recurso admite instância superior.';
export const MENSAGEM_DO_RECURSO_QUE_SE_ENCERRA =
  'O recurso deste tipo se encerra na 1ª instância.';
export const MENSAGEM_DA_GUARDA_FIXA =
  'Com 2ª instância, a vaga fica sempre guardada até o resultado definitivo.';
export const MENSAGEM_DA_GUARDA_RETIRADA = `${MENSAGEM_DA_GUARDA_FIXA} A escolha "não guarda" foi retirada.`;
export const MENSAGEM_DO_PRAZO_RETIRADO =
  'O prazo da 2ª instância foi retirado porque o recurso não admite instância superior.';
export const EXPLICACAO_DA_OPCAO_FORA_DO_VOCABULARIO =
  'Esta opção não é mais oferecida. Ela continua gravada até você escolher outra.';

/**
 * As opções que a pessoa vê: as do vocabulário e, se o valor atual não está entre elas, o próprio
 * valor, marcado como fora do vocabulário, com o nome que a leitura deu a ele (ou o código).
 */
export function opcoesParaEscolha(
  opcoes: readonly OpcaoDoVocabulario[],
  valorAtual: string,
  rotuloLido?: string,
): readonly OpcaoDeEscolha[] {
  const oferecidas = opcoes.map((opcao) => ({ ...opcao, foraDoVocabulario: false }));
  const oferecida = valorAtual === '' || opcoes.some((opcao) => opcao.codigo === valorAtual);
  return oferecida ? oferecidas : [...oferecidas, opcaoForaDoVocabulario(valorAtual, rotuloLido)];
}

function opcaoForaDoVocabulario(codigo: string, rotuloLido: string | undefined): OpcaoDeEscolha {
  return {
    codigo,
    rotulo: rotuloLido ?? codigo,
    descricao: EXPLICACAO_DA_OPCAO_FORA_DO_VOCABULARIO,
    foraDoVocabulario: true,
  };
}

/**
 * As opções da guarda da vaga. Com instância superior a vaga fica sempre guardada, então "não
 * guarda" deixa de ser oferecida, salvo quando é o valor atual, que segue à vista até a pessoa agir.
 */
export function opcoesDaGuarda(
  opcoes: readonly OpcaoDoVocabulario[],
  admiteInstanciaSuperior: boolean | null,
  valorAtual: string,
  rotuloLido?: string,
): readonly OpcaoDeEscolha[] {
  const oferecidas = opcoesParaEscolha(opcoes, valorAtual, rotuloLido);
  if (admiteInstanciaSuperior !== true) return oferecidas;
  return oferecidas.filter(
    (opcao) => opcao.codigo !== GuardaDaVagaCodigo.naoGuarda || opcao.codigo === valorAtual,
  );
}

/** O prazo da 2ª instância aparece com instância superior, ou quando a leitura o trouxe sem ela. */
export function prazoDaSegundaInstanciaVisivel(
  parametros: Pick<ParametrosDoRecurso, 'admiteInstanciaSuperior'>,
  leitura: LeituraDoRecurso,
): boolean {
  return (
    parametros.admiteInstanciaSuperior === true ||
    leitura.prazoDaSegundaInstanciaSemInstanciaSuperior
  );
}

/** O que a pessoa mudou: o campo e o valor novo, que é `boolean` só na instância superior. */
export type AlteracaoDosParametros =
  | { readonly campo: 'admiteInstanciaSuperior'; readonly valor: boolean }
  | {
      readonly campo: Exclude<CampoDosParametros, 'admiteInstanciaSuperior'>;
      readonly valor: string;
    };

/** O que a mudança desfez por conta própria, para a tela anunciar. */
export type RetiradoPelaMudanca = 'guarda' | 'prazoDaSegundaInstancia' | null;

export interface ParametrosAlterados {
  readonly parametros: ParametrosDoRecurso;
  readonly leitura: LeituraDoRecurso;
  readonly retirado: RetiradoPelaMudanca;
}

function resolvedorDe<T extends string>(codigos: Readonly<Record<string, T>>) {
  const aceitos: readonly T[] = Object.values(codigos);
  return (valor: string): T | '' => aceitos.find((codigo) => codigo === valor) ?? '';
}

const RESOLVEDOR_DO_CAMPO = {
  prazoUnidade: resolvedorDe(UnidadePrazoCodigo),
  prazoSegundaInstanciaUnidade: resolvedorDe(UnidadePrazoCodigo),
  efeitoSuspensivo: resolvedorDe(EfeitoSuspensivoCodigo),
  guardaDaVaga: resolvedorDe(GuardaDaVagaCodigo),
} as const;

function comOCampo(
  parametros: ParametrosDoRecurso,
  alteracao: AlteracaoDosParametros,
): ParametrosDoRecurso {
  if (alteracao.campo === 'admiteInstanciaSuperior') {
    return { ...parametros, admiteInstanciaSuperior: alteracao.valor };
  }
  if (alteracao.campo === 'prazoValor' || alteracao.campo === 'prazoSegundaInstanciaValor') {
    return { ...parametros, [alteracao.campo]: alteracao.valor };
  }
  const codigo = RESOLVEDOR_DO_CAMPO[alteracao.campo](alteracao.valor);
  return { ...parametros, [alteracao.campo]: codigo };
}

/** Os nomes lidos, sem o do campo que a pessoa mudou ou que a mudança retirou. */
function semOsRotulosDe(
  rotulos: LeituraDoRecurso['rotulos'],
  ...campos: readonly CampoDosParametros[]
): LeituraDoRecurso['rotulos'] {
  const copia: Partial<Record<CampoDosParametros, string>> = { ...rotulos };
  campos.forEach((campo) => delete copia[campo]);
  return copia;
}

function semORotuloDoCampo(leitura: LeituraDoRecurso, campo: CampoDosParametros): LeituraDoRecurso {
  return campo in leitura.rotulos
    ? { ...leitura, rotulos: semOsRotulosDe(leitura.rotulos, campo) }
    : leitura;
}

/** Sem instância superior não há o que mostrar do prazo da 2ª: o prazo e a marca da leitura saem. */
function semOPrazoDaSegundaInstancia(
  parametros: ParametrosDoRecurso,
  leitura: LeituraDoRecurso,
): ParametrosAlterados {
  const preenchido =
    parametros.prazoSegundaInstanciaValor !== '' || parametros.prazoSegundaInstanciaUnidade !== '';
  return {
    parametros: { ...parametros, prazoSegundaInstanciaValor: '', prazoSegundaInstanciaUnidade: '' },
    leitura: {
      rotulos: semOsRotulosDe(leitura.rotulos, 'prazoSegundaInstanciaUnidade'),
      prazoDaSegundaInstanciaSemInstanciaSuperior: false,
    },
    retirado: preenchido ? 'prazoDaSegundaInstancia' : null,
  };
}

/** Marcar Sim com "não guarda" escolhida deixa a guarda vazia: com instância superior ela é fixa. */
function semANaoGuarda(parametros: ParametrosDoRecurso): ParametrosAlterados | null {
  if (parametros.guardaDaVaga !== GuardaDaVagaCodigo.naoGuarda) return null;
  return {
    parametros: { ...parametros, guardaDaVaga: '' },
    leitura: LEITURA_EM_BRANCO,
    retirado: 'guarda',
  };
}

function aposAInstanciaSuperior(
  parametros: ParametrosDoRecurso,
  leitura: LeituraDoRecurso,
  admite: boolean,
): ParametrosAlterados {
  if (!admite) return semOPrazoDaSegundaInstancia(parametros, leitura);
  const retirada = semANaoGuarda(parametros);
  if (retirada === null) return { parametros, leitura, retirado: null };
  const rotulos = semOsRotulosDe(leitura.rotulos, 'guardaDaVaga');
  return { ...retirada, leitura: { ...leitura, rotulos } };
}

/**
 * Aplica a mudança da pessoa e as retiradas que ela implica. Nada é restaurado ao desfazer: marcar
 * Não de novo não devolve "não guarda", e marcar Sim de novo não devolve o prazo da 2ª instância.
 */
export function parametrosAlterados(
  parametros: ParametrosDoRecurso,
  leitura: LeituraDoRecurso,
  alteracao: AlteracaoDosParametros,
): ParametrosAlterados {
  const novos = comOCampo(parametros, alteracao);
  const lida = semORotuloDoCampo(leitura, alteracao.campo);
  if (alteracao.campo !== 'admiteInstanciaSuperior') {
    return { parametros: novos, leitura: lida, retirado: null };
  }
  return aposAInstanciaSuperior(novos, lida, alteracao.valor);
}

/** O botão "Retirar o prazo da 2ª instância": valor e unidade ficam vazios e o campo some. */
export function prazoDaSegundaInstanciaRetirado(
  parametros: ParametrosDoRecurso,
  leitura: LeituraDoRecurso,
): ParametrosAlterados {
  return semOPrazoDaSegundaInstancia(parametros, leitura);
}
