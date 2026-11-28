import { VERDADEIRO } from './interpretador/logica';
import { anunciarMudancaDosDocumentos } from './anuncio-dos-documentos';
import type { ItemDeComprovacao } from './regras-de-documentos';
import { rotuloDoSubitem } from './pendencias-do-passo';
import type { GrupoNoPasso, PassoDoFormulario } from './passos-do-formulario';
import { anunciarMudancaDasModalidades, type ModalidadesAvaliadas } from './modalidades-avaliadas';

/** Os campos de um passo pelo código, com o rótulo e os que são de resposta obrigatória. */
export interface CamposDoPasso {
  readonly chave: string | null;
  readonly campos: ReadonlyMap<string, string>;
  readonly obrigatorios: ReadonlySet<string>;
}

interface PerguntaNoPasso {
  readonly codigo: string;
  readonly rotulo: string;
  readonly obrigatoria: boolean;
}

function subitensDoGrupo({ grupo, avaliado }: GrupoNoPasso): PerguntaNoPasso[] {
  return avaliado.ocorrencias.lista.flatMap((ocorrencia) =>
    ocorrencia.campos
      .filter((subitem) => subitem.regras.visivel === VERDADEIRO)
      .map((subitem) => ({
        codigo: `${grupo.codigo}.${ocorrencia.id}.${subitem.fatoCodigo}`,
        rotulo: rotuloDoSubitem(grupo, subitem),
        obrigatoria: subitem.regras.obrigatorio === VERDADEIRO,
      })),
  );
}

function perguntasDoPasso(passo: PassoDoFormulario): PerguntaNoPasso[] {
  const campos = passo.campos.map((c) => ({
    codigo: c.campo.fatoCodigo,
    rotulo: c.campo.apresentacao.rotulo,
    obrigatoria: c.avaliado.regras.obrigatorio === VERDADEIRO,
  }));
  return [...campos, ...passo.grupos.flatMap(subitensDoGrupo)];
}

/** As perguntas que aparecem no passo, campos e subitens de grupo, para anunciar o que aparece e o que some. */
export function camposDoPasso(passo: PassoDoFormulario | null): CamposDoPasso {
  const perguntas = passo ? perguntasDoPasso(passo) : [];
  return {
    chave: passo?.chave ?? null,
    campos: new Map(perguntas.map((p) => [p.codigo, p.rotulo])),
    obrigatorios: new Set(perguntas.filter((p) => p.obrigatoria).map((p) => p.codigo)),
  };
}

function camposAusentesEm(
  antes: ReadonlyMap<string, string>,
  depois: ReadonlyMap<string, string>,
): [string, string][] {
  return [...depois].filter(([codigo]) => !antes.has(codigo));
}

const PERGUNTA_NOVA_OBRIGATORIA = 'Pergunta nova de resposta obrigatória.';

/** O mesmo texto em várias ocorrências do grupo é dito uma vez. */
function textos(entradas: readonly [string, string][]): string {
  return [...new Set(entradas.map(([, rotulo]) => rotulo))].join(', ');
}

/**
 * "Apareceu: X. Saiu: Y." quando as perguntas do mesmo passo mudam com uma resposta; nada ao trocar de
 * passo. Se o que apareceu é de resposta obrigatória, avisa também que há pergunta nova a responder.
 */
export function anunciarCampos(anteriores: CamposDoPasso, atuais: CamposDoPasso): string {
  if (anteriores.chave !== atuais.chave) return '';
  const apareceram = camposAusentesEm(anteriores.campos, atuais.campos);
  const sairam = camposAusentesEm(atuais.campos, anteriores.campos);
  return [
    apareceram.length > 0 ? `Apareceu: ${textos(apareceram)}.` : '',
    apareceram.some(([codigo]) => atuais.obrigatorios.has(codigo)) ? PERGUNTA_NOVA_OBRIGATORIA : '',
    sairam.length > 0 ? `Saiu: ${textos(sairam)}.` : '',
  ]
    .filter((parte) => parte !== '')
    .join(' ');
}

/** O que a avaliação da API decidiu e pode mudar com uma resposta: as modalidades e os documentos. */
export interface DecisaoDaAvaliacao {
  readonly modalidades: ModalidadesAvaliadas | null;
  readonly modalidadesDaSegundaOpcao: ModalidadesAvaliadas | null;
  readonly documentos: readonly ItemDeComprovacao[] | null;
  readonly integrantes: ReadonlySet<string>;
}

/** O anúncio das modalidades de uma opção de curso, identificado quando há duas; vazio fica vazio. */
function naOpcao(opcao: string | null, anuncio: string): string {
  return opcao === null || anuncio === '' ? anuncio : `${opcao}: ${anuncio}`;
}

function mudancaDaPrimeiraOpcao(atual: DecisaoDaAvaliacao, antes: DecisaoDaAvaliacao): string {
  if (atual.modalidades === antes.modalidades) return '';
  return naOpcao(
    atual.modalidadesDaSegundaOpcao === null ? null : '1ª opção',
    anunciarMudancaDasModalidades(antes.modalidades, atual.modalidades),
  );
}

function mudancaDaSegundaOpcao(atual: DecisaoDaAvaliacao, antes: DecisaoDaAvaliacao): string {
  if (atual.modalidadesDaSegundaOpcao === antes.modalidadesDaSegundaOpcao) return '';
  return naOpcao(
    '2ª opção',
    anunciarMudancaDasModalidades(antes.modalidadesDaSegundaOpcao, atual.modalidadesDaSegundaOpcao),
  );
}

function mudancaDosDocumentos(atual: DecisaoDaAvaliacao, antes: DecisaoDaAvaliacao): string {
  if (atual.documentos === antes.documentos) return '';
  return anunciarMudancaDosDocumentos(antes.documentos, atual.documentos, atual.integrantes);
}

/**
 * Só o que mudou desta vez entra no anúncio: o de antes não volta a ser lido. A primeira avaliação não
 * é mudança.
 */
export function anunciarMudancaDaAvaliacao(
  atual: DecisaoDaAvaliacao,
  antes: DecisaoDaAvaliacao,
): string {
  return [
    mudancaDaPrimeiraOpcao(atual, antes),
    mudancaDaSegundaOpcao(atual, antes),
    mudancaDosDocumentos(atual, antes),
  ]
    .filter((parte) => parte)
    .join(' ');
}
