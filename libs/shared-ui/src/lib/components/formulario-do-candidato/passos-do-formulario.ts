import {
  BLOCO_REVISAO_E_ACEITE,
  type CampoRenderizavel,
  type FormularioDoCandidato,
  type GrupoRenderizavel,
  type SecaoRenderizavel,
  type TermoRenderizavel,
} from './formulario-do-candidato.model';
import type {
  AvaliacaoDoFormulario,
  CampoAvaliado,
  GrupoAvaliado,
  ItemDasRegras,
  TermoAvaliado,
} from './interpretador/regras-do-formulario';
import { regrasPorFato } from './regras-do-campo';

/** Um campo do passo, com a avaliação dele e a regra que o descreve. */
export interface CampoNoPasso {
  readonly campo: CampoRenderizavel;
  readonly avaliado: CampoAvaliado;
  readonly regra: ItemDasRegras | null;
}

export interface GrupoNoPasso {
  readonly grupo: GrupoRenderizavel;
  readonly avaliado: GrupoAvaliado;
  /** As regras dos subitens, pelo fato. */
  readonly regras: ReadonlyMap<string, ItemDasRegras>;
}

export interface TermoNoPasso {
  readonly termo: TermoRenderizavel;
  readonly avaliado: TermoAvaliado;
}

/**
 * Um passo do formulário: uma seção, um bloco do sistema ou, no rascunho, os campos ainda sem seção.
 * Os campos e grupos entram no passo pela etapa em que a avaliação os põe, e só os que aparecem.
 */
export interface PassoDoFormulario {
  readonly chave: string;
  readonly titulo: string;
  readonly descricao: string | null;
  readonly aviso: string | null;
  readonly bloco: string | null;
  /** As etapas das regras que o passo conclui ao avançar. */
  readonly etapasNasRegras: readonly string[];
  readonly campos: readonly CampoNoPasso[];
  readonly grupos: readonly GrupoNoPasso[];
  readonly termos: readonly TermoNoPasso[];
}

/** O que o formulário mostra, antes de distribuído pelos passos. */
interface ConteudoVisivel {
  readonly campos: readonly CampoNoPasso[];
  readonly grupos: readonly GrupoNoPasso[];
  readonly termos: readonly TermoNoPasso[];
}

const VISIVEL = 'VERDADEIRO';
const OCULTO = 'FALSO';

/**
 * Os passos na ordem das seções. A ligação com as regras é pelo código nas regras — no processo, o
 * código da seção é prefixado pela finalidade; no modelo, é o mesmo —, e cada campo entra no passo da
 * etapa em que a avaliação o põe. A etapa das regras sem seção, como a dos campos do rascunho ainda sem
 * seção, vira um passo "Outros dados" antes das seções. A seção oculta pelas regras some; os blocos do
 * sistema ficam sempre.
 */
export function passosDo(
  formulario: FormularioDoCandidato,
  avaliacao: AvaliacaoDoFormulario,
): PassoDoFormulario[] {
  const conteudo = conteudoVisivel(formulario, avaliacao);
  const secoes = secoesVisiveis(formulario, avaliacao).map((s) => passoDaSecao(s, conteudo));
  return [...passoDosOutrosDados(formulario, conteudo), ...secoes];
}

function conteudoVisivel(
  formulario: FormularioDoCandidato,
  avaliacao: AvaliacaoDoFormulario,
): ConteudoVisivel {
  const regraPorFato = regrasPorFato(formulario.regras);
  return {
    campos: camposVisiveis(formulario, avaliacao, regraPorFato),
    grupos: gruposVisiveis(formulario, avaliacao, regraPorFato),
    termos: termosVisiveis(formulario, avaliacao),
  };
}

function secoesVisiveis(
  formulario: FormularioDoCandidato,
  avaliacao: AvaliacaoDoFormulario,
): SecaoRenderizavel[] {
  const etapaVisivel = new Map(avaliacao.etapas.map((e) => [e.codigo, e.visivel]));
  return [...formulario.etapas]
    .sort((a, b) => a.ordem - b.ordem)
    .filter(
      (secao) => !secao.codigoNasRegras || etapaVisivel.get(secao.codigoNasRegras) !== OCULTO,
    );
}

function camposVisiveis(
  formulario: FormularioDoCandidato,
  avaliacao: AvaliacaoDoFormulario,
  regraPorFato: ReadonlyMap<string, ItemDasRegras>,
): CampoNoPasso[] {
  const avaliadoPorFato = new Map(avaliacao.campos.map((c) => [c.fatoCodigo, c]));
  return [...formulario.coleta.itens]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((campo): CampoNoPasso[] => {
      const avaliado = avaliadoPorFato.get(campo.fatoCodigo);
      return avaliado && avaliado.regras.visivel === VISIVEL
        ? [{ campo, avaliado, regra: regraPorFato.get(campo.fatoCodigo) ?? null }]
        : [];
    });
}

function gruposVisiveis(
  formulario: FormularioDoCandidato,
  avaliacao: AvaliacaoDoFormulario,
  regraPorFato: ReadonlyMap<string, ItemDasRegras>,
): GrupoNoPasso[] {
  const avaliadoPorGrupo = new Map(avaliacao.grupos.map((g) => [g.codigo, g]));
  return [...formulario.coleta.grupos]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((grupo): GrupoNoPasso[] => {
      const avaliado = avaliadoPorGrupo.get(grupo.codigo);
      return avaliado && avaliado.regras.visivel === VISIVEL
        ? [{ grupo, avaliado, regras: regraPorFato }]
        : [];
    });
}

function termosVisiveis(
  formulario: FormularioDoCandidato,
  avaliacao: AvaliacaoDoFormulario,
): TermoNoPasso[] {
  const avaliadoPorCodigo = new Map(avaliacao.termos.map((t) => [t.codigo, t]));
  return [...formulario.termos]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((termo): TermoNoPasso[] => {
      const avaliado = avaliadoPorCodigo.get(termo.codigoNasRegras);
      return avaliado && avaliado.visivel === VISIVEL ? [{ termo, avaliado }] : [];
    });
}

function naEtapa<T extends { avaliado: { etapaCodigo: string } }>(
  itens: readonly T[],
  etapas: readonly string[],
): T[] {
  return itens.filter((item) => etapas.includes(item.avaliado.etapaCodigo));
}

function passoDaSecao(secao: SecaoRenderizavel, conteudo: ConteudoVisivel): PassoDoFormulario {
  const etapas = secao.codigoNasRegras ? [secao.codigoNasRegras] : [];
  return {
    chave: `secao-${secao.codigo}`,
    titulo: secao.apresentacao.titulo,
    descricao: secao.apresentacao.descricao,
    aviso: secao.apresentacao.aviso,
    bloco: secao.tipo === 'BLOCO' ? (secao.bloco ?? null) : null,
    etapasNasRegras: etapas,
    campos: naEtapa(conteudo.campos, etapas),
    grupos: naEtapa(conteudo.grupos, etapas),
    termos: secao.bloco === BLOCO_REVISAO_E_ACEITE ? conteudo.termos : [],
  };
}

function passoDosOutrosDados(
  formulario: FormularioDoCandidato,
  conteudo: ConteudoVisivel,
): PassoDoFormulario[] {
  const semSecao = etapasSemSecao(formulario);
  return semSecao.length === 0 ? [] : [outrosDados(semSecao, conteudo)];
}

function outrosDados(etapas: readonly string[], conteudo: ConteudoVisivel): PassoDoFormulario {
  return {
    chave: 'outros-dados',
    titulo: 'Outros dados',
    descricao: 'Campos que ainda não estão em nenhuma seção do formulário.',
    aviso: null,
    bloco: null,
    etapasNasRegras: etapas,
    campos: naEtapa(conteudo.campos, etapas),
    grupos: naEtapa(conteudo.grupos, etapas),
    termos: [],
  };
}

/** As etapas das regras que nenhuma seção do formulário cita. */
function etapasSemSecao(formulario: FormularioDoCandidato): string[] {
  const codigosDasSecoes = new Set(
    formulario.etapas.flatMap((s) => (s.codigoNasRegras ? [s.codigoNasRegras] : [])),
  );
  return (formulario.regras.etapas ?? [])
    .map((e) => e.codigo)
    .filter((codigo) => !codigosDasSecoes.has(codigo));
}
