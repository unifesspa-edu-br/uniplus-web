import type { ProblemDetails } from '@uniplus/shared-core/http';
import { ehColetavel } from '@uniplus/shared-ui/components';

import { nomeDaFinalidade } from '../passos/formulario/formularios-por-finalidade';
import {
  formularioQueColeta,
  recusaDeFaseDoGatilho,
  type FaseNoCronograma,
  type LugarDaExigencia,
  type ProducaoDosFatos,
  type RecusaDaRepeticao,
  type RecusaDeFase,
} from './producao-dos-fatos';

/**
 * O que fazer quando o documento não pode se repetir pelo grupo escolhido. A repetição herdada é do
 * grupo de alternativas, que a tela não edita: a saída é devolver o grupo a um formulário que o
 * responda até a fase, ou tirar o documento dela — nunca um campo que o documento não tem.
 */
export function orientacaoDaRecusaDaRepeticao(
  recusa: RecusaDaRepeticao,
  producao: ProducaoDosFatos,
  nomes: NomesDaOrientacao,
  herdada = false,
): string {
  const outraEscolha = herdada
    ? 'no passo Formulários, ponha o grupo num formulário respondido até a fase do documento; ou retire este documento da fase'
    : 'escolha outro grupo em “Repetir por”, ou “Não repete”';
  if (recusa.tipo === 'GRUPO_INEXISTENTE') {
    return `Nenhum formulário do processo tem mais o grupo “${recusa.grupo}”, pelo qual o documento se repete. Como resolver: ${outraEscolha}.`;
  }

  const grupo = `O grupo “${recusa.grupo.rotulo}”`;
  const fase = nomes.fase(recusa.recusa.faseCodigo);
  const causa =
    recusa.recusa.tipo === 'SO_DA_ISENCAO'
      ? `${grupo} é respondido no formulário de isenção e só repete documento apresentado nele, na fase ${fase}.`
      : recusa.recusa.tipo === 'FASE_POSTERIOR'
        ? `${grupo} é respondido na fase ${fase}, depois da fase em que o documento é exigido.`
        : `${grupo} é respondido na fase ${fase}, que o cronograma não tem.`;
  const saidas = herdada
    ? [outraEscolha]
    : [
        ...saidaPorOutroLugar(recusa.recusa.fato, { ...producao, catalogo: new Map() }, nomes),
        outraEscolha,
      ];
  return `${causa} Como resolver: ${saidas.join('; ou ')}.`;
}

/** Por que o grupo não é oferecido para a repetição do documento, curto o bastante para a dica do campo. */
export function motivoDoGrupoForaDoLugar(
  recusa: Extract<RecusaDaRepeticao, { tipo: 'GRUPO_FORA_DO_LUGAR' }>,
  nomes: NomesDaOrientacao,
): string {
  const fase = nomes.fase(recusa.recusa.faseCodigo);
  return recusa.recusa.tipo === 'SO_DA_ISENCAO'
    ? `“${recusa.grupo.rotulo}”, respondido só no formulário de isenção`
    : `“${recusa.grupo.rotulo}”, respondido na fase ${fase}, depois desta`;
}

/**
 * O que fazer quando o gatilho cita campo de membro fora da repetição pelo grupo que o coleta: o
 * campo só tem valor em cada ocorrência do grupo, e fora dela não há de quem lê-lo.
 */
export function orientacaoDoCampoDeMembroForaDaRepeticao(
  fato: string,
  producao: ProducaoDosFatos,
  nomes: NomesDaOrientacao,
): string {
  const coletor = [...producao.grupos.values()].find((grupo) => grupo.campos.includes(fato));
  const campo = `“${nomes.fato(fato)}”`;
  return coletor === undefined
    ? `${campo} é campo de grupo repetível, e nenhum grupo dos formulários do processo o coleta. Como resolver: retire esta condição.`
    : `${campo} é campo do grupo “${coletor.rotulo}” e só condiciona documento que se repete por ele. Como resolver: escolha “${coletor.rotulo}” em “Repetir por”; ou retire esta condição.`;
}

/** Como a tela nomeia o fato e a fase na orientação. */
export interface NomesDaOrientacao {
  readonly fato: (codigo: string) => string;
  readonly fase: (codigo: string) => string;
}

/**
 * A recusa dita com o que fazer para resolvê-la. Cada saída proposta é conferida pela própria
 * regra antes de ser oferecida — a fase e o formulário para onde levar a exigência, o formulário
 * para onde levar o campo —, para que segui-la não termine em outra recusa. Sem saída que passe,
 * resta retirar a condição.
 */
export function orientacaoDaRecusaDeFase(
  recusa: RecusaDeFase,
  lugar: LugarDaExigencia,
  producao: ProducaoDosFatos,
  nomes: NomesDaOrientacao,
): string {
  const fato = `“${nomes.fato(recusa.fato)}”`;
  const causa = causaDaRecusa(recusa, fato, nomes);

  const saidas = [
    ...saidaPorOutroLugar(recusa.fato, producao, nomes),
    ...saidasPorOutroFormulario(recusa.fato, lugar, producao).map(
      (finalidade) => `colete ${fato} no formulário de ${nomeDaFinalidade(finalidade)}`,
    ),
  ];
  if (saidas.length === 0 && recusa.tipo === 'FASE_FORA_DO_CRONOGRAMA') {
    saidas.push(
      `acrescente ao cronograma a fase ${nomes.fase(recusa.faseCodigo)} e exija o documento nela ou em fase posterior`,
    );
  }

  const comoResolver = saidas.length === 0 ? 'retire esta condição' : saidas.join('; ou ');
  return `${causa} Como resolver: ${comoResolver}.`;
}

function causaDaRecusa(recusa: RecusaDeFase, fato: string, nomes: NomesDaOrientacao): string {
  switch (recusa.tipo) {
    case 'FASE_FORA_DO_CRONOGRAMA':
      return recusa.origem === recusa.fato
        ? `${fato} só é conhecido na fase ${nomes.fase(recusa.faseCodigo)}, que o cronograma não tem.`
        : `${fato} depende de “${nomes.fato(recusa.origem)}”, só conhecido na fase ${nomes.fase(recusa.faseCodigo)}, que o cronograma não tem.`;
    case 'FASE_POSTERIOR':
      return `${fato} só é conhecido na fase ${nomes.fase(recusa.faseCodigo)}, depois da fase em que o documento é exigido.`;
    case 'SO_DA_ISENCAO':
      return `${fato} vem do formulário de isenção e só condiciona documento apresentado nele, que se responde na fase ${nomes.fase(recusa.faseCodigo)}.`;
  }
}

/**
 * Os lugares em que a exigência pode citar o fato, ditos como saída — nenhum quando não há. O
 * lugar é o par fase e formulário: na fase que divide inscrição e isenção, o fato só da isenção
 * vale no documento da isenção e não no da inscrição. A fase em que todo formulário aceita é dita
 * inteira; a que aceita só algum, com o formulário.
 */
function saidaPorOutroLugar(
  fato: string,
  producao: ProducaoDosFatos,
  nomes: NomesDaOrientacao,
): readonly string[] {
  const emOrdem = [...producao.fases].sort((uma, outra) => uma.ordem - outra.ordem);
  const aceitas = fasesQueAceitam(fato, emOrdem, producao);
  const [primeira] = aceitas;
  if (primeira === undefined) return [];

  if (aceitas.some(({ inteira }) => !inteira)) return [saidaPorFormulario(aceitas, nomes)];
  if (aceitas.length === 1)
    return [`exija o documento na fase ${nomes.fase(primeira.fase.codigo)}`];

  const daPrimeiraEmDiante = emOrdem.filter((fase) => fase.ordem >= primeira.fase.ordem);
  return aceitas.length === daPrimeiraEmDiante.length
    ? [`exija o documento na fase ${nomes.fase(primeira.fase.codigo)} ou em fase posterior`]
    : [
        `exija o documento numa destas fases: ${aceitas.map(({ fase }) => nomes.fase(fase.codigo)).join(', ')}`,
      ];
}

/** Uma fase que aceita o fato em algum lugar, e se aceita em todos os formulários que responde. */
interface FaseQueAceita {
  readonly fase: FaseNoCronograma;
  readonly aceitos: readonly LugarDaExigencia[];
  readonly inteira: boolean;
}

function fasesQueAceitam(
  fato: string,
  fasesEmOrdem: readonly FaseNoCronograma[],
  producao: ProducaoDosFatos,
): readonly FaseQueAceita[] {
  return fasesEmOrdem
    .map((fase) => {
      const lugares = lugaresDaFase(fase);
      const aceitos = lugares.filter(
        (lugar) => recusaDeFaseDoGatilho(fato, lugar, producao) === null,
      );
      return { fase, aceitos, inteira: aceitos.length === lugares.length };
    })
    .filter(({ aceitos }) => aceitos.length > 0);
}

/** Quando só alguns formulários da fase aceitam, a saída diz o formulário e a fase de cada um. */
function saidaPorFormulario(aceitas: readonly FaseQueAceita[], nomes: NomesDaOrientacao): string {
  const destinos = aceitas.flatMap(({ fase, aceitos, inteira }) =>
    inteira
      ? [`na fase ${nomes.fase(fase.codigo)}`]
      : aceitos.map(
          (lugar) =>
            `no formulário de ${nomeDaFinalidade(lugar.finalidade ?? '')}, na fase ${nomes.fase(fase.codigo)}`,
        ),
  );
  return `exija o documento ${destinos.join(' ou ')}`;
}

/** Os lugares de uma fase: um por formulário que ela responde, ou a fase só, quando não responde nenhum. */
function lugaresDaFase(fase: FaseNoCronograma): readonly LugarDaExigencia[] {
  return fase.finalidades.length === 0
    ? [{ faseCodigo: fase.codigo, finalidade: null }]
    : fase.finalidades.map((finalidade) => ({ faseCodigo: fase.codigo, finalidade }));
}

/** Os formulários para onde levar a coleta do fato faz o gatilho valer onde a exigência é cobrada. */
function saidasPorOutroFormulario(
  fato: string,
  lugar: LugarDaExigencia,
  producao: ProducaoDosFatos,
): readonly string[] {
  const doCatalogo = producao.catalogo.get(fato);
  if (doCatalogo === undefined || !ehColetavel(doCatalogo)) return [];

  const atual = formularioQueColeta(fato, producao);
  return producao.formularios
    .filter(
      (formulario) => formulario.finalidade !== atual?.finalidade && formulario.faseCodigo !== '',
    )
    .filter(
      (destino) =>
        recusaDeFaseDoGatilho(fato, lugar, comColetaEm(producao, fato, destino.finalidade)) ===
        null,
    )
    .map((destino) => destino.finalidade);
}

/** A produção com o fato coletado só pelo formulário da finalidade dada. */
function comColetaEm(
  producao: ProducaoDosFatos,
  fato: string,
  finalidade: string,
): ProducaoDosFatos {
  return {
    ...producao,
    formularios: producao.formularios.map((formulario) => {
      const fatos = new Set([...formulario.fatos].filter((codigo) => codigo !== fato));
      if (formulario.finalidade === finalidade) fatos.add(fato);
      return { ...formulario, fatos };
    }),
  };
}

/** Onde o operador declara o formulário do documento, como a superfície da fase o rotula. */
const CAMPO_DO_FORMULARIO = 'no campo “Formulário” do documento, na fase';

/**
 * As recusas do servidor sobre onde o documento é cobrado — a fase do fato que o gatilho cita e o
 * formulário a que o documento pertence — ditas com o que fazer. Servem quando a conferência da
 * tela não as previu: o servidor não diz qual documento nem qual condição, e por isso o texto
 * orienta pelo caso e pelo campo que o resolve, sem nomeá-los.
 */
const RECUSA_DA_EXIGENCIA_DO_SERVIDOR: ReadonlyMap<string, string> = new Map([
  [
    'uniplus.selecao.documento_exigido.fato_resolvido_em_fase_posterior',
    'Uma condição de documento exigido cita dado que só é conhecido depois da fase em que o documento é exigido. Exija o documento numa fase em que o dado já seja conhecido, ou colete o dado num formulário respondido até a fase da exigência.',
  ],
  [
    'uniplus.selecao.documento_exigido.fato_da_isencao_em_outra_finalidade',
    `Uma condição de documento exigido cita dado do formulário de isenção, e o documento é apresentado em outro formulário. Escolha o formulário de isenção ${CAMPO_DO_FORMULARIO} da isenção, ou colete o dado no formulário de inscrição.`,
  ],
  [
    'uniplus.selecao.documento_exigido.ponto_resolucao_fora_do_cronograma',
    'Uma condição de documento exigido cita dado que só é conhecido numa fase que o cronograma não tem. Acrescente essa fase ao cronograma e exija o documento nela ou em fase posterior, ou retire a condição.',
  ],
  [
    'uniplus.selecao.documento_exigido.tipo_documento_com_protecao_pendente',
    'Um documento exigido é de um tipo que aguarda a aprovação da proteção de dados e não aceita vínculo novo. Retire o documento da lista, ou espere a proteção de dados aprovar o tipo ou o administrador do catálogo aceitar a recomendação dela.',
  ],
  [
    'uniplus.selecao.documento_exigido.finalidade_obrigatoria',
    `Um documento exigido em fase que responde formulário está sem o formulário em que o candidato o apresenta. Escolha-o ${CAMPO_DO_FORMULARIO} em que ele é exigido.`,
  ],
  [
    'uniplus.selecao.documento_exigido.fase_incoerente_com_finalidade',
    `Um documento exigido declara um formulário que a fase dele não responde. Escolha ${CAMPO_DO_FORMULARIO} em que ele é exigido, um dos formulários que ela responde.`,
  ],
  [
    'uniplus.estrutura_formulario.finalidade_invalida',
    `Um documento exigido declara um formulário que não existe. Escolha ${CAMPO_DO_FORMULARIO} em que ele é exigido, um dos formulários que ela responde.`,
  ],
  [
    'uniplus.selecao.no_exigencia.tipo_entidade_invalido',
    'Um documento exigido se repete por um grupo que nenhum formulário do processo tem. Escolha outro grupo, ou “Não repete”, no campo “Repetir por” do documento, na fase; quando a repetição é do grupo de alternativas, ponha o grupo de volta num formulário, no passo Formulários.',
  ],
  [
    'uniplus.selecao.no_exigencia.repeticao_de_entidade_aninhada',
    'Um documento exigido se repete por um grupo dentro de um grupo de alternativas que já se repete. Escolha “Não repete” no campo “Repetir por” do documento: ele já se repete pelo grupo de alternativas.',
  ],
  [
    'uniplus.predicado_dnf.fato_nao_coletado_pelo_processo',
    'Uma condição de documento exigido cita dado que o processo não coleta, ou campo de grupo repetível em documento que não se repete por esse grupo. Escolha o grupo no campo “Repetir por” do documento, colete o dado num formulário, ou retire a condição.',
  ],
  [
    'uniplus.selecao.no_exigencia.grupo_com_finalidades_diferentes',
    `Os documentos de um grupo de alternativas estão em formulários diferentes, e o candidato satisfaz o grupo num formulário só. Escolha o mesmo formulário para todos eles, ${CAMPO_DO_FORMULARIO} do grupo.`,
  ],
]);

/**
 * A recusa do servidor sobre onde o documento é cobrado, com a orientação; `null` quando a recusa é
 * outra. O código vem no problema, ou em cada erro dele quando a recusa é de forma — a do formulário
 * que não existe chega assim, junto com as outras recusas de forma do mesmo envio.
 */
export function recusaDaExigenciaDoServidor(
  problema: Pick<ProblemDetails, 'code' | 'errors'>,
): string | null {
  const codigos = [problema.code, ...(problema.errors ?? []).map((erro) => erro.code)];
  return (
    codigos
      .map((codigo) => RECUSA_DA_EXIGENCIA_DO_SERVIDOR.get(codigo))
      .find((orientacao) => orientacao !== undefined) ?? null
  );
}
