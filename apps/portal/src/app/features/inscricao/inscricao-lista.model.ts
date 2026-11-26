import {
  type AcoesDaInscricaoDto,
  type MinhaInscricaoDto,
  MotivoDasInscricoesFechadasCodigo,
  SituacaoInscricaoCodigo,
} from '@uniplus/shared-data/selecao';
import { formatarDataBr } from '@uniplus/shared-utils';

/** Uma inscrição como a lista a mostra. */
export interface ItemDaLista {
  /** A chave da lista: o mesmo processo pode ter uma inscrição cancelada e outra nova. */
  readonly id: string;
  readonly processoId: string;
  readonly situacao: MinhaInscricaoDto['situacao'];
  /** O rótulo que o cartão mostra: o da API, ou "Não enviada" quando o prazo de inscrições encerrou sem o envio. */
  readonly rotuloDaSituacao: string;
  /** O rascunho que ficou sem envio porque a API informa que o período de inscrições encerrou. */
  readonly naoEnviada: boolean;
  readonly nome: string;
  /** Só a inscrição enviada ou cancelada tem número. */
  readonly numero: string | null;
  /** O que a situação não diz sozinha: o prazo do rascunho, a data e o motivo do cancelamento. */
  readonly mensagem: string | null;
  /** Os cursos escolhidos, em ordem; vazio enquanto o rascunho não escolheu nenhum. */
  readonly cursos: readonly CursoDaInscricao[];
  /** O que a API permite fazer agora; a lista não recalcula. */
  readonly acoes: AcoesDaInscricaoDto;
  /** O número do comprovante que vale, para abri-lo; a API o deixa nulo quando não há comprovante a emitir. */
  readonly numeroDoComprovante: number | null;
}

/** Um curso escolhido: a ordem da opção e o nome com o grau. */
export interface CursoDaInscricao {
  readonly ordem: number;
  readonly nome: string;
}

const ROTULO_NAO_ENVIADA = 'Não enviada';

const MENSAGEM_PADRAO_DO_RASCUNHO =
  'Sua inscrição está em rascunho. Conclua e envie dentro do prazo.';

const MENSAGEM_SEM_MOTIVO_CONHECIDO = 'Não é possível continuar esta inscrição agora.';

/** O motivo que a tela não conhece, inclusive o período não confirmado, cai na mensagem neutra. */
const MENSAGEM_POR_MOTIVO: ReadonlyMap<string, string> = new Map([
  [
    MotivoDasInscricoesFechadasCodigo.PERIODO_ENCERRADO,
    'O prazo de inscrições foi encerrado. Como sua inscrição não foi enviada dentro do prazo, ela não foi efetivada e não poderá mais ser concluída.',
  ],
  [
    MotivoDasInscricoesFechadasCodigo.PERIODO_NAO_INICIADO,
    'O período de inscrições deste processo seletivo ainda não começou. Você poderá continuar sua inscrição quando ele começar.',
  ],
  [
    MotivoDasInscricoesFechadasCodigo.PROCESSO_SEM_INSCRICAO,
    'Este processo seletivo não recebe inscrição pelo sistema. Sua inscrição em rascunho não pode ser continuada.',
  ],
]);

function rascunhoSemPermissaoDeContinuar(inscricao: MinhaInscricaoDto): boolean {
  return (
    inscricao.situacao.codigo === SituacaoInscricaoCodigo.RASCUNHO && !inscricao.acoes.podeContinuar
  );
}

/** O motivo que a API informa para as inscrições estarem fechadas; a tela não o deduz de outro campo. */
function codigoDoMotivo(inscricao: MinhaInscricaoDto): string {
  return inscricao.motivoDasInscricoesFechadas?.codigo ?? '';
}

function ficouSemEnvio(inscricao: MinhaInscricaoDto): boolean {
  return (
    rascunhoSemPermissaoDeContinuar(inscricao) &&
    codigoDoMotivo(inscricao) === MotivoDasInscricoesFechadasCodigo.PERIODO_ENCERRADO
  );
}

function mensagemDoRascunhoSemContinuar(inscricao: MinhaInscricaoDto): string {
  return MENSAGEM_POR_MOTIVO.get(codigoDoMotivo(inscricao)) ?? MENSAGEM_SEM_MOTIVO_CONHECIDO;
}

function mensagemDoCancelamento(inscricao: MinhaInscricaoDto): string | null {
  const quando = formatarDataBr(inscricao.canceladaEm);
  const cancelada = quando ? `Cancelada em ${quando}.` : null;
  return inscricao.motivoDoCancelamento
    ? [cancelada, `Motivo: ${inscricao.motivoDoCancelamento}`].filter(Boolean).join(' ')
    : cancelada;
}

function mensagemDa(inscricao: MinhaInscricaoDto): string | null {
  if (rascunhoSemPermissaoDeContinuar(inscricao)) return mensagemDoRascunhoSemContinuar(inscricao);
  switch (inscricao.situacao.codigo) {
    case SituacaoInscricaoCodigo.ENVIADA:
      return null;
    case SituacaoInscricaoCodigo.CANCELADA:
      return mensagemDoCancelamento(inscricao);
    default:
      return MENSAGEM_PADRAO_DO_RASCUNHO;
  }
}

function cursoDaInscricao(opcao: MinhaInscricaoDto['opcoesDeCurso'][number]): CursoDaInscricao {
  return { ordem: opcao.ordem, nome: `${opcao.cursoNome} (${opcao.cursoGrau})` };
}

function situacaoDoItem(
  inscricao: MinhaInscricaoDto,
): Pick<ItemDaLista, 'situacao' | 'rotuloDaSituacao' | 'naoEnviada'> {
  const naoEnviada = ficouSemEnvio(inscricao);
  const rotuloDaSituacao = naoEnviada ? ROTULO_NAO_ENVIADA : inscricao.situacao.rotulo;
  return { situacao: inscricao.situacao, rotuloDaSituacao, naoEnviada };
}

export function itemDaLista(inscricao: MinhaInscricaoDto): ItemDaLista {
  return {
    id: inscricao.inscricaoId,
    processoId: inscricao.processoSeletivoId,
    ...situacaoDoItem(inscricao),
    nome: inscricao.nomeDoProcesso ?? 'Processo seletivo',
    numero: inscricao.numeroInscricao,
    mensagem: mensagemDa(inscricao),
    cursos: inscricao.opcoesDeCurso.map(cursoDaInscricao),
    acoes: inscricao.acoes,
    numeroDoComprovante: inscricao.numeroDoUltimoComprovante,
  };
}
