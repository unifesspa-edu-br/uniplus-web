import type { WizardDraft } from '../../modelos/rascunho.models';
import { problemaDoIdentificadorLegivel } from '../../shared/identificador-legivel';

export interface ResultadoDaValidacao {
  readonly messages: readonly string[];
  readonly camposInvalidos: ReadonlySet<string>;
  /** `undefined` quando o identificador não foi conferido: travado, não há o que o operador mude. */
  readonly erroDoIdentificador: string | null | undefined;
}

type Identificacao = WizardDraft['identificacao'];

interface CampoObrigatorio {
  readonly campo: string;
  readonly mensagem: string;
  readonly ausente: (identificacao: Identificacao) => boolean;
}

const CAMPOS_OBRIGATORIOS: readonly CampoObrigatorio[] = [
  {
    campo: 'nome',
    mensagem: 'Informe o nome do processo seletivo.',
    ausente: (identificacao) => !identificacao.nome.trim(),
  },
  {
    campo: 'unidadeAdministradoraId',
    mensagem: 'Selecione a unidade administradora.',
    ausente: (identificacao) => !identificacao.unidadeAdministradoraId,
  },
  {
    campo: 'origemCandidatos',
    mensagem: 'Informe a origem dos candidatos.',
    ausente: (identificacao) => !identificacao.origemCandidatos,
  },
  {
    campo: 'localidade',
    mensagem: 'Informe o município cujo calendário rege os prazos do processo.',
    ausente: (identificacao) => identificacao.localidade === null,
  },
];

/**
 * Confere os campos da identificação. O identificador legível só é conferido enquanto ainda se pode
 * corrigi-lo aqui: travado, a pendência de um processo publicado sem identificador é da retificação.
 */
export function validarIdentificacao(
  identificacao: Identificacao,
  identificadorDeclaravel: boolean,
): ResultadoDaValidacao {
  const faltas = CAMPOS_OBRIGATORIOS.filter((regra) => regra.ausente(identificacao));
  const erro = identificadorDeclaravel
    ? problemaDoIdentificadorLegivel(identificacao.identificadorLegivel)
    : undefined;
  return resultadoDaValidacao(faltas, erro);
}

function resultadoDaValidacao(
  faltas: readonly CampoObrigatorio[],
  erroDoIdentificador: string | null | undefined,
): ResultadoDaValidacao {
  const mensagemDoIdentificador = erroDoIdentificador ? [erroDoIdentificador] : [];
  const campoDoIdentificador = erroDoIdentificador ? ['identificadorLegivel'] : [];
  return {
    messages: [...faltas.map((regra) => regra.mensagem), ...mensagemDoIdentificador],
    camposInvalidos: new Set([...faltas.map((regra) => regra.campo), ...campoDoIdentificador]),
    erroDoIdentificador,
  };
}
