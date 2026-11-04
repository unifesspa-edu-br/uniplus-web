import { todosOsCampos } from '@uniplus/shared-ui/components';
import type {
  ExigenciasDoRascunho,
  FormularioDeInscricao,
  WizardDraft,
} from '../../processo-seletivo.models';
import { formulariosDoRascunho, nomeDaFinalidade } from './formularios-por-finalidade';
import { fatosCitadosPelasExigencias } from './fatos-coletados-da-inscricao';
import { FATO_DA_IDADE } from './apuracao-da-idade';

/**
 * O que impede gravar o formulário.
 *
 * A exigência da política temporal é do gate de publicação, e é espelhada aqui porque descobrir
 * no último passo que falta uma data obriga a refazer o caminho inteiro.
 */
export function problemasDoFormulario(
  formulario: FormularioDeInscricao,
  exigencias: ExigenciasDoRascunho,
  fasesVivas: ReadonlySet<string>,
): readonly string[] {
  const problemas: string[] = [];

  for (const { finalidade, conteudo } of formulariosDoRascunho(formulario)) {
    if (todosOsCampos(conteudo).some((campo) => campo.rotulo.trim() === '')) {
      problemas.push(
        `Todo campo do formulário de ${nomeDaFinalidade(finalidade)} precisa do rótulo que o candidato vai ler.`,
      );
    }
  }

  const referencia = formulario.referenciaTemporal;
  const citaIdade = fatosCitadosPelasExigencias(exigencias).has(FATO_DA_IDADE);

  if (citaIdade && referencia.tipo === '') {
    problemas.push(
      'Há documento exigido por faixa etária. Declare contra que instante a idade do candidato é apurada — sem isso a publicação é recusada.',
    );
  }

  if (referencia.tipo === 'DATA_ESPECIFICA' && referencia.data === '') {
    problemas.push('A apuração por data específica precisa da data.');
  }

  if (
    (referencia.tipo === 'INICIO_FASE' || referencia.tipo === 'FIM_FASE') &&
    !fasesVivas.has(referencia.faseCodigo)
  ) {
    problemas.push(
      'A apuração da idade aponta uma fase que não está no cronograma. Escolha outra fase, ou apure por data específica.',
    );
  }

  return problemas;
}

/**
 * Os fatos cujo domínio não é vocabulário fechado do catálogo: os valores que o candidato pode
 * escolher saem do que ESTE processo oferta em atendimento especializado. O tipo de deficiência
 * não está aqui: ele oferece os tipos do cadastro em qualquer processo, com ou sem oferta
 * (UNI-REQ-0012).
 */
const FATOS_COM_DOMINIO_NA_OFERTA = [
  { codigo: 'CONDICAO_ATENDIMENTO', rotulo: 'a condição de atendimento', lista: 'condicoes' },
  { codigo: 'RECURSO_ACESSIBILIDADE', rotulo: 'o recurso de acessibilidade', lista: 'recursos' },
] as const;

/**
 * Campos que o formulário pergunta e para os quais a oferta não declara valor nenhum a escolher.
 *
 * O acoplamento é real e a publicação o cobra: um campo de seleção sobre esse fato com
 * oferta vazia é pendência estrutural. Dizê-lo no passo que acrescenta o campo, e no da oferta,
 * evita ao operador descobrir na revisão com o caminho inteiro a refazer.
 */
export function camposSemValoresOfertados(
  formulario: FormularioDeInscricao,
  atendimento: WizardDraft['atendimento'],
): readonly string[] {
  // Todo formulário do processo conta: o campo na isenção ou na habilitação esbarra na mesma oferta vazia.
  const perguntados = new Set(
    formulariosDoRascunho(formulario)
      .flatMap((outro) => todosOsCampos(outro.conteudo))
      .filter((campo) => campo.tipoRenderizacao.startsWith('SELECAO'))
      .map((campo) => campo.fatoCodigo),
  );

  return FATOS_COM_DOMINIO_NA_OFERTA.filter(
    (fato) => perguntados.has(fato.codigo) && atendimento[fato.lista].length === 0,
  ).map((fato) => fato.rotulo);
}
