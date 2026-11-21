import { InjectionToken, inject, type Provider } from '@angular/core';
import { TiposBancaApi, type PapelDaBanca } from './tipos-banca.api';
import { TiposDeDecisaoApi, type TipoDeDecisao } from './tipos-de-decisao.api';
import { criarVocabulario, type Vocabulario } from './vocabulario';

/**
 * Os tipos de decisão da Seleção, como a API os publica. Sem instância de reserva na aplicação:
 * a tela que o usa o fornece no `providers` do próprio componente, e a leitura termina com ela.
 */
export const VOCABULARIO_DE_TIPOS_DE_DECISAO = new InjectionToken<Vocabulario<TipoDeDecisao>>(
  'VOCABULARIO_DE_TIPOS_DE_DECISAO',
);

/** Os papéis de banca, como a API os publica; fornecido como `VOCABULARIO_DE_TIPOS_DE_DECISAO`. */
export const VOCABULARIO_DE_PAPEIS_DE_BANCA = new InjectionToken<Vocabulario<PapelDaBanca>>(
  'VOCABULARIO_DE_PAPEIS_DE_BANCA',
);

/** Para o `providers` do componente da tela: nunca de rota, que não é destruída ao sair. */
export function fornecerVocabularioDeTiposDeDecisao(): Provider {
  return {
    provide: VOCABULARIO_DE_TIPOS_DE_DECISAO,
    useFactory: () => {
      const api = inject(TiposDeDecisaoApi);
      return criarVocabulario(() => api.listar(), 'Não foi possível carregar os tipos de decisão.');
    },
  };
}

/** Para o `providers` do componente da tela: nunca de rota, que não é destruída ao sair. */
export function fornecerVocabularioDePapeisDeBanca(): Provider {
  return {
    provide: VOCABULARIO_DE_PAPEIS_DE_BANCA,
    useFactory: () => {
      const api = inject(TiposBancaApi);
      return criarVocabulario(
        () => api.listarPapeis(),
        'Não foi possível carregar os papéis de banca.',
      );
    },
  };
}
