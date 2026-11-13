/*
 * Regras puras da norma que sustenta um documento exigido, a mesma no modelo de formulário e no
 * passo Fase do processo. Ficam aqui, e não no editor, porque o shared-ui não carrega regra de
 * domínio.
 */
import { ABRANGENCIA_PADRAO, STATUS_BASE_LEGAL_RESOLVIDO } from './documento-exigido.vocabulario';

/** Uma norma que sustenta a exigência. `observacao` é texto livre opcional; `null` é a ausência. */
export interface BaseLegal {
  readonly referencia: string;
  readonly abrangencia: string;
  readonly status: string;
  readonly observacao: null | string;
}

/** Uma norma em branco, no alcance e no status que são o caso comum: o edital, resolvida. */
export function baseLegalNova(): BaseLegal {
  return {
    referencia: '',
    abrangencia: ABRANGENCIA_PADRAO,
    status: STATUS_BASE_LEGAL_RESOLVIDO,
    observacao: null,
  };
}

/**
 * Se alguma das normas sustenta a exigência perante a publicação: declarada e identificada
 * como resolvida. Uma norma só com a referência, mas pendente, não basta.
 */
export function temNormaResolvida(bases: readonly BaseLegal[]): boolean {
  return bases.some(
    (base) => base.referencia.trim() !== '' && base.status === STATUS_BASE_LEGAL_RESOLVIDO,
  );
}

/** A norma como viaja: sem os espaços das pontas, e a observação em branco como ausência. */
export function baseLegalParaEnvio(base: BaseLegal): BaseLegal {
  const observacao = (base.observacao ?? '').trim();
  return {
    referencia: base.referencia.trim(),
    abrangencia: base.abrangencia,
    status: base.status,
    observacao: observacao === '' ? null : observacao,
  };
}

/** As normas que viajam: a sem referência é linha em branco do formulário, não declaração. */
export function basesLegaisParaEnvio(bases: readonly BaseLegal[]): BaseLegal[] {
  return bases.filter((base) => base.referencia.trim() !== '').map(baseLegalParaEnvio);
}
