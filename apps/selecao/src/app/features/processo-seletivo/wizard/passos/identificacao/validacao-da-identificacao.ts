import type { WizardDraft } from '../../modelos/rascunho.models';
import { problemaDoIdentificadorLegivel } from '../../shared/identificador-legivel';

export interface ResultadoDaValidacao {
  readonly messages: readonly string[];
  readonly camposInvalidos: ReadonlySet<string>;
  /** `undefined` quando o identificador não foi conferido: travado, não há o que o operador mude. */
  readonly erroDoIdentificador: string | null | undefined;
}

/**
 * Confere os campos da identificação. O identificador legível só é conferido enquanto ainda se pode
 * corrigi-lo aqui: travado, a pendência de um processo publicado sem identificador é da retificação.
 */
export function validarIdentificacao(
  identificacao: WizardDraft['identificacao'],
  identificadorDeclaravel: boolean,
): ResultadoDaValidacao {
  const faltas: readonly (readonly [boolean, string, string])[] = [
    [!identificacao.nome.trim(), 'nome', 'Informe o nome do processo seletivo.'],
    [
      !identificacao.unidadeAdministradoraId,
      'unidadeAdministradoraId',
      'Selecione a unidade administradora.',
    ],
    [!identificacao.origemCandidatos, 'origemCandidatos', 'Informe a origem dos candidatos.'],
    [
      identificacao.localidade === null,
      'localidade',
      'Informe o município cujo calendário rege os prazos do processo.',
    ],
  ];
  const messages = faltas.filter(([falta]) => falta).map(([, , mensagem]) => mensagem);
  const invalidos = new Set(faltas.filter(([falta]) => falta).map(([, campo]) => campo));

  const erroDoIdentificador = identificadorDeclaravel
    ? problemaDoIdentificadorLegivel(identificacao.identificadorLegivel)
    : undefined;
  if (erroDoIdentificador) {
    messages.push(erroDoIdentificador);
    invalidos.add('identificadorLegivel');
  }

  return { messages, camposInvalidos: invalidos, erroDoIdentificador };
}
