import { type EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { ProblemI18nService } from '@uniplus/shared-core/http';

const RAIZ = 'uniplus.configuracao.protecao_do_catalogo.';

interface MensagemDaRecusa {
  readonly titulo: string;
  readonly resolver: string;
}

/** As recusas da manifestação técnica e da decisão diante dela (uniplus-api#2366). */
export const MENSAGENS_DA_PROTECAO_DO_CATALOGO: Readonly<Record<string, MensagemDaRecusa>> = {
  justificativa_exigida_pela_manifestacao: {
    titulo:
      'Aprovar ou recomendar ajuste diante de manifestação desfavorável vigente exige a justificativa',
    resolver: 'Explique, na justificativa, por que decide assim diante da manifestação.',
  },
  parecer_invalido: {
    titulo: 'Parecer fora do vocabulário da manifestação',
    resolver: 'Escolha adequada, recomenda ajuste ou inadequada.',
  },
  texto_da_manifestacao_obrigatorio: {
    titulo: 'Os pareceres recomenda ajuste e inadequada exigem o texto',
    resolver: 'Explique, no texto, o que precisa mudar na proteção proposta.',
  },
  texto_da_manifestacao_muito_longo: {
    titulo: 'O texto da manifestação passa do limite de 2.000 caracteres',
    resolver: 'Resuma o texto em até 2.000 caracteres.',
  },
  ciclo_invalido: {
    titulo: 'Ciclo de aprovação ausente ou inválido',
    resolver: 'Releia o item e registre a manifestação de novo.',
  },
  ciclo_mudou: {
    titulo: 'O ciclo de aprovação do item mudou depois de lido; releia o item',
    resolver: 'Confira a proposta relida antes de se manifestar de novo.',
  },
  dado_da_decisao_nao_cabe: {
    titulo: 'A decisão traz classificação recomendada que ela não admite',
    resolver: 'Só o ajuste recomendado leva a classificação recomendada.',
  },
};

/** Registra as mensagens da proteção do catálogo no lugar do texto curto da API. */
export function provideMensagensDaProtecaoDoCatalogo(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const problemas = inject(ProblemI18nService);
    for (const [sufixo, { titulo, resolver }] of Object.entries(
      MENSAGENS_DA_PROTECAO_DO_CATALOGO,
    )) {
      problemas.register(RAIZ + sufixo, { title: titulo, detail: resolver });
    }
  });
}
