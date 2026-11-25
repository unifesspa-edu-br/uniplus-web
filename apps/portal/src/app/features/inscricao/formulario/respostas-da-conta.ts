import type { FormularioApresentadoDoProcessoDto } from '@uniplus/shared-data/selecao';
import { isValidCpf } from '@uniplus/shared-data/utils';
import type { RespostaFixa, ValorJson } from '@uniplus/shared-ui/components';
import { cpfRevelavel, mascararCpf } from '@uniplus/shared-utils';

/** O que a conta do candidato traz e a inscrição usa; o CPF vem só com dígitos ou formatado. */
export interface ContaDoCandidato {
  readonly cpf: string;
  readonly nomeCivil?: string;
  readonly nomeSocial?: string;
}

/** Se o formulário coleta o fato. */
function coletaO(formulario: FormularioApresentadoDoProcessoDto, fato: string): boolean {
  return formulario.formulario.coleta.itens.some((c) => c.fatoCodigo === fato);
}

function nomeSocialDaConta(conta: ContaDoCandidato | null): string {
  return conta?.nomeSocial?.trim() ?? '';
}

function nomeCivilFixo(conta: ContaDoCandidato | null): RespostaFixa | null {
  const nome = conta?.nomeCivil?.trim() ?? '';
  return nome === '' ? null : { valor: nome, exibicao: nome };
}

function nomeSocialFixo(conta: ContaDoCandidato | null): RespostaFixa {
  const social = nomeSocialDaConta(conta);
  return social === '' ? { valor: null, exibicao: '' } : { valor: social, exibicao: social };
}

function cpfFixo(conta: ContaDoCandidato | null): RespostaFixa | null {
  const cpf = conta?.cpf.replace(/\D/g, '') ?? '';
  return isValidCpf(cpf)
    ? { valor: cpf, exibicao: mascararCpf(cpf), revelavel: cpfRevelavel(cpf) }
    : null;
}

/**
 * O nome civil, o nome social e o CPF vêm da conta e não se alteram aqui. Quem muda o nome social é
 * o titular, em Meu perfil; sem nome social na conta o campo fica vazio e travado, e a resposta vai
 * como nula para não manter um nome gravado que a conta não tem. Só o CPF aparece mascarado, e o
 * titular o revela a partir do próprio login.
 */
function respostasDaConta(conta: ContaDoCandidato | null): Record<string, RespostaFixa | null> {
  return { NOME: nomeCivilFixo(conta), NOME_SOCIAL: nomeSocialFixo(conta), CPF: cpfFixo(conta) };
}

/** As respostas da conta entram no formulário que coleta o fato. */
export function respostasFixasDaConta(
  conta: ContaDoCandidato | null,
  formulario: FormularioApresentadoDoProcessoDto | null,
): Readonly<Record<string, RespostaFixa>> {
  if (formulario === null) return {};
  return Object.fromEntries(
    Object.entries(respostasDaConta(conta)).flatMap<[string, RespostaFixa]>(([fato, resposta]) =>
      resposta !== null && coletaO(formulario, fato) ? [[fato, resposta]] : [],
    ),
  );
}

/**
 * A conta com nome social já abre o "deseja usar nome social?" como sim, mas a escolha continua do
 * candidato: o que já está gravado prevalece, inclusive a desistência de usá-lo.
 */
export function respostasIniciaisDoNomeSocial(
  conta: ContaDoCandidato | null,
  gravadas: Readonly<Record<string, ValorJson>>,
  formulario: FormularioApresentadoDoProcessoDto,
): Record<string, ValorJson> {
  const jaEscolhido = 'DESEJA_NOME_SOCIAL' in gravadas;
  if (
    nomeSocialDaConta(conta) === '' ||
    !coletaO(formulario, 'DESEJA_NOME_SOCIAL') ||
    jaEscolhido
  ) {
    return {};
  }
  return { DESEJA_NOME_SOCIAL: true };
}
