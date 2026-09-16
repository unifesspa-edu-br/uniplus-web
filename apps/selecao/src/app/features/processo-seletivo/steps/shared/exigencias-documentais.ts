import type {
  BaseLegalDto,
  DocumentoExigidoDto,
  ItemDocumentoExigidoInput,
  NoExigenciaDto,
  NoExigenciaInput,
  ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import type {
  BaseLegalConfig,
  CondicaoGatilhoConfig,
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  NoDeExigencia,
} from '../processo-seletivo.models';

/**
 * Tradução entre o rascunho do wizard e a árvore de exigências documentais do contrato
 * (`PUT …/documentos-exigidos`, `ProcessoSeletivoDto.raizesExigencia`).
 *
 * O rascunho guarda a MESMA árvore que o contrato, menos as referências que não sobrevivem a
 * uma gravação de cronograma — fase por código em vez de id, aqui e na idade máxima. O resto
 * é cópia campo a campo, e é isso que faz o que a tela não edita sobreviver: o `PUT`
 * substitui a árvore inteira, e o que o wizard sintetizasse do zero apagaria grupo `OU`,
 * cardinalidade qualificada e repetição por entidade a cada salvamento.
 *
 * A hidratação lê `raizesExigencia`, a árvore, e não `documentosExigidos`, a lista plana:
 * a lista plana não diz quem é filho de qual grupo.
 */

/** Aplicabilidade e gatilho, no vocabulário do wire. */
export const APLICABILIDADE_GERAL = 'GERAL';
export const APLICABILIDADE_CONDICIONAL = 'CONDICIONAL';
export const FATO_MODALIDADE = 'MODALIDADE';
const OPERADOR_EM = 'EM';

/** O token que declara ausência de restrição — o campo é obrigatório no wire. */
const QUALQUER_FORMATO = 'QUALQUER';

/**
 * Os formatos que o contrato da exigência conhece, indexados pelas grafias que o cadastro de
 * tipos de documento aceita. O cadastro é texto livre; a exigência é vocabulário fechado.
 */
const FORMATO_DO_WIRE = new Map([
  ['PDF', 'PDF'],
  ['JPEG', 'JPEG'],
  ['JPG', 'JPEG'],
  ['PNG', 'PNG'],
]);

/** Um megabyte em bytes — o cadastro declara em MB, a exigência trafega em bytes. */
const BYTES_POR_MB = 1024 * 1024;

/**
 * A restrição de arquivo que o cadastro publica para um tipo de documento. O tamanho chega
 * como número ou texto — o contrato o descreve como inteiro de 32 bits, e o gerador admite as
 * duas formas.
 */
export interface RestricaoDeArquivo {
  readonly formatosAceitos?: string | null;
  readonly tamanhoMaximoMb?: number | string | null;
}

/**
 * O teto em bytes, ou `null` quando o cadastro não declara tamanho.
 *
 * O contrato recebe o teto como inteiro de 32 bits e o cadastro não limita o valor em MB:
 * um tipo declarado com 2048 MB ou mais produziria um número acima do que o campo comporta, e
 * a recusa viria como 400 de desserialização, derrubando a gravação da árvore inteira por
 * causa de um documento. Acima do teto, o campo viaja ausente — "o cadastro não restringe o
 * tamanho" é mais verdadeiro que um número truncado.
 */
function tetoEmBytes(tamanhoMaximoMb: number | string | null | undefined): number | null {
  if (tamanhoMaximoMb === null || tamanhoMaximoMb === undefined) return null;
  const mb = typeof tamanhoMaximoMb === 'number' ? tamanhoMaximoMb : Number(tamanhoMaximoMb);
  if (!Number.isFinite(mb) || mb <= 0) return null;

  const bytes = mb * BYTES_POR_MB;
  return bytes > MAIOR_INTEIRO_DE_32_BITS ? null : bytes;
}

/** O teto de `tamanhoMaximoBytes` no contrato — `int32`. */
const MAIOR_INTEIRO_DE_32_BITS = 2_147_483_647;

/**
 * Traduz os formatos do cadastro para o vocabulário da exigência. O que o contrato não
 * conhece volta em `naoExpressos` em vez de sumir: a tela precisa dizer que aquele formato
 * ficou de fora, senão o edital prometeria ao candidato um arquivo que a exigência recusa.
 */
export function formatosDeclarados(formatosAceitos: string | null | undefined): {
  readonly tokens: readonly string[];
  readonly naoExpressos: readonly string[];
} {
  const tokens: string[] = [];
  const naoExpressos: string[] = [];

  for (const bruto of (formatosAceitos ?? '').split(/[,;/]/)) {
    const limpo = bruto.trim();
    if (limpo === '') continue;
    const token = FORMATO_DO_WIRE.get(limpo.toUpperCase());
    if (token === undefined) naoExpressos.push(limpo);
    else if (!tokens.includes(token)) tokens.push(token);
  }

  return { tokens, naoExpressos };
}

/**
 * Uma exigência recém-declarada, antes de o operador dizer qualquer coisa sobre ela. Nasce
 * obrigatória porque é o caso comum — documento pedido no edital é documento que decide a
 * análise —, e é por isso que a tela pede a base legal em seguida.
 *
 * A restrição de arquivo vem do cadastro do tipo de documento, que é onde o CEPS a declara —
 * ter uma segunda fonte no wizard seria pior que não ter nenhuma.
 */
export function exigenciaNova(
  tipoDocumentoId: string,
  faseCodigo: string,
  restricao?: RestricaoDeArquivo,
): ExigenciaDeDocumento {
  const { tokens } = formatosDeclarados(restricao?.formatosAceitos);
  return {
    tipoDocumentoId,
    faseCodigo,
    etapaId: null,
    aplicabilidade: APLICABILIDADE_GERAL,
    obrigatorio: true,
    consequenciaIndeferimento: '',
    condicoes: [],
    basesLegais: [baseLegalNova()],
    idadeMaximaEmissao: null,
    formatosPermitidos: tokens.length > 0 ? [...tokens] : QUALQUER_FORMATO,
    tamanhoMaximoBytes: tetoEmBytes(restricao?.tamanhoMaximoMb),
  };
}

/** Uma norma em branco, no alcance e no status que são o caso comum. */
export function baseLegalNova(): BaseLegalConfig {
  return {
    referencia: '',
    abrangencia: ABRANGENCIA_PADRAO,
    status: STATUS_BASE_LEGAL_RESOLVIDO,
    observacao: '',
  };
}

/** A folha do rascunho que envolve uma exigência. */
export function folhaDe(documento: ExigenciaDeDocumento): NoDeExigencia {
  return {
    tipo: 'FOLHA',
    documento,
    quantidadeMinima: null,
    consequencia: null,
    basesLegais: null,
    filhos: null,
    chaveDistincao: null,
    dataReferencia: null,
    ocorrenciasEsperadas: null,
    repetePorEntidade: null,
  };
}

/** O rascunho sem exigência nenhuma. */
export function exigenciasVazias(): ExigenciasDoRascunho {
  return { raizes: [], emTodasAsFases: [] };
}

/**
 * O que a tela oferece para a base legal de uma exigência recém-declarada: alcance interno do
 * edital e status resolvido. É o caso comum — a exigência nasce da própria norma do certame —,
 * e quem declara uma lei federal troca os dois no formulário.
 */
export const ABRANGENCIA_PADRAO = 'INTERNA_EDITAL';
export const STATUS_BASE_LEGAL_RESOLVIDO = 'RESOLVIDO';

/**
 * Alcance da norma que sustenta a exigência, como a tela o nomeia. Vocabulário fechado do
 * domínio, governado por código — mesmo tratamento que o papel de uma publicação recebe.
 */
export const ABRANGENCIAS_ESCOLHIVEIS = [
  { valor: 'FEDERAL', rotulo: 'Lei federal' },
  { valor: 'ESTADUAL', rotulo: 'Lei estadual' },
  { valor: 'MUNICIPAL', rotulo: 'Lei municipal' },
  { valor: 'INTERNA_NORMA', rotulo: 'Norma interna da universidade' },
  { valor: ABRANGENCIA_PADRAO, rotulo: 'O próprio edital' },
] as const;

/** Se a norma já foi identificada ou se a identificação segue pendente. */
export const STATUS_BASE_LEGAL_ESCOLHIVEIS = [
  { valor: STATUS_BASE_LEGAL_RESOLVIDO, rotulo: 'Resolvida' },
  { valor: 'PENDENTE', rotulo: 'Pendente' },
] as const;

/**
 * O que acontece com quem não entrega o documento, ou tem a entrega indeferida. Vazio é
 * escolha legítima: a exigência que não decide sozinha não precisa declarar consequência.
 */
/**
 * A consequência que só vale em fase que admite complementação — o servidor a recusa nas
 * demais, e a tela precisa saber disso para não oferecê-la onde não cabe.
 */
export const CONSEQUENCIA_REENVIO = 'PENDENCIA_REENVIO';

export const CONSEQUENCIAS_ESCOLHIVEIS = [
  { valor: '', rotulo: 'Não decide sozinha' },
  { valor: 'ELIMINA', rotulo: 'Elimina do processo' },
  { valor: 'RECLASSIFICA_AC', rotulo: 'Reclassifica para ampla concorrência' },
  { valor: 'REMOVE_VANTAGEM', rotulo: 'Remove a vantagem pleiteada' },
  { valor: CONSEQUENCIA_REENVIO, rotulo: 'Abre pendência para reenvio' },
] as const;

/**
 * Expande o rascunho na árvore que o `PUT` recebe: uma folha por (documento, fase).
 *
 * O recorte por modalidade vira gatilho: sem recorte o documento é exigido de todo
 * candidato (`GERAL`), e com recorte ele é exigido de quem concorre às modalidades
 * escolhidas — que é o que `CONDICIONAL` com a cláusula `MODALIDADE EM [...]` diz.
 * Um recorte que ficou vazio depois de o quadro de vagas mudar não vira cláusula
 * vazia (que o agregado recusa): volta a valer para todos.
 */
/**
 * O recorte de modalidades declarado no gatilho da exigência, ou `null` quando ela vale para
 * todo candidato.
 *
 * O recorte mora no gatilho porque é assim que o contrato o expressa — `MODALIDADE EM [...]`
 * —, e guardar uma segunda lista ao lado dele criaria duas versões da mesma verdade.
 */
export function modalidadesDaExigencia(
  documento: ExigenciaDeDocumento,
): readonly string[] | null {
  return modalidadesDoGatilho(documento.condicoes);
}

/**
 * A exigência com o recorte trocado. `null` devolve o documento a todo candidato: a cláusula
 * sai do gatilho em vez de ficar como lista vazia, que o agregado recusa.
 */
export function comModalidades(
  documento: ExigenciaDeDocumento,
  codigos: readonly string[] | null,
): ExigenciaDeDocumento {
  if (codigos === null) {
    // Tirar o recorte de modalidade NÃO torna a exigência geral: pode haver condição sobre
    // outro fato. A aplicabilidade só muda quando o operador a declara.
    return { ...documento, condicoes: comRecorteDeModalidade(documento.condicoes, null) };
  }

  return {
    ...documento,
    aplicabilidade: APLICABILIDADE_CONDICIONAL,
    condicoes: comRecorteDeModalidade(documento.condicoes, codigos),
  };
}

/**
 * Os números de cláusula que o gatilho usa, em ordem — `[1]` quando ele ainda não tem
 * condição nenhuma, que é a cláusula em que a primeira condição nascerá.
 */
export function numerosDeClausula(
  condicoes: readonly CondicaoGatilhoConfig[],
): readonly number[] {
  const numeros = [...new Set(condicoes.map((condicao) => condicao.clausula))].sort(
    (um, outro) => um - outro,
  );
  return numeros.length > 0 ? numeros : [1];
}

/**
 * Troca o recorte de modalidade do gatilho, replicando-o em CADA alternativa.
 *
 * As cláusulas se combinam por OU e as condições de dentro de uma delas por E — a forma
 * normal disjuntiva. Como o recorte vale para o gatilho inteiro, ele tem de aparecer em toda
 * alternativa: escrevê-lo só na primeira diria "(modalidade E o resto) OU (a outra
 * alternativa, para qualquer modalidade)", que é justamente o que quem recortou não quis.
 */
function comRecorteDeModalidade(
  condicoes: readonly CondicaoGatilhoConfig[],
  codigos: readonly string[] | null,
): readonly CondicaoGatilhoConfig[] {
  // Só a cláusula que o controle "quem deve entregar" escreve é substituída — ela é a única
  // que ele sabe reescrever. Uma comparação de modalidade de outra forma, que o domínio aceita
  // e este wizard não escreve, sobrevive: descartá-la apagaria no servidor, a cada gravação,
  // uma condição declarada por outro caminho.
  const outras = condicoes.filter(
    (condicao) => !(condicao.fato === FATO_MODALIDADE && condicao.operador === OPERADOR_EM),
  );
  if (codigos === null) return outras;

  const valor = JSON.stringify(codigos);
  return [
    ...outras,
    ...numerosDeClausula(outras).map((clausula: number) => ({
      clausula,
      fato: FATO_MODALIDADE,
      operador: OPERADOR_EM,
      valor,
    })),
  ];
}

/**
 * A exigência com o recorte que o operador acabou de marcar em "quem deve entregar".
 *
 * Marcar TODAS as modalidades ofertadas é declarar que o documento vale para todo candidato —
 * a menos que reste outra condição a sustentá-lo. Sem esta parte, a exigência ficava "de quem
 * satisfaz" com gatilho vazio, isto é, cobrada de ninguém: o documento sumia do edital em
 * silêncio, e nenhuma conferência o acusava.
 *
 * Marcar todas também não grava uma lista que por acaso coincide com o quadro de vagas: a
 * diferença aparece quando o quadro muda depois, e o que acompanha o quadro acompanha a
 * mudança.
 */
export function comRecorteEscolhido(
  documento: ExigenciaDeDocumento,
  escolhidas: readonly string[],
  ofertadas: readonly string[],
): ExigenciaDeDocumento {
  const acompanhaOQuadro =
    escolhidas.length === ofertadas.length &&
    ofertadas.every((codigo) => escolhidas.includes(codigo));

  const recortada = comModalidades(documento, acompanhaOQuadro ? null : [...escolhidas]);
  return acompanhaOQuadro && recortada.condicoes.length === 0
    ? comExigidoDeTodos(recortada, true)
    : recortada;
}

/** Se a exigência é cobrada de todo candidato, sem gatilho nenhum. */
export function exigidoDeTodos(documento: ExigenciaDeDocumento): boolean {
  return documento.aplicabilidade === APLICABILIDADE_GERAL;
}

/**
 * Declara de quem a exigência é cobrada. É uma DECLARAÇÃO, nunca inferida da presença de
 * condição (ADR-0071): quem diz "de todos" está dizendo que o gatilho não se aplica, e por
 * isso ele é descartado junto — o agregado recusa a exigência geral que carrega condição, e
 * guardar o gatilho invisível o faria ressurgir na próxima vez que a aplicabilidade mudasse,
 * sem que ninguém o tivesse reescrito.
 */
export function comExigidoDeTodos(
  documento: ExigenciaDeDocumento,
  deTodos: boolean,
): ExigenciaDeDocumento {
  if (deTodos) {
    return { ...documento, aplicabilidade: APLICABILIDADE_GERAL, condicoes: [] };
  }
  return { ...documento, aplicabilidade: APLICABILIDADE_CONDICIONAL };
}

/**
 * Percorre a árvore aplicando uma transformação a cada folha; folha que a transformação
 * descarta sai, e grupo que fica sem filho nenhum sai junto, em cascata.
 *
 * O colapso em cascata é o mesmo que a raiz faz no servidor ao remover uma fase: grupo sem
 * alternativa não exige nada, e mandá-lo vazio faria o `PUT` recusar a árvore inteira.
 */
function transformar(
  nos: readonly NoDeExigencia[],
  transformacao: (documento: ExigenciaDeDocumento) => ExigenciaDeDocumento | null,
): readonly NoDeExigencia[] {
  const vivos: NoDeExigencia[] = [];

  for (const no of nos) {
    if (no.tipo === 'FOLHA') {
      const documento = no.documento === null ? null : transformacao(no.documento);
      if (documento !== null) vivos.push({ ...no, documento });
      continue;
    }

    const filhos = transformar(no.filhos ?? [], transformacao);
    if (filhos.length === 0) continue;
    vivos.push({ ...no, filhos, quantidadeMinima: coubeNoGrupo(no.quantidadeMinima, filhos.length) });
  }

  return vivos;
}

/**
 * A quantidade mínima que ainda cabe no grupo depois da poda.
 *
 * Um grupo que pedia duas alternativas e ficou com uma só continuaria pedindo duas: o agregado
 * recusa, e a recusa chega depois de as etapas, o cronograma e o formulário já terem sido
 * gravados — falando de um campo que esta tela não mostra. Reduzir preserva a intenção
 * possível: continuar pedindo o máximo que o grupo ainda oferece.
 */
function coubeNoGrupo(quantidadeMinima: number | null, filhos: number): number | null {
  if (quantidadeMinima === null) return null;
  return Math.min(quantidadeMinima, filhos);
}

/**
 * As exigências sem a fase removida do cronograma. A exigência que valia só ali deixa de
 * existir; o mesmo documento em outra fase continua, porque são exigências distintas.
 *
 * A idade máxima que ancorava nessa fase perde a âncora em vez de apontar para fase que saiu
 * — a recusa do servidor falaria de um campo que a tela não mostra.
 */
export function semAFase(exigencias: ExigenciasDoRascunho, faseCodigo: string): ExigenciasDoRascunho {
  const raizes = transformar(exigencias.raizes, (documento) => {
    if (documento.faseCodigo === faseCodigo) return null;
    if (documento.idadeMaximaEmissao?.referenciaFaseCodigo !== faseCodigo) return documento;
    return {
      ...documento,
      idadeMaximaEmissao: { ...documento.idadeMaximaEmissao, referenciaFaseCodigo: null },
    };
  });

  // A marca de alcance global cai junto com a última declaração de raiz que lhe servia de
  // modelo. Sem isso ela fica órfã: a tela segue anunciando o documento como exigido, a
  // materialização não tem de onde copiá-lo, e a gravação sai sem a exigência — sem nada
  // dizendo que ela deixou de existir.
  const comModelo = new Set(
    raizes
      .filter((no) => no.tipo === 'FOLHA' && no.documento !== null)
      .map((no) => (no.documento as ExigenciaDeDocumento).tipoDocumentoId),
  );

  return {
    raizes,
    emTodasAsFases: exigencias.emTodasAsFases.filter((tipo) => comModelo.has(tipo)),
  };
}

/**
 * As exigências sem a etapa removida: quem a apontava como ponto de coleta volta a ser da
 * fase inteira, em vez de reenviar o identificador de uma etapa que não existe mais.
 */
export function semAEtapa(exigencias: ExigenciasDoRascunho, etapaId: string): ExigenciasDoRascunho {
  return {
    ...exigencias,
    raizes: transformar(exigencias.raizes, (documento) =>
      documento.etapaId === etapaId ? { ...documento, etapaId: null } : documento,
    ),
  };
}

/** As exigências declaradas numa fase, na ordem em que a árvore as guarda. */
export function exigenciasDaFase(
  exigencias: ExigenciasDoRascunho,
  faseCodigo: string,
): readonly ExigenciaDeDocumento[] {
  const achados: ExigenciaDeDocumento[] = [];
  const visitar = (nos: readonly NoDeExigencia[]): void => {
    for (const no of nos) {
      if (no.tipo === 'FOLHA') {
        if (no.documento !== null && no.documento.faseCodigo === faseCodigo) {
          achados.push(no.documento);
        }
        continue;
      }
      visitar(no.filhos ?? []);
    }
  };
  visitar(exigencias.raizes);
  return achados;
}

/**
 * Onde uma exigência está na árvore: solta, ou dentro de um grupo que a combina com outras.
 *
 * A distinção importa para quem monta o edital. Uma folha dentro de um grupo `OU` não é
 * exigida por si — basta satisfazer o grupo —, e a mesma lista mostrando-a ao lado de uma
 * exigência solta faz as duas parecerem a mesma coisa.
 */
export interface GrupoDaExigencia {
  readonly tipo: 'E' | 'OU';
  /** Quantas alternativas do grupo precisam ser satisfeitas; `null` é o padrão do domínio, 1. */
  readonly quantidadeMinima: number | null;
  /** Quantos filhos o grupo reúne — folhas e subgrupos, que também são alternativas. */
  readonly alternativas: number;
}

/** Uma exigência com a posição que ela ocupa na árvore. */
export interface ExigenciaLocalizada {
  readonly documento: ExigenciaDeDocumento;
  /** `null` quando a exigência está solta, fora de qualquer grupo. */
  readonly grupo: GrupoDaExigencia | null;
}

/**
 * As exigências de uma fase com a posição de cada uma na árvore.
 *
 * A tela listava as folhas de dentro de um grupo como se fossem soltas, e um conjunto por tipo
 * de documento colapsava numa linha só o documento declarado solto E dentro de um grupo —
 * editar essa linha mexia numa das duas declarações, escolhida por acaso da ordem.
 */
export function exigenciasLocalizadasDaFase(
  exigencias: ExigenciasDoRascunho,
  faseCodigo: string,
): readonly ExigenciaLocalizada[] {
  const achados: ExigenciaLocalizada[] = [];

  const visitar = (nos: readonly NoDeExigencia[], grupo: GrupoDaExigencia | null): void => {
    for (const no of nos) {
      if (no.tipo === 'FOLHA') {
        if (no.documento !== null && no.documento.faseCodigo === faseCodigo) {
          achados.push({ documento: no.documento, grupo });
        }
        continue;
      }

      const filhos = no.filhos ?? [];
      // Conta TODOS os filhos, não só as folhas: um grupo pode reunir outros grupos, e contar
      // só as folhas diretas diria "uma das 1 alternativas" onde há duas.
      visitar(filhos, {
        tipo: no.tipo,
        quantidadeMinima: no.quantidadeMinima,
        alternativas: filhos.length,
      });
    }
  };

  visitar(exigencias.raizes, null);
  return achados;
}

/**
 * Os grupos que decidem sozinhos o resultado e estão sem norma resolvida.
 *
 * É o mesmo que a publicação confere: grupo `OU` com consequência própria precisa de ao menos
 * uma base legal resolvida, pela mesma razão que a exigência individual precisa. A tela não
 * edita grupo — eles chegam da configuração —, mas calar sobre a pendência faria a pessoa
 * descobrir no último passo, sem saber de qual grupo se trata.
 */
export function gruposSemNormaResolvida(
  exigencias: ExigenciasDoRascunho,
): readonly { readonly documentos: readonly string[] }[] {
  const pendentes: { readonly documentos: readonly string[] }[] = [];

  const visitar = (nos: readonly NoDeExigencia[]): void => {
    for (const no of nos) {
      if (no.tipo === 'FOLHA') continue;

      const decideResultado = no.tipo === 'OU' && (no.consequencia ?? '') !== '';
      const temNorma = (no.basesLegais ?? []).some(
        (base) => base.referencia.trim() !== '' && base.status === STATUS_BASE_LEGAL_RESOLVIDO,
      );
      if (decideResultado && !temNorma) {
        // Os documentos de TODA a subárvore, não só as folhas diretas: um grupo que reúne
        // outros grupos ficaria sem nome nenhum na mensagem, que é o oposto do que ela serve.
        pendentes.push({ documentos: documentosDaSubarvore(no.filhos ?? []) });
      }

      visitar(no.filhos ?? []);
    }
  };

  visitar(exigencias.raizes);
  return pendentes;
}

/** Os tipos de documento de todas as folhas de uma subárvore, em qualquer profundidade. */
function documentosDaSubarvore(nos: readonly NoDeExigencia[]): readonly string[] {
  return nos.flatMap((no) =>
    no.tipo === 'FOLHA'
      ? no.documento === null
        ? []
        : [no.documento.tipoDocumentoId]
      : documentosDaSubarvore(no.filhos ?? []),
  );
}

/**
 * As exigências declaradas na RAIZ da árvore — fora de qualquer grupo.
 *
 * É deste conjunto que sai o modelo ao espalhar um documento por todas as fases: copiar uma
 * folha de dentro de um grupo `OU` transformaria "um destes dois basta" em "este, sozinho,
 * obrigatório" nas demais fases — mudança de sentido que ninguém pediu.
 */
export function exigenciasDaRaiz(
  exigencias: ExigenciasDoRascunho,
): readonly ExigenciaDeDocumento[] {
  return exigencias.raizes
    .filter((no) => no.tipo === 'FOLHA' && no.documento !== null)
    .map((no) => no.documento as ExigenciaDeDocumento);
}

/** Todas as exigências da árvore, de qualquer fase. */
export function todasAsExigencias(
  exigencias: ExigenciasDoRascunho,
): readonly ExigenciaDeDocumento[] {
  const achados: ExigenciaDeDocumento[] = [];
  const visitar = (nos: readonly NoDeExigencia[]): void => {
    for (const no of nos) {
      if (no.tipo === 'FOLHA') {
        if (no.documento !== null) achados.push(no.documento);
        continue;
      }
      visitar(no.filhos ?? []);
    }
  };
  visitar(exigencias.raizes);
  return achados;
}

/**
 * Substitui a exigência de (documento, fase) pelo resultado da edição, ou a acrescenta como
 * folha na raiz quando ainda não existe.
 *
 * A folha nova entra na raiz, nunca dentro de um grupo existente: um grupo `OU` declara
 * alternativas entre si e todas as suas folhas pertencem à mesma fase — acrescentar ali
 * mudaria o sentido do grupo sem o operador ter pedido.
 */
export function comExigencia(
  exigencias: ExigenciasDoRascunho,
  documento: ExigenciaDeDocumento,
): ExigenciasDoRascunho {
  // Só a PRIMEIRA folha que casa é trocada. O mesmo documento pode aparecer duas vezes na
  // mesma fase — uma solta e outra como alternativa de um grupo `OU` —, e o contrato não
  // proíbe isso; escrever nas duas de uma vez sobrescreveria a alternativa do grupo com a
  // edição feita na outra, sem nada na tela dizendo que havia duas.
  let trocou = false;
  const raizes = transformar(exigencias.raizes, (atual) => {
    if (trocou) return atual;
    if (atual.tipoDocumentoId !== documento.tipoDocumentoId) return atual;
    if (atual.faseCodigo !== documento.faseCodigo) return atual;
    trocou = true;
    return documento;
  });

  return {
    ...exigencias,
    raizes: trocou ? raizes : [...raizes, folhaDe(documento)],
  };
}

/** Remove a exigência de (documento, fase), colapsando o grupo que ficar vazio. */
export function semAExigencia(
  exigencias: ExigenciasDoRascunho,
  tipoDocumentoId: string,
  faseCodigo: string,
): ExigenciasDoRascunho {
  // Remove só a PRIMEIRA que casa, pela mesma razão de `comExigencia`: desmarcar o documento
  // não pode levar junto a alternativa homônima de um grupo, que é outra declaração.
  let removeu = false;
  return {
    ...exigencias,
    raizes: transformar(exigencias.raizes, (documento) => {
      if (removeu) return documento;
      if (documento.tipoDocumentoId !== tipoDocumentoId) return documento;
      if (documento.faseCodigo !== faseCodigo) return documento;
      removeu = true;
      return null;
    }),
  };
}

/**
 * Serializa a árvore do rascunho no que o `PUT` recebe, resolvendo o que é declarado por
 * código contra o processo vivo e podando o que o cronograma invalidou.
 *
 * A poda não é zelo: o `PUT` recusa a árvore inteira se um nó apontar fase que saiu do
 * cronograma (`FaseNaoPertenceAoProcesso`), etapa que não é da fase (`EtapaNaoPertenceAFase`),
 * cláusula de modalidade esvaziada (`ClausulaVazia`) ou grupo sem filhos (`GrupoVazio`) — e a
 * recusa chegaria sobre configuração que a tela não mostra mais.
 */
export function arvoreDeExigencias(
  exigencias: ExigenciasDoRascunho,
  faseIdPorCodigo: ReadonlyMap<string, string>,
  modalidadesOfertadas: readonly string[],
  etapasVivas: ReadonlySet<string>,
): readonly NoExigenciaInput[] {
  const completas = comAlcanceDeTodasAsFases(exigencias, [...faseIdPorCodigo.keys()]);
  return podar(completas.raizes, faseIdPorCodigo, modalidadesOfertadas, etapasVivas);
}

/**
 * Materializa, em cada fase do cronograma, o documento que o operador declarou valer em todas.
 *
 * É na SERIALIZAÇÃO que isso acontece, e não só no clique: a fase acrescentada depois de a
 * intenção ter sido declarada também precisa receber a exigência, e uma materialização feita
 * uma vez só deixaria essa fase de fora sem nada na tela denunciando a ausência.
 *
 * O modelo vem das folhas de raiz — copiar uma alternativa de grupo mudaria o sentido dela.
 */
export function comAlcanceDeTodasAsFases(
  exigencias: ExigenciasDoRascunho,
  fasesVivas: readonly string[],
): ExigenciasDoRascunho {
  let resultado = exigencias;

  for (const tipoDocumentoId of exigencias.emTodasAsFases) {
    const modelo = exigenciasDaRaiz(resultado).find(
      (exigencia) => exigencia.tipoDocumentoId === tipoDocumentoId,
    );
    if (modelo === undefined) continue;

    for (const faseCodigo of fasesVivas) {
      // Só declaração de RAIZ conta como "já tem". O mesmo documento pode estar na fase como
      // alternativa dentro de um grupo OU, e isso é outra coisa: ali ele é uma das saídas
      // possíveis, não uma exigência. Aceitar a folha do grupo como satisfeita transformava
      // "este documento é exigido" em "este documento serve", sem nada na tela dizendo.
      const jaTemNaRaiz = exigenciasDaRaiz(resultado).some(
        (exigencia) =>
          exigencia.tipoDocumentoId === tipoDocumentoId && exigencia.faseCodigo === faseCodigo,
      );
      if (jaTemNaRaiz) continue;

      // Acrescenta na RAIZ, sem passar por `comExigencia`: ela troca a primeira folha que casa
      // por (documento, fase), e essa primeira pode ser a alternativa dentro do grupo — a
      // materialização sobrescreveria a alternativa em vez de criar a exigência ao lado dela.
      resultado = {
        ...resultado,
        raizes: [...resultado.raizes, folhaDe({ ...modelo, faseCodigo, etapaId: null })],
      };
    }
  }

  return resultado;
}

function podar(
  nos: readonly NoDeExigencia[],
  faseIdPorCodigo: ReadonlyMap<string, string>,
  modalidadesOfertadas: readonly string[],
  etapasVivas: ReadonlySet<string>,
): readonly NoExigenciaInput[] {
  const vivos: NoExigenciaInput[] = [];

  for (const no of nos) {
    if (no.tipo === 'FOLHA') {
      const documento = no.documento;
      // A fase saiu do cronograma depois de o documento ser marcado nela.
      if (documento === null || !faseIdPorCodigo.has(documento.faseCodigo)) continue;

      vivos.push({
        ...comoNo(no),
        documento: folha(documento, faseIdPorCodigo, modalidadesOfertadas, etapasVivas),
        filhos: null,
      });
      continue;
    }

    const filhos = podar(no.filhos ?? [], faseIdPorCodigo, modalidadesOfertadas, etapasVivas);
    // Grupo que perdeu todos os filhos deixa de existir — mandá-lo vazio derrubaria a
    // gravação inteira, e um grupo sem alternativa nenhuma não exige coisa alguma.
    if (filhos.length === 0) continue;

    vivos.push({ ...comoNo(no), documento: null, filhos });
  }

  return vivos;
}

/** Os campos do nó que o rascunho carrega sem tocar, inclusive os que a tela não edita. */
function comoNo(no: NoDeExigencia): NoExigenciaInput {
  return {
    tipo: no.tipo,
    documento: null,
    quantidadeMinima: comoNumero(no.quantidadeMinima),
    consequencia: no.consequencia,
    basesLegais: no.basesLegais === null ? null : no.basesLegais.map(comoBaseLegal),
    filhos: null,
    chaveDistincao: no.chaveDistincao,
    dataReferencia: no.dataReferencia,
    ocorrenciasEsperadas: no.ocorrenciasEsperadas,
    repetePorEntidade: no.repetePorEntidade,
  };
}

/** Norma sem referência não viaja: é linha em branco do formulário, não declaração. */
function comoBaseLegal(base: BaseLegalConfig): {
  referencia: string;
  abrangencia: string;
  status: string;
  observacao: string | null;
} {
  return {
    referencia: base.referencia.trim(),
    abrangencia: base.abrangencia,
    status: base.status,
    observacao: base.observacao.trim() === '' ? null : base.observacao.trim(),
  };
}

function folha(
  documento: ExigenciaDeDocumento,
  faseIdPorCodigo: ReadonlyMap<string, string>,
  modalidadesOfertadas: readonly string[],
  etapasVivas: ReadonlySet<string>,
): ItemDocumentoExigidoInput {
  const recorte = recorteDeModalidades(documento, modalidadesOfertadas);
  // A etapa que coletava saiu do cronograma: o documento volta a ser da fase inteira em vez
  // de referenciar um identificador que o processo não tem mais.
  const etapaId =
    documento.etapaId !== null && documento.etapaId !== '' && etapasVivas.has(documento.etapaId)
      ? documento.etapaId
      : null;

  return {
    exigidoNaFaseId: faseIdPorCodigo.get(documento.faseCodigo) ?? '',
    exigidoNaEtapaId: etapaId,
    tipoDocumentoId: documento.tipoDocumentoId,
    // A aplicabilidade é DECLARADA, nunca inferida das condições (ADR-0071): "exigida de quem
    // satisfaz" com gatilho vazio é estado legítimo — exigida de ninguém —, e derivá-la da
    // presença de condição tornaria esse estado inalcançável pela tela.
    //
    // Quando é de todos, TODA condição sai: o agregado recusa a exigência geral que carrega
    // gatilho, e antes disto uma condição sobre outro fato viajava junto com a aplicabilidade
    // rebaixada — inclusive quando o operador marcava todas as modalidades.
    aplicabilidade: documento.aplicabilidade,
    obrigatorio: documento.obrigatorio,
    consequenciaIndeferimento:
      documento.consequenciaIndeferimento === '' ? null : documento.consequenciaIndeferimento,
    condicoes:
      documento.aplicabilidade === APLICABILIDADE_GERAL
        ? []
        : comRecorteDeModalidade(documento.condicoes, recorte),
    // A publicação exige base legal resolvida de toda exigência que decide o resultado; a
    // que não decide pode seguir sem norma declarada. Linha em branco não conta como norma.
    basesLegais: documento.basesLegais
      .filter((base) => base.referencia.trim() !== '')
      .map(comoBaseLegal),
    idadeMaximaEmissao: comoIdadeMaxima(documento.idadeMaximaEmissao, faseIdPorCodigo),
    formatosPermitidos: documento.formatosPermitidos as ItemDocumentoExigidoInput['formatosPermitidos'],
    tamanhoMaximoBytes: documento.tamanhoMaximoBytes,
  };
}

/**
 * A idade máxima, com a fase âncora resolvida de volta para identificador.
 *
 * A fase que ancorava saiu do cronograma: a âncora é limpa em vez de viajar apontando para
 * linha que não existe mais. O servidor recusaria com `IdadeMaximaEmissao.FaseNaoPertenceAoProcesso`,
 * e a recusa falaria de um campo que esta tela não renderiza — o operador não teria o que fazer.
 */
function comoIdadeMaxima(
  idade: ExigenciaDeDocumento['idadeMaximaEmissao'],
  faseIdPorCodigo: ReadonlyMap<string, string>,
): ItemDocumentoExigidoInput['idadeMaximaEmissao'] {
  if (idade === null) return null;

  const faseId =
    idade.referenciaFaseCodigo === null ? null : faseIdPorCodigo.get(idade.referenciaFaseCodigo);
  if (idade.referenciaFaseCodigo !== null && faseId === undefined) return null;

  return {
    valor: idade.valor,
    unidade: idade.unidade,
    referenciaTipo: idade.referenciaTipo,
    data: idade.data,
    referenciaFaseId: faseId ?? null,
  };
}

/**
 * As modalidades do recorte, ou `null` quando não há recorte a escrever.
 *
 * Duas podas, por motivos diferentes. O recorte que ficou VAZIO depois de o quadro de vagas
 * mudar sai porque cláusula vazia é recusada pelo agregado — e a exigência que deixou de
 * alcançar modalidade alguma é acusada à parte, pela conferência de alcance.
 *
 * O recorte que passou a cobrir TODA a oferta sai só quando o gatilho tem outra condição para
 * sustentar a exigência. Sem ela, podá-lo deixaria uma exigência "de quem satisfaz" sem
 * condição nenhuma — cobrada de ninguém —, e o documento sumiria do edital em silêncio por
 * causa de uma mudança no quadro de vagas que ninguém ligou a ele.
 */
function recorteDeModalidades(
  documento: ExigenciaDeDocumento,
  modalidadesOfertadas: readonly string[],
): readonly string[] | null {
  const declarado = modalidadesDoGatilho(documento.condicoes);
  if (declarado === null) return null;

  const ofertadas = new Set(modalidadesOfertadas);
  const recorte = declarado.filter((codigo) => ofertadas.has(codigo));
  if (recorte.length === 0) return null;

  const temOutraCondicao = documento.condicoes.some(
    (condicao) => condicao.fato !== FATO_MODALIDADE,
  );
  if (recorte.length === ofertadas.size && temOutraCondicao) return null;
  return recorte;
}

/**
 * A árvore de exigências como o rascunho a guarda, lida de `raizesExigencia`.
 *
 * Lê a ÁRVORE, não a lista plana `documentosExigidos`: a lista plana não diz quem é filho de
 * qual grupo, e reconstruir tudo como folha solta apagaria o grupo `OU` e a consequência
 * própria dele na gravação seguinte.
 */
export function exigenciasDe(dto: ProcessoSeletivoDto): ExigenciasDoRascunho {
  const codigoPorFaseId = new Map((dto.cronogramaFases ?? []).map((f) => [f.id, f.codigo]));
  const raizes = (dto.raizesExigencia ?? [])
    .map((no) => noDe(no, codigoPorFaseId))
    .filter((no): no is NoDeExigencia => no !== null);

  const fases = [...codigoPorFaseId.values()];
  return { raizes, emTodasAsFases: alcanceDeTodasAsFasesReconstruido({ raizes, emTodasAsFases: [] }, fases) };
}

/**
 * Relê, do que voltou do servidor, quais documentos o operador declarou valer em todas as fases.
 *
 * A intenção não trafega: o contrato recebe as folhas já materializadas, uma por fase. Sem
 * reconstruí-la, reabrir o processo a rebaixava a uma escolha fase a fase — e a fase criada
 * depois disso ficava sem o documento, sem nada na tela denunciando a ausência.
 *
 * O sinal é estar em todas as fases DA MESMA MANEIRA. Estar em todas não basta: o certame pode
 * exigir o mesmo documento em cada fase por razões próprias, com condições, consequência ou
 * norma diferentes em cada uma. Lê-las como um alcance global faria a fase criada depois
 * receber uma cópia arbitrária de uma dessas declarações — configuração que ninguém pediu, e
 * pior do que a intenção perdida. Declarações idênticas não têm esse risco: a cópia reproduz o
 * que já está lá.
 *
 * Exige ainda ao menos duas fases: com uma só, "vale em todas" e "vale nesta" são a mesma
 * configuração, e inferir a primeira daria à segunda um alcance que ninguém declarou.
 */
function alcanceDeTodasAsFasesReconstruido(
  exigencias: ExigenciasDoRascunho,
  fases: readonly string[],
): readonly string[] {
  if (fases.length < 2) return [];

  const candidatos = new Set(exigenciasDaRaiz(exigencias).map((e) => e.tipoDocumentoId));


  // Só declarações de RAIZ, pela mesma razão que a materialização: a folha dentro de um grupo
  // OU é alternativa, não exigência. Contá-la como presença fazia o documento que é exigido
  // numa fase e apenas alternativo noutra ser lido como global — e a gravação seguinte
  // materializaria exigências novas, transformando a alternativa em documento cobrado.
  const daRaiz = exigenciasDaRaiz(exigencias);

  return [...candidatos].filter((tipoDocumentoId) => {
    const porFase = fases.map((faseCodigo) =>
      daRaiz.filter((e) => e.tipoDocumentoId === tipoDocumentoId && e.faseCodigo === faseCodigo),
    );

    // Uma declaração por fase, em todas elas — duas na mesma fase já são configuração que o
    // alcance global não sabe reproduzir.
    if (!porFase.every((declaracoes) => declaracoes.length === 1)) return false;

    const referencia = assinaturaDaDeclaracao(porFase[0][0]);
    return porFase.every(([declaracao]) => assinaturaDaDeclaracao(declaracao) === referencia);
  });
}

/**
 * O que precisa coincidir entre fases para as declarações serem a MESMA coisa dita em cada uma.
 *
 * Fica de fora o que é por definição próprio de cada fase — a fase e a etapa que coleta. O
 * resto é o conteúdo da exigência: se algum deles diverge, são declarações independentes.
 */
function assinaturaDaDeclaracao(exigencia: ExigenciaDeDocumento): string {
  return JSON.stringify({
    tipoDocumentoId: exigencia.tipoDocumentoId,
    aplicabilidade: exigencia.aplicabilidade,
    obrigatorio: exigencia.obrigatorio,
    consequenciaIndeferimento: exigencia.consequenciaIndeferimento,
    condicoes: exigencia.condicoes,
    basesLegais: exigencia.basesLegais,
    idadeMaximaEmissao: exigencia.idadeMaximaEmissao,
    formatosPermitidos: exigencia.formatosPermitidos,
    tamanhoMaximoBytes: exigencia.tamanhoMaximoBytes,
  });
}

function noDe(no: NoExigenciaDto, codigoPorFaseId: ReadonlyMap<string, string>): NoDeExigencia | null {
  const tipo = no.tipo as NoDeExigencia['tipo'];

  if (tipo === 'FOLHA') {
    const documento = documentoDe(no.documento, codigoPorFaseId);
    // Exigência cuja fase não está no cronograma lido: não há código estável a guardar, e
    // inventar um faria a gravação seguinte pedir uma fase que o processo não tem.
    if (documento === null) return null;
    return { ...camposDoNo(no), tipo, documento, filhos: null };
  }

  const filhos = (no.filhos ?? [])
    .map((filho: NoExigenciaDto) => noDe(filho, codigoPorFaseId))
    .filter((filho): filho is NoDeExigencia => filho !== null);
  if (filhos.length === 0) return null;

  return { ...camposDoNo(no), tipo, documento: null, filhos };
}

function camposDoNo(no: NoExigenciaDto): Omit<NoDeExigencia, 'tipo' | 'documento' | 'filhos'> {
  return {
    quantidadeMinima: comoNumero(no.quantidadeMinima),
    consequencia: no.consequencia,
    // A leitura devolve lista vazia para o nó que não tem norma própria; a escrita distingue
    // "sem norma" de "lista vazia" — o contrato só aceita a coleção quando há consequência
    // declarada, e mandar `[]` onde nunca houve nada seria declarar o que ninguém declarou.
    basesLegais:
      no.basesLegais === null || no.basesLegais === undefined || no.basesLegais.length === 0
        ? null
        : no.basesLegais.map(baseLegalDe),
    chaveDistincao: no.chaveDistincao,
    dataReferencia: no.dataReferencia,
    ocorrenciasEsperadas: no.ocorrenciasEsperadas,
    repetePorEntidade: no.repetePorEntidade,
  };
}

function documentoDe(
  dto: DocumentoExigidoDto | null | undefined,
  codigoPorFaseId: ReadonlyMap<string, string>,
): ExigenciaDeDocumento | null {
  if (dto === null || dto === undefined) return null;

  const faseCodigo = codigoPorFaseId.get(dto.exigidoNaFaseId);
  if (faseCodigo === undefined) return null;

  return {
    // O DTO de leitura nomeia o tipo como `origemId`; a escrita o recebe como
    // `tipoDocumentoId`. É a única renomeação entre os dois lados.
    tipoDocumentoId: dto.tipoDocumentoOrigemId,
    faseCodigo,
    etapaId: dto.exigidoNaEtapaId ?? null,
    aplicabilidade: dto.aplicabilidade,
    obrigatorio: dto.obrigatorio,
    consequenciaIndeferimento: dto.consequenciaIndeferimento ?? '',
    condicoes: dto.condicoes.map((condicao) => ({
      clausula: comoNumero(condicao.clausula) ?? 1,
      fato: condicao.fato,
      operador: condicao.operador,
      valor: condicao.valor,
    })),
    basesLegais: dto.basesLegais.map(baseLegalDe),
    idadeMaximaEmissao:
      dto.idadeMaximaEmissao === null || dto.idadeMaximaEmissao === undefined
        ? null
        : {
            valor: comoNumero(dto.idadeMaximaEmissao.valor),
            unidade: dto.idadeMaximaEmissao.unidade,
            referenciaTipo: dto.idadeMaximaEmissao.referenciaTipo,
            data: dto.idadeMaximaEmissao.data,
            referenciaFaseCodigo:
              dto.idadeMaximaEmissao.referenciaFaseId === null ||
              dto.idadeMaximaEmissao.referenciaFaseId === undefined
                ? null
                : (codigoPorFaseId.get(dto.idadeMaximaEmissao.referenciaFaseId) ?? null),
          },
    formatosPermitidos: dto.formatosPermitidos,
    tamanhoMaximoBytes: comoNumero(dto.tamanhoMaximoBytes),
  };
}

/**
 * Numérico do contrato como número. O gerador tipa alguns inteiros do wire como
 * `string | number` porque o schema os descreve com formato, e o rascunho guarda número —
 * coagir na entrada evita espalhar a união por toda a tela.
 */
function comoNumero(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/** As quatro colunas da norma, `observacao` inclusive — que antes nunca era lida. */
function baseLegalDe(base: BaseLegalDto): BaseLegalConfig {
  return {
    referencia: base.referencia,
    abrangencia: base.abrangencia,
    status: base.status,
    observacao: base.observacao ?? '',
  };
}

/**
 * As modalidades da cláusula `MODALIDADE EM [...]`, ou `null` quando o gatilho não fala de
 * modalidade.
 *
 * O valor trafega como texto que contém JSON (mesmo tratamento do gatilho no resto do
 * contrato), e texto que não é a lista esperada não vira recorte — um recorte inventado a
 * partir de um valor ilegível mentiria sobre quem precisa entregar.
 */
function modalidadesDoGatilho(
  condicoes: readonly { readonly fato: string; readonly operador: string; readonly valor: string }[],
): readonly string[] | null {
  const daModalidade = condicoes.find(
    (condicao) => condicao.fato === FATO_MODALIDADE && condicao.operador === OPERADOR_EM,
  );
  if (daModalidade === undefined) return null;

  try {
    const valor: unknown = JSON.parse(daModalidade.valor);
    if (!Array.isArray(valor)) return null;
    return valor.filter((item): item is string => typeof item === 'string');
  } catch {
    return null;
  }
}
