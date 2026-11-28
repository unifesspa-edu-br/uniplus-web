import axe from 'axe-core';
import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CenaDaPagina,
  faseAvaliacaoSeed,
  montarPagina,
  propagar,
  responderLista,
  verificarRequisicoesDaPagina,
} from './fases-canonicas.testing';
import { problema } from './fases-canonicas.escritas.testing';

const SEM_AGRUPAR: FaseCanonicaDto = {
  ...faseAvaliacaoSeed,
  agrupaEtapas: false,
  admiteAgruparEtapas: false,
};
const ISENCAO: FaseCanonicaDto = {
  ...SEM_AGRUPAR,
  codigo: 'SOLICITACAO_ISENCAO',
  coletaSolicitacaoIsencao: true,
};

const CAMPOS_OCULTOS = [
  { api: 'AgrupaEtapas', controle: 'agrupaEtapas', grupo: 'cfg-fase-grupo-agrupa' },
  {
    api: 'PermiteComplementacao',
    controle: 'permiteComplementacao',
    grupo: 'cfg-fase-grupo-compl',
  },
  { api: 'ColetaInscricao', controle: 'coletaInscricao', grupo: 'cfg-fase-grupo-coleta-inscricao' },
] as const;

/** O jsdom não calcula geometria: sem estes retornos o axe desiste das regras de rótulo e de ARIA. */
function simularGeometriaDoDocumento(): () => void {
  const { elementFromPoint, elementsFromPoint } = document;
  document.elementFromPoint = () => null;
  document.elementsFromPoint = () => [];
  return () => {
    document.elementFromPoint = elementFromPoint;
    document.elementsFromPoint = elementsFromPoint;
  };
}

const recusaDe = (campo: string, mensagem: string) =>
  problema(422, {
    code: 'uniplus.validacao',
    errors: [
      { field: campo, code: 'uniplus.configuracao.fase_canonica.invalido', message: mensagem },
    ],
  });

describe('FasesCanonicasPage — recusa da API em campo normalmente oculto', () => {
  let cena: CenaDaPagina;
  let restaurarDocumento: () => void;

  beforeEach(() => {
    restaurarDocumento = simularGeometriaDoDocumento();
    cena = montarPagina();
  });
  afterEach(() => {
    restaurarDocumento();
    verificarRequisicoesDaPagina(cena);
  });

  const raiz = (): HTMLElement => cena.fixture.nativeElement;
  const campo = (controle: string): HTMLSelectElement | null =>
    raiz().querySelector(`[formcontrolname="${controle}"]`);
  const atualizar = async (): Promise<void> => {
    await propagar(cena);
    cena.fixture.detectChanges();
    await cena.fixture.whenStable();
    cena.fixture.detectChanges();
  };
  const abrir = async (fase: FaseCanonicaDto): Promise<void> => {
    await responderLista(cena, [fase]);
    cena.edicao.abrirEdicao(fase);
    await atualizar();
  };
  const enviar = async (resposta?: ReturnType<typeof problema>): Promise<void> => {
    cena.edicao.salvar();
    cena.fixture.detectChanges();
    const put = cena.controller.expectOne((r) => r.method === 'PUT');
    if (resposta) put.flush(...resposta);
    else put.flush(null, { status: 204, statusText: 'No Content' });
    await atualizar();
  };
  const descricaoDe = (controle: HTMLElement): string =>
    (controle.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');
  const oculto = (elemento: Element | null): boolean =>
    elemento === null || elemento.closest('[hidden]') !== null;

  it.each(CAMPOS_OCULTOS)(
    'mostra a recusa de $controle junto do campo, ligada ao campo inválido',
    async ({ api, controle }) => {
      await abrir(ISENCAO);
      await enviar(recusaDe(api, 'Mensagem da API.'));

      const select = campo(controle);
      expect(select, controle).not.toBeNull();
      expect(oculto(select)).toBe(false);
      expect(select?.getAttribute('aria-invalid')).toBe('true');
      expect(descricaoDe(select as HTMLElement)).toContain('Mensagem da API.');
    },
  );

  it.each(CAMPOS_OCULTOS)(
    'o grupo de $controle aparece sozinho quando há recusa',
    async ({ api, grupo }) => {
      await abrir(ISENCAO);
      expect(oculto(raiz().querySelector(`#${grupo}`))).toBe(true);
      await enviar(recusaDe(api, 'Mensagem da API.'));

      expect(oculto(raiz().querySelector(`#${grupo}`))).toBe(false);
    },
  );

  it('sem recusa, os grupos ficam ocultos e os campos fora do foco do teclado', async () => {
    await abrir(ISENCAO);

    for (const { controle } of CAMPOS_OCULTOS) {
      const select = campo(controle);
      expect(oculto(select) || select === null, controle).toBe(true);
    }
  });

  it('o reenvio descarta a recusa anterior e mostra a nova', async () => {
    await abrir(SEM_AGRUPAR);
    await enviar(recusaDe('AgrupaEtapas', 'Primeira recusa.'));
    expect(raiz().textContent).toContain('Primeira recusa.');

    await enviar(recusaDe('AgrupaEtapas', 'Segunda recusa.'));

    expect(raiz().textContent).not.toContain('Primeira recusa.');
    expect(descricaoDe(campo('agrupaEtapas') as HTMLElement)).toContain('Segunda recusa.');
  });

  it('ao reenviar, o grupo volta a ficar oculto até a nova resposta', async () => {
    await abrir(SEM_AGRUPAR);
    await enviar(recusaDe('AgrupaEtapas', 'Primeira recusa.'));

    cena.edicao.salvar();
    await atualizar();
    expect(oculto(raiz().querySelector('#cfg-fase-grupo-agrupa'))).toBe(true);
    cena.controller
      .expectOne((r) => r.method === 'PUT')
      .flush(...recusaDe('Nome', 'Nome recusado.'));
    await atualizar();
  });

  it('a recusa em campo sempre visível continua aparecendo', async () => {
    await abrir(SEM_AGRUPAR);
    await enviar(recusaDe('Nome', 'Nome recusado.'));

    expect(descricaoDe(campo('nome') as HTMLElement)).toContain('Nome recusado.');
  });

  it('o formulário com a recusa de um campo antes oculto não tem violação de acessibilidade', async () => {
    await abrir(ISENCAO);
    await enviar(recusaDe('AgrupaEtapas', 'Mensagem da API.'));

    const resultado = await axe.run(
      raiz().querySelector('#cfg-fase-canonica-form') as HTMLElement,
      {
        rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
      },
    );

    expect(resultado.violations.map((violacao) => violacao.id)).toEqual([]);
    expect(resultado.passes.map((regra) => regra.id)).toContain('label');
  });
});
