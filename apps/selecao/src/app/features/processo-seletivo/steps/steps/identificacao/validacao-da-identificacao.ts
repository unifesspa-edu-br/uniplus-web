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
  const messages: string[] = [];
  const invalidos = new Set<string>();

  if (!identificacao.nome.trim()) {
    messages.push('Informe o nome do processo seletivo.');
    invalidos.add('nome');
  }
  if (!identificacao.unidadeAdministradoraId) {
    messages.push('Selecione a unidade administradora.');
    invalidos.add('unidadeAdministradoraId');
  }
  if (!identificacao.origemCandidatos) {
    messages.push('Informe a origem dos candidatos.');
    invalidos.add('origemCandidatos');
  }
  if (identificacao.localidade === null) {
    messages.push('Informe o município cujo calendário rege os prazos do processo.');
    invalidos.add('localidade');
  }

  let erroDoIdentificador: string | null | undefined;
  if (identificadorDeclaravel) {
    erroDoIdentificador = problemaDoIdentificadorLegivel(identificacao.identificadorLegivel);
    if (erroDoIdentificador !== null) {
      messages.push(erroDoIdentificador);
      invalidos.add('identificadorLegivel');
    }
  }

  return { messages, camposInvalidos: invalidos, erroDoIdentificador };
}
