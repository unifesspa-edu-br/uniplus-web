import { DecidirProtecaoDoCatalogoRequestDecisao } from '@uniplus/shared-data/configuracao';
import { laudo, pendencia, rg, type Pagina } from './tipos-documento.testing';

export const DETALHE = 'dialog[aria-label="Detalhe do tipo de documento"]';

function leituraDoDetalhe(pagina: () => Pagina) {
  const texto = (): string =>
    (pagina().fixture.nativeElement.textContent as string).replace(/\s+/gu, ' ');
  const painel = (): string =>
    (pagina().fixture.nativeElement.querySelector(DETALHE)?.textContent ?? '').replace(
      /\s+/gu,
      ' ',
    );
  const rodape = (): string[] =>
    [
      ...pagina().fixture.nativeElement.querySelectorAll(`${DETALHE} .form-drawer__footer button`),
    ].map((b: HTMLElement) => b.textContent?.trim() ?? '');
  return { texto, painel, rodape };
}

export function apoioDaProtecao(pagina: () => Pagina) {
  const botao = (
    rotulo: string,
    onde = '.panel-head__actions button, .form-drawer__footer button',
  ) =>
    [...pagina().fixture.nativeElement.querySelectorAll(onde)].find((b: HTMLElement) =>
      b.textContent?.includes(rotulo),
    ) as HTMLButtonElement | undefined;
  const abrirDetalhe = async (tipo = rg): Promise<void> => {
    pagina().nomeDaLinha(tipo).click();
    await pagina().propagar();
  };

  return { ...leituraDoDetalhe(pagina), botao, abrirDetalhe, ajuste };
}

const ajuste = (tipo = laudo) =>
  pendencia(tipo, {
    situacao: DecidirProtecaoDoCatalogoRequestDecisao.AJUSTE_RECOMENDADO,
    classificacaoRecomendada: 'SENSIVEL',
  });
