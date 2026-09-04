import { FundamentoIsencao, OrigemCandidatos } from '@uniplus/shared-data/selecao';
import type { FundamentoIsencaoCodigo } from '@uniplus/shared-data/selecao';
import type { DocumentoEditalDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { OrigemCandidatosSelecionada, UploadItem } from '../processo-seletivo.models';
import {
  DistribuicaoDeVagas,
  EtapaPontuada,
  FaseDoCronograma,
  RecursoDaFase,
  WizardDraft,
} from '../processo-seletivo.models';
import {
  decodificarComposicaoVagas,
  ehRamoFederal,
  quantidadeEhDeclarada,
} from '../steps/vagas/distribuicao-de-vagas';
import { formatarValorEmReais } from './valor-em-reais';

/**
 * Projeta o `ProcessoSeletivoDto` (fonte durável) sobre o rascunho editável,
 * só nos campos que já têm modelo de edição no wizard (issue #478, D4 do
 * design da fundação). As demais dimensões do DTO — etapas, cronograma,
 * documentos exigidos, coleta de fatos etc. — ainda não têm seção própria e
 * por isso não são mapeadas aqui; nada as descarta, elas simplesmente
 * permanecem fora do rascunho local até a Story que as implementa
 * (`#479–#485`, `#504`, `#534`) estender este adaptador.
 */
export function hidratarDraft(draft: WizardDraft, dto: ProcessoSeletivoDto): WizardDraft {
  return {
    ...draft,
    tipoProcesso: {
      selected: dto.tipoProcesso.origemId,
      rotulo: dto.tipoProcesso.nome,
    },
    pagamento: pagamentoDe(dto),
    vagas: { ofertas: distribuicoesDe(dto) },
    cronograma: cronogramaDe(dto),
    identificacao: {
      ...draft.identificacao,
      nome: dto.nome,
      unidadeAdministradoraId: dto.unidadeAdministradora.origemId,
      origemCandidatos: decodificarOrigemCandidatos(dto.origemCandidatos),
      localidade: {
        codigoIbge: dto.localidade.codigoIbge,
        nome: dto.localidade.nome,
        uf: dto.localidade.uf,
      },
    },
  };
}

/**
 * Projeta o cronograma, as etapas pontuadas e a convenção de contagem.
 *
 * Guarda os identificadores **de origem**, que é o que a gravação recebe: a
 * fase pelo id da fase canônica, a banca pelo id do tipo de banca. O `id` que o
 * detalhe traz identifica o snapshot da configuração, não a entidade do
 * catálogo — reenviá-lo produziria referência que o servidor não resolve. E a
 * entrada de fase sequer tem campo de id: a reconciliação é por fase canônica.
 *
 * A etapa é a exceção deliberada: o `id` dela é preservado e reenviado, porque
 * critério de desempate e regra de eliminação o referenciam.
 *
 * Os números voltam como texto porque é o que o campo edita.
 */
function cronogramaDe(dto: ProcessoSeletivoDto): WizardDraft['cronograma'] {
  const algoritmo = dto.algoritmoContagemPrazo;

  return {
    fases: (dto.cronogramaFases ?? []).map(faseDe),
    // Renumeradas na chegada: a etapa gravada sem ordem volta como zero, e com
    // uma etapa só não há duplicata que a conferência acuse nem botão de mover
    // que a conserte — a gravação sairia com ordem zero para voltar recusada,
    // sem nada na tela explicando. A posição na lista é a ordem que o servidor
    // devolveu, então renumerar preserva a sequência que já existia.
    etapas: (dto.etapas ?? []).map(etapaDe).map((etapa, posicao) => ({
      ...etapa,
      ordem: posicao + 1,
    })),
    algoritmoContagemCodigo: algoritmo?.codigo ?? '',
    algoritmoContagemVersao: algoritmo?.versao ?? '',
  };
}

function faseDe(fase: ProcessoSeletivoDto['cronogramaFases'][number]): FaseDoCronograma {
  return {
    faseCanonicaId: fase.faseCanonicaOrigemId,
    codigo: fase.codigo,
    // O detalhe traz o que a fase congelou; o catálogo pode não ter mais esta
    // fase, e é isto que mantém a tela sabendo o que ela exige.
    congelados: {
      donoTipico: fase.donoInstitucional,
      origemData: fase.origemData,
      agrupaEtapas: fase.agrupaEtapas,
      produzResultado: fase.produzResultado,
      resultadoDefinitivo: fase.resultadoDefinitivo,
      coletaInscricao: fase.coletaInscricao,
      bancas: fase.bancasRequeridas.map((banca) => ({
        id: banca.tipoBancaOrigemId,
        codigo: banca.codigo,
      })),
    },
    ordem: comoInteiro(fase.ordem),
    inicio: fase.inicio,
    fim: fase.fim,
    atoProduzidoCodigo: fase.atoProduzidoCodigo,
    tiposBancaIds: fase.bancasRequeridas.map((banca) => banca.tipoBancaOrigemId),
    regraRecurso: recursoDe(fase.regraRecurso),
  };
}

/**
 * A presença da regra é o que faz a fase admitir recurso. O hash da referência
 * não volta ao rascunho: o servidor o recompõe do catálogo, e guardá-lo aqui
 * criaria uma cópia que envelhece sozinha.
 */
function recursoDe(
  regra: ProcessoSeletivoDto['cronogramaFases'][number]['regraRecurso'],
): RecursoDaFase | null {
  if (regra === null || regra === undefined) return null;

  const args = regra.args;
  return {
    regraCodigo: regra.regra.codigo,
    regraVersao: regra.regra.versao,
    prazoValor: comoTexto(args.prazoValor),
    prazoUnidade: args.prazoUnidade,
    atoAncoraCodigo: args.atoAncoraCodigo,
    suspensividadePrimeiraInstanciaValor: comoTexto(args.suspensividadePrimeiraInstanciaValor),
    suspensividadePrimeiraInstanciaUnidade: args.suspensividadePrimeiraInstanciaUnidade ?? '',
    suspensividadeSegundaInstanciaValor: comoTexto(args.suspensividadeSegundaInstanciaValor),
    suspensividadeSegundaInstanciaUnidade: args.suspensividadeSegundaInstanciaUnidade ?? '',
  };
}

/**
 * As etapas do processo como o rascunho as guarda.
 *
 * Exportada porque a gravação precisa recolher os `id` que o servidor atribuiu
 * sem hidratar o wizard inteiro: `hidratarDraft` substitui todas as seções, e o
 * operador pode ter editado outro passo sem gravá-lo — a navegação é livre.
 */
export function etapasDe(dto: ProcessoSeletivoDto): EtapaPontuada[] {
  return (dto.etapas ?? []).map(etapaDe);
}

function etapaDe(etapa: ProcessoSeletivoDto['etapas'][number]): EtapaPontuada {
  return {
    id: etapa.id,
    nome: etapa.nome,
    carater: etapa.carater,
    tipoEtapaOrigemId: etapa.tipoEtapa.origemId,
    peso: comoTexto(etapa.peso),
    notaMinima: comoTexto(etapa.notaMinima),
    ordem: comoInteiro(etapa.ordem),
  };
}

/** O contrato admite número ou texto; ausente vira campo vazio, não zero. */
function comoTexto(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  return String(valor);
}

/**
 * A ordem é posição na lista, e o contrato a admite como número ou texto.
 * Ausente vira zero — que a validação recusa, e é o que se quer: ordem não
 * declarada precisa aparecer como pendência, não passar despercebida.
 */
function comoInteiro(valor: number | string | null | undefined): number {
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  }
  return 0;
}

/**
 * Projeta a distribuição de vagas já gravada.
 *
 * Guarda sempre os identificadores **de origem**, que é o que o comando de
 * gravação recebe. O `id` que o detalhe traz identifica o snapshot da
 * configuração, não a entidade do catálogo: reenviá-lo produziria referência
 * que o servidor não resolve.
 *
 * Os números voltam como texto porque é o que o campo edita.
 *
 * O quadro devolvido é o resultado do cálculo, e só as quantidades que o edital
 * fixou podem voltar como entrada: reenviar as calculadas na gravação seguinte
 * faria o servidor recusar a configuração que ele mesmo devolveu.
 */
function distribuicoesDe(dto: ProcessoSeletivoDto): DistribuicaoDeVagas[] {
  return (dto.distribuicaoVagas ?? []).map((distribuicao) => ({
    ofertaCursoId: distribuicao.ofertaCursoOrigemId,
    voBase: String(distribuicao.voBase),
    pr: comoDecimalPtBr(distribuicao.pr),
    regraDistribuicaoCodigo: distribuicao.regraDistribuicao.codigo,
    regraDistribuicaoVersao: distribuicao.regraDistribuicao.versao,
    regraAjusteCodigo: distribuicao.regraAjuste?.codigo ?? null,
    regraAjusteVersao: distribuicao.regraAjuste?.versao ?? null,
    referenciaReservaDemograficaId: distribuicao.referenciaDemografica?.origemId ?? null,
    modalidades: distribuicao.modalidades.map((modalidade) => ({
      id: modalidade.modalidadeOrigemId,
      codigo: modalidade.codigo,
    })),
    quadro: quadroDeclaradoDe(distribuicao),
  }));
}

/** Só o que o edital fixou; o que a regra calcula fica de fora do rascunho. */
function quadroDeclaradoDe(
  distribuicao: ProcessoSeletivoDto['distribuicaoVagas'][number],
): DistribuicaoDeVagas['quadro'] {
  const federal = ehRamoFederal(distribuicao.regraDistribuicao.codigo);
  const composicaoPorModalidade = new Map(
    distribuicao.modalidades.map((modalidade) => [
      modalidade.modalidadeOrigemId,
      decodificarComposicaoVagas(modalidade.composicaoVagas),
    ]),
  );

  return distribuicao.quadro
    .filter((vaga) => {
      const composicao = composicaoPorModalidade.get(vaga.modalidadeOrigemId);
      return (
        composicao !== undefined &&
        composicao !== null &&
        quantidadeEhDeclarada(composicao, federal)
      );
    })
    .map((vaga) => ({
      modalidadeId: vaga.modalidadeOrigemId,
      quantidade: String(vaga.quantidade),
    }));
}

/**
 * O separador decimal do campo é a vírgula, e é assim que o operador informou o
 * percentual. Devolver o ponto de `String(0.5)` faria a tela reabrir mostrando
 * grafia diferente da que ela mesma pediu.
 */
function comoDecimalPtBr(valor: number | string): string {
  return String(valor).replace('.', ',');
}

/**
 * Projeta a configuração de taxa já gravada. Ausente significa "ainda não
 * declarado" — que é diferente de declarar que não cobra, e por isso vira
 * `cobra: null` em vez de `false`: o passo precisa continuar exigindo a
 * declaração.
 *
 * O valor volta como texto porque é o que o campo edita; a vírgula decimal é
 * a forma que o operador digita e reconhece.
 */
function pagamentoDe(dto: ProcessoSeletivoDto): WizardDraft['pagamento'] {
  const config = dto.configuracaoTaxaInscricao;
  if (config === null || config === undefined) {
    return { cobra: null, valor: '', fundamentos: [] };
  }

  return {
    cobra: config.cobra,
    valor: valorGravadoComoTexto(config.valor),
    fundamentos: [...config.fundamentos].filter(ehFundamentoConhecido),
  };
}

/**
 * O valor gravado chega como número ou como texto no formato do JSON, com
 * ponto decimal — que é wire format, não a escrita do operador. `Number` é o
 * leitor certo aqui, ao contrário do campo, onde `1.000` significa mil.
 */
function valorGravadoComoTexto(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(numero) ? formatarValorEmReais(numero) : '';
}

/**
 * O detalhe devolve os fundamentos como texto livre, e a gravação aceita
 * vocabulário fechado. Um código que este cliente não conhece é descartado do
 * rascunho editável em vez de seguir para um comando que o recusaria.
 */
function ehFundamentoConhecido(codigo: string): codigo is FundamentoIsencaoCodigo {
  const conhecidos: readonly string[] = Object.values(FundamentoIsencao);
  return conhecidos.includes(codigo);
}

/**
 * A leitura e a escrita do processo não falam o mesmo vocabulário: a criação
 * recebe `inscricaoPropria`, mas o `ProcessoSeletivoDto` devolve o nome do
 * enum de domínio — `InscricaoPropria`. Sem traduzir, a retomada gravaria no
 * rascunho um valor que nenhuma `<option>` do formulário tem, e o campo
 * apareceria vazio para um processo que declarou a origem (uniplus-api#1294).
 *
 * Valor fora do vocabulário conhecido vira `''`: o formulário mostra
 * "Selecione" e a validação cobra a escolha, em vez de carregar adiante um
 * valor que o servidor recusaria.
 */
function decodificarOrigemCandidatos(valor: string): OrigemCandidatosSelecionada {
  const normalizado = valor.charAt(0).toLowerCase() + valor.slice(1);
  if (normalizado === OrigemCandidatos.inscricaoPropria) {
    return OrigemCandidatos.inscricaoPropria;
  }
  if (normalizado === OrigemCandidatos.importacaoExterna) {
    return OrigemCandidatos.importacaoExterna;
  }
  return '';
}

/**
 * Projeta o readback de um documento confirmado no shape que o passo 2 já
 * sabe exibir. O contrato não devolve o nome original do arquivo
 * (uniplus-api#1180 o exclui de propósito — metadado de storage), daí o
 * rótulo genérico.
 */
export function uploadItemDe(documento: DocumentoEditalDto): UploadItem {
  return {
    id: documento.id,
    name: 'Edital anexado.pdf',
    extension: 'pdf',
    progress: 100,
    fase: 'confirmado',
    documentoEditalId: documento.id,
    enviado: true,
  };
}

export interface ReadbackDocumentos {
  /** Documento confirmado único — vínculo restaurável sem decisão. */
  readonly vinculo: UploadItem | null;
  /** Confirmados que exigem escolha explícita do administrador (CA-06). */
  readonly escolha: readonly DocumentoEditalDto[];
}

/**
 * Decide o que fazer com os documentos lidos do processo. Um confirmado
 * restaura o vínculo; mais de um é levado ao administrador, porque eleger o
 * mais recente trocaria o edital do certame sem ninguém perceber. Pendentes
 * não contam: só confirmado tem hash e selo de imutabilidade.
 */
export function classificarDocumentos(
  documentos: readonly DocumentoEditalDto[],
): ReadbackDocumentos {
  const confirmados = documentos.filter((documento) => documento.confirmadoEm !== null);

  if (confirmados.length === 0) return { vinculo: null, escolha: [] };
  if (confirmados.length === 1) return { vinculo: uploadItemDe(confirmados[0]), escolha: [] };
  return { vinculo: null, escolha: confirmados };
}

/** Tamanho legível — distinguir dois PDFs pelo byte cru não ajuda ninguém. */
export function formatarTamanho(bytes: number | string | null): string {
  const valor = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (valor === null || !Number.isFinite(valor)) return 'tamanho indisponível';
  if (valor < 1024) return `${valor} B`;
  if (valor < 1024 * 1024) return `${(valor / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(valor / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Como apresentar um documento confirmado na escolha do oficial (CA-06).
 *
 * O contrato não devolve o nome do arquivo — é metadado de storage, excluído
 * de propósito — e não há rota de download, então não dá para inspecionar o
 * conteúdo antes de decidir. O que resta são metadados estáveis: instante da
 * confirmação com segundos, porque duas confirmações no mesmo minuto ficariam
 * idênticas sem eles; tamanho; e o início do hash, que é a identidade do
 * arquivo — hashes iguais significam o mesmo conteúdo, e aí a escolha é
 * indiferente.
 */
export function descreverDocumento(documento: DocumentoEditalDto): string {
  const quando = documento.confirmadoEm === null ? null : new Date(documento.confirmadoEm);
  const instante =
    quando === null || Number.isNaN(quando.getTime())
      ? 'instante indisponível'
      : quando.toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

  const hash =
    documento.hashSha256 === null
      ? 'hash indisponível'
      : `hash ${documento.hashSha256.slice(0, 12)}`;

  return `${instante} · ${formatarTamanho(documento.tamanhoBytes)} · ${hash}`;
}
