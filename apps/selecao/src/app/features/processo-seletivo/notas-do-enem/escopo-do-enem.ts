import { FATO_DA_EDICAO_DO_ENEM, codigosPelaOrdem } from '../steps/steps/classificacao/edicoes-do-enem';

/** A etapa cuja nota vem do ENEM: o domínio admite no máximo uma por processo. */
export interface EtapaDoEnem {
  readonly id: string;
  readonly nome: string;
}

/**
 * O que a tela de notas do ENEM faz com o processo: opera sobre a etapa e as edições dele, ou
 * explica por que ainda não pode.
 */
export type EscopoDoEnem =
  | { readonly situacao: 'rascunho' }
  | { readonly situacao: 'semEtapa' }
  | { readonly situacao: 'semEdicoes' }
  | {
      readonly situacao: 'pronto';
      readonly etapa: EtapaDoEnem;
      readonly edicoes: readonly string[];
    };

/** O processo sem versão publicada: não há edital divulgado sobre o qual importar ou enviar. */
export const ESCOPO_DE_RASCUNHO: EscopoDoEnem = { situacao: 'rascunho' };

type Objeto = Readonly<Record<string, unknown>>;

function comoObjeto(valor: unknown): Objeto | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Objeto)
    : null;
}

function comoLista(valor: unknown): readonly unknown[] {
  return Array.isArray(valor) ? valor : [];
}

function etapaDoEnemDe(configuracao: Objeto): EtapaDoEnem | null {
  for (const item of comoLista(configuracao['etapas'])) {
    const etapa = comoObjeto(item);
    const tipo = comoObjeto(etapa?.['tipoEtapa']);
    if (etapa === null || tipo?.['notaDeOrigemNoEnem'] !== true) continue;
    if (typeof etapa['id'] === 'string' && typeof etapa['nome'] === 'string') {
      return { id: etapa['id'], nome: etapa['nome'] };
    }
  }
  return null;
}

function edicoesDaVersaoPublicada(configuracao: Objeto): readonly string[] {
  const fato = comoLista(configuracao['fatosColetados'])
    .map(comoObjeto)
    .find((f) => f?.['fatoCodigo'] === FATO_DA_EDICAO_DO_ENEM);

  const valores = comoLista(fato?.['valoresSelecionaveis'])
    .map(comoObjeto)
    .filter((v): v is Objeto => v !== null && typeof v['valorCodigo'] === 'string')
    .map((v) => ({ codigo: v['valorCodigo'] as string, ordem: v['ordem'] }));
  return codigosPelaOrdem(valores, (v) => v.codigo);
}

/**
 * O escopo da versão publicada, lido da configuração congelada no snapshot vigente: é por ela que
 * a API resolve a etapa e as edições, e não pela configuração administrativa, que muda durante uma
 * retificação aberta.
 */
export function escopoDoEnem(configuracao: unknown): EscopoDoEnem {
  const congelada = comoObjeto(configuracao);
  const etapa = congelada === null ? null : etapaDoEnemDe(congelada);
  if (congelada === null || etapa === null) return { situacao: 'semEtapa' };

  const edicoes = edicoesDaVersaoPublicada(congelada);
  if (edicoes.length === 0) return { situacao: 'semEdicoes' };

  return { situacao: 'pronto', etapa, edicoes };
}
