import {
  fatosCitadosPeloConteudo,
  SECAO_DADOS_BASICOS,
  todosOsCampos,
  type ItemDoFormulario,
} from '@uniplus/shared-ui/components';
import type {
  CriterioDesempateConfigurado,
  DerivacaoDeFato,
  ExigenciasDoRascunho,
  FormularioDaFinalidade,
  FormularioDeInscricao,
} from '../../processo-seletivo.models';
import { todasAsExigencias } from '../../shared/exigencias/consulta-das-exigencias';
import type { RegraDaModalidadeOfertada } from '../../shared/regras-das-modalidades';
import {
  desempateUsaDataDeNascimento,
  FATO_DATA_NASCIMENTO,
} from '../desempate/desempate-por-idade';
import { fatosColetadosPor } from './formulario-do-processo';
import { nomeDaFinalidade } from './formularios-por-finalidade';

/** O que o processo cita, fora do próprio formulário: exigências, derivação, desempate e os formulários das outras finalidades. */
export interface CitantesNoProcesso {
  readonly documentos: ExigenciasDoRascunho;
  readonly derivacao: readonly DerivacaoDeFato[];
  readonly desempate: readonly CriterioDesempateConfigurado[];
  readonly outrasFinalidades?: readonly FormularioDaFinalidade[];
  /** As regras de aplicabilidade das modalidades ofertadas, como o servidor as congelou. */
  readonly modalidades?: readonly RegraDaModalidadeOfertada[];
}

/** Como a frase de recusa nomeia o documento e o fato. */
export interface NomesDosCitantes {
  readonly documento: (tipoDocumentoId: string) => string;
  readonly fato: (codigo: string) => string;
}

/** Para quem só quer saber QUEM cita, não como a frase o nomeia. */
const SEM_NOMES: NomesDosCitantes = { documento: (id) => id, fato: (codigo) => codigo };

/**
 * Quem, no processo, cita cada fato: os documentos cujo gatilho o usa, as regras de derivação que
 * dependem dele, o desempate por maior idade, que ordena pela data de nascimento, e os formulários
 * das outras finalidades, cujas regras citam o que a inscrição coleta. É a fonte única
 * do que o formulário de inscrição precisa coletar (o campo entra sozinho) e do que não pode sair
 * dele (a remoção é recusada com o motivo). As citações de dentro do formulário ficam com o editor.
 */
export function quemCitaNoProcesso(
  processo: CitantesNoProcesso,
  nomes: NomesDosCitantes = SEM_NOMES,
): ReadonlyMap<string, readonly string[]> {
  const citacoes: Citacao[] = [
    ...citacoesDosDocumentos(processo, nomes),
    ...citacoesDaDerivacao(processo, nomes),
    ...citacoesDasModalidades(processo),
    ...(desempateUsaDataDeNascimento(processo.desempate)
      ? [{ fato: FATO_DATA_NASCIMENTO, quem: 'o desempate por maior idade' }]
      : []),
    ...citacoesDasOutrasFinalidades(processo),
  ];

  const citantes = new Map<string, string[]>();
  for (const { fato, quem } of citacoes) {
    const atuais = citantes.get(fato) ?? [];
    if (!atuais.includes(quem)) citantes.set(fato, [...atuais, quem]);
  }
  return citantes;
}

/** Um fato e quem o cita. */
interface Citacao {
  readonly fato: string;
  readonly quem: string;
}

function citacoesDosDocumentos(processo: CitantesNoProcesso, nomes: NomesDosCitantes): Citacao[] {
  return todasAsExigencias(processo.documentos).flatMap((exigencia) =>
    exigencia.condicoes.map((condicao) => ({
      fato: condicao.fato,
      quem: `o documento “${nomes.documento(exigencia.tipoDocumentoId)}”`,
    })),
  );
}

function citacoesDaDerivacao(processo: CitantesNoProcesso, nomes: NomesDosCitantes): Citacao[] {
  return processo.derivacao.flatMap((config) =>
    fatosCitadosPelaDerivacao(config.regras)
      .filter((fato) => fato !== config.codigoFato)
      .map((fato) => ({
        fato,
        quem: `as regras que calculam “${nomes.fato(config.codigoFato)}”`,
      })),
  );
}

function citacoesDasModalidades(processo: CitantesNoProcesso): Citacao[] {
  return (processo.modalidades ?? []).flatMap((modalidade) =>
    fatosCitadosPeloPredicado(modalidade.regra).map((fato) => ({
      fato,
      quem: `a regra de quem concorre em ${modalidade.codigo}`,
    })),
  );
}

/** O que o formulário cita dos próprios campos não depende da inscrição. */
function citacoesDasOutrasFinalidades(processo: CitantesNoProcesso): Citacao[] {
  return (processo.outrasFinalidades ?? []).flatMap((outra) => {
    const proprios = new Set(fatosColetadosPor(outra.conteudo));
    return [...fatosCitadosPeloConteudo(outra.conteudo)]
      .filter((fato) => !proprios.has(fato))
      .map((fato) => ({ fato, quem: `o formulário de ${nomeDaFinalidade(outra.finalidade)}` }));
  });
}

/** O motivo, por fato, de o campo não poder sair: alguém no processo o cita. */
export function remocoesTravadasPor(
  citantes: ReadonlyMap<string, readonly string[]>,
): ReadonlyMap<string, string> {
  return new Map(
    [...citantes].map(([fato, quem]) => [
      fato,
      `Não pode sair: ${quem.join(', ')} ${quem.length > 1 ? 'dependem' : 'depende'} deste dado. Desfaça a dependência antes de remover o campo.`,
    ]),
  );
}

/**
 * Os campos que o formulário coleta e nada no certame usa: nenhuma exigência os cita, nenhuma
 * regra de derivação nem regra de modalidade ofertada depende deles, o desempate não os usa e nenhuma regra do próprio formulário
 * nem dos formulários das outras finalidades os cita. Os dados básicos ficam de fora: a API os
 * coleta em toda inscrição.
 *
 * Não é erro — um edital pode querer coletar algo por outra razão —, e por isso não bloqueia a
 * gravação. É aviso porque a maior parte destes campos entrou sozinha, por causa de um gatilho
 * que depois foi apagado: a remoção automática só alcança o que ESTA sessão acrescentou.
 * Enquanto sobrevive, é dado pessoal pedido ao candidato sem finalidade declarada.
 */
export function camposSemUsoDeclarado(
  formulario: FormularioDeInscricao,
  exigencias: ExigenciasDoRascunho,
  desempate: readonly CriterioDesempateConfigurado[] = [],
  modalidades: readonly RegraDaModalidadeOfertada[] = [],
): readonly ItemDoFormulario[] {
  const usados = new Set([
    ...quemCitaNoProcesso({
      documentos: exigencias,
      derivacao: formulario.derivacao,
      desempate,
      outrasFinalidades: formulario.outrasFinalidades,
      modalidades,
    }).keys(),
    ...fatosCitadosPeloConteudo(formulario.conteudo),
  ]);

  return todosOsCampos(formulario.conteudo).filter(
    (campo) => campo.etapaCodigo !== SECAO_DADOS_BASICOS && !usados.has(campo.fatoCodigo),
  );
}

/**
 * Os fatos que as regras de derivação de um fato citam, lidas na forma opaca em que elas
 * trafegam — a mesma do contrato, uma lista de cláusulas por regra.
 */
export function fatosCitadosPelaDerivacao(regras: unknown): readonly string[] {
  if (!Array.isArray(regras)) return [];
  return regras.flatMap((regra: unknown) =>
    typeof regra === 'object' && regra !== null && 'quando' in regra
      ? fatosCitadosPeloPredicado((regra as { quando: unknown }).quando)
      : [],
  );
}

/**
 * Os fatos citados num predicado em forma normal disjuntiva — a lista de cláusulas, cada uma com
 * as suas condições. O `quando` de uma regra de derivação chega ao rascunho como valor opaco.
 */
export function fatosCitadosPeloPredicado(predicado: unknown): readonly string[] {
  if (!Array.isArray(predicado)) return [];
  return predicado.flatMap((clausula: unknown) =>
    Array.isArray(clausula)
      ? clausula.flatMap((condicao: unknown) =>
          typeof condicao === 'object' &&
          condicao !== null &&
          'fato' in condicao &&
          typeof (condicao as { fato: unknown }).fato === 'string'
            ? [(condicao as { fato: string }).fato]
            : [],
        )
      : [],
  );
}
