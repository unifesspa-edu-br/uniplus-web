import { type EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { ProblemI18nService } from '@uniplus/shared-core/http';

/**
 * As recusas da leitura da configuração publicada do processo. A requisição do candidato está certa:
 * é o sistema que não lê o próprio dado, e o texto da API descreve o defeito para quem o corrige.
 */
export const FALHAS_DA_PUBLICACAO: readonly string[] = [
  'uniplus.selecao.envelope_codec.versao_desconhecida',
  'uniplus.selecao.envelope_codec.versao_nao_reidratavel',
  'uniplus.selecao.envelope_codec.algoritmo_nao_suportado',
  'uniplus.selecao.envelope_codec.integridade_violada',
  'uniplus.selecao.envelope_codec.envelope_malformado',
  'uniplus.selecao.envelope_codec.envelope_incoerente_com_a_versao',
  'uniplus.selecao.envelope_codec.blocos_derivados_incoerentes',
  'uniplus.selecao.envelope_codec.regra_desconhecida',
  'uniplus.selecao.envelope_codec.round_trip_divergente',
];

export const MENSAGEM_DA_FALHA_DA_PUBLICACAO =
  'O formulário deste processo seletivo está indisponível por um problema do sistema, não da sua ' +
  'inscrição. Tente de novo mais tarde; se o problema continuar, procure a comissão responsável ' +
  'pelo processo seletivo.';

/** Registra as mensagens que o portal dá ao candidato no lugar do texto da API. */
export function provideMensagensDoCandidato(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const problemas = inject(ProblemI18nService);
    // Cada tela lê o título ou o detalhe; os dois levam a mesma mensagem.
    for (const codigo of FALHAS_DA_PUBLICACAO) {
      problemas.register(codigo, {
        title: MENSAGEM_DA_FALHA_DA_PUBLICACAO,
        detail: MENSAGEM_DA_FALHA_DA_PUBLICACAO,
      });
    }
  });
}
