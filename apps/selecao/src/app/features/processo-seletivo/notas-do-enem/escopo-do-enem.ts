import {
  FATO_DA_EDICAO_DO_ENEM,
  codigosPelaOrdem,
} from '../wizard/passos/classificacao/edicoes-do-enem';

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

/** A configuração congelada chega como JSON sem tipo; só o que a tela lê é conferido aqui. */
type Objeto = Readonly<Record<string, unknown>>;

function ehObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function objetosDe(valor: unknown): readonly Objeto[] {
  return Array.isArray(valor) ? valor.filter(ehObjeto) : [];
}

function ehEtapaDoEnem(etapa: Objeto): boolean {
  const tipo = etapa['tipoEtapa'];
  return ehObjeto(tipo) && tipo['notaDeOrigemNoEnem'] === true;
}

function etapaDoEnemDe(configuracao: Objeto): EtapaDoEnem | null {
  const etapa = objetosDe(configuracao['etapas']).find(ehEtapaDoEnem);
  const { id, nome } = etapa ?? {};
  return typeof id === 'string' && typeof nome === 'string' ? { id, nome } : null;
}

function valorSelecionavelDe(valor: Objeto): { codigo: string; ordem: unknown }[] {
  const codigo = valor['valorCodigo'];
  return typeof codigo === 'string' ? [{ codigo, ordem: valor['ordem'] }] : [];
}

function edicoesDaVersaoPublicada(configuracao: Objeto): readonly string[] {
  const fato = objetosDe(configuracao['dadosDosFormularios']).find(
    (f) => f['codigoDoDado'] === FATO_DA_EDICAO_DO_ENEM,
  );
  const valores = objetosDe(fato?.['valoresSelecionaveis']).flatMap(valorSelecionavelDe);
  return codigosPelaOrdem(valores, (v) => v.codigo);
}

/**
 * O escopo da versão publicada, lido da configuração congelada no snapshot vigente: é por ela que
 * a API resolve a etapa e as edições, e não pela configuração administrativa, que muda depois da
 * publicação.
 */
export function escopoDoEnem(configuracao: unknown): EscopoDoEnem {
  const etapa = ehObjeto(configuracao) ? etapaDoEnemDe(configuracao) : null;
  if (!ehObjeto(configuracao) || etapa === null) return { situacao: 'semEtapa' };

  const edicoes = edicoesDaVersaoPublicada(configuracao);
  if (edicoes.length === 0) return { situacao: 'semEdicoes' };

  return { situacao: 'pronto', etapa, edicoes };
}
