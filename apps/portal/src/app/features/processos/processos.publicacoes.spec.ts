import type { CertameNaVitrineDto } from '@uniplus/shared-data/selecao';
import { passarOTempo } from '@uniplus/shared-testing';
import type { Observable } from 'rxjs';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicacoesDoCertame } from '../publicacoes/publicacoes.model';
import type {
  CertameParaPublicacoes,
  PublicacoesPorCertame,
} from '../publicacoes/publicacoes.repository';
import {
  ACERVO,
  CERTAMES_URL,
  CHEGADA_DAS_PUBLICACOES_MS,
  CenarioDaVitrine,
  contadoresHeaders,
  encerrado,
  publicacoesDe,
  publicacoesImediatas,
  semDocumento,
  sisu,
  tecnicoEnfermagem,
} from './processos.testing';

describe('ProcessosComponent — publicações do edital', () => {
  let cenario: CenarioDaVitrine;

  afterEach(() => cenario.encerrar());

  const textoDosItens = (seletor: string): string[] =>
    Array.from(cenario.host().querySelectorAll(seletor)).map((item) => item.textContent ?? '');

  async function carregarComPublicacoes(itens: readonly CertameNaVitrineDto[]): Promise<void> {
    await cenario.responderLista(itens, contadoresHeaders);
    await passarOTempo(CHEGADA_DAS_PUBLICACOES_MS);
    cenario.fixture.detectChanges();
  }

  describe('itens sem a seção "Documentos exigidos"', () => {
    beforeEach(() => {
      cenario = new CenarioDaVitrine();
    });

    it('nem a lista nem os cards oferecem a seção em nenhum item', async () => {
      await cenario.responderLista([sisu, tecnicoEnfermagem], contadoresHeaders);
      cenario.fixture.detectChanges();
      const itensDaLista = textoDosItens('.edital-row');
      expect(itensDaLista).toHaveLength(2);
      itensDaLista.forEach((texto) => expect(texto).not.toContain('Documentos exigidos'));

      cenario.visao().escolher('cards');
      cenario.fixture.detectChanges();
      const cards = textoDosItens('.certames-grid .card');
      expect(cards).toHaveLength(2);
      cards.forEach((texto) => expect(texto).not.toContain('Documentos exigidos'));
    });

    it('abrir os acionadores dos itens não lê o certame publicado de cada um', async () => {
      const certames = [sisu, tecnicoEnfermagem];
      await cenario.responderLista(certames, contadoresHeaders);
      cenario.fixture.detectChanges();

      const acionadores = cenario.host().querySelectorAll<HTMLButtonElement>('.edital-row button');
      expect(acionadores.length).toBeGreaterThan(0);
      acionadores.forEach((acionador) => acionador.click());
      await cenario.propagar();

      certames.forEach((certame) =>
        cenario.controller.expectNone(`${CERTAMES_URL}/${certame.processoSeletivoId}`),
      );
    });
  });

  describe('accordion e link do edital', () => {
    beforeEach(() => {
      cenario = new CenarioDaVitrine();
    });

    it('cada item da lista traz o accordion "Ver publicações", fechado', async () => {
      await cenario.responderLista([sisu, tecnicoEnfermagem], contadoresHeaders);
      cenario.fixture.detectChanges();

      const toggles = cenario.host().querySelectorAll<HTMLButtonElement>('.publicacoes-toggle');
      expect(toggles).toHaveLength(2);
      toggles.forEach((toggle) => {
        expect(toggle.textContent).toContain('Ver publicações');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
      });
    });

    it('a visão em cards também traz o accordion em cada card', async () => {
      await cenario.responderLista([sisu, tecnicoEnfermagem], contadoresHeaders);
      cenario.visao().escolher('cards');
      cenario.fixture.detectChanges();

      expect(cenario.host().querySelectorAll('.card .publicacoes-toggle')).toHaveLength(2);
    });

    it('todo certame ganha o link "Ver edital" para o PDF no acervo, só depois que as publicações chegam', async () => {
      await cenario.responderLista([sisu, encerrado], contadoresHeaders);
      expect(cenario.host().querySelector('.certame-edital-link')).toBeNull();

      await passarOTempo(CHEGADA_DAS_PUBLICACOES_MS);
      cenario.fixture.detectChanges();

      const links = cenario.host().querySelectorAll<HTMLAnchorElement>('.certame-edital-link');
      expect(links).toHaveLength(2);
      expect(links[0].textContent).toContain('Ver edital');
      expect(links[0].getAttribute('href')).toBe(`${ACERVO}/${sisu.processoSeletivoId}.pdf`);
      expect(links[0].target).toBe('_blank');
    });

    it('abrir o accordion mostra a linha do tempo do próprio edital, não a de outro', async () => {
      await carregarComPublicacoes([sisu, tecnicoEnfermagem]);

      cenario.host().querySelector<HTMLButtonElement>('.publicacoes-toggle')?.click();
      cenario.fixture.detectChanges();

      const linha = cenario.host().querySelector('.edital-row');
      expect(linha?.querySelector('.publicacao-timeline')).toBeTruthy();
      expect(linha?.textContent).toContain(`Edital de abertura de ${sisu.identificadorLegivel}`);
      expect(linha?.textContent).not.toContain(tecnicoEnfermagem.identificadorLegivel);
      // O segundo item continua fechado, sem linha do tempo no DOM.
      expect(cenario.host().querySelectorAll('.publicacao-timeline')).toHaveLength(1);
    });

    it('o botão de inscrição leva à inscrição no certame', async () => {
      await cenario.responderLista([sisu], contadoresHeaders);
      cenario.fixture.detectChanges();

      const cta = Array.from(
        cenario.host().querySelectorAll<HTMLAnchorElement>('.edital-row a.btn'),
      ).find((a) => a.textContent?.includes('Inscrever-me'));
      expect(cta?.getAttribute('href')).toBe(`/inscricao/${sisu.processoSeletivoId}`);
      expect(cta?.textContent).toContain(sisu.nome);
    });

    it('o certame que não recebe mais inscrição não oferece o botão', async () => {
      await cenario.responderLista([encerrado], contadoresHeaders);
      cenario.fixture.detectChanges();

      expect(cenario.host().querySelector('.edital-row')?.textContent).not.toContain(
        'Inscrever-me',
      );
    });
  });

  describe('certame sem documento de edital de abertura', () => {
    // Ato sem PDF e sem edital vigente no acervo: não há o que abrir.
    const publicacaoSemDocumento: PublicacoesDoCertame = {
      publicacoes: [
        {
          id: 'ato-abertura',
          data: '2026-01-05',
          titulo: 'Edital de abertura',
          tipo: 'Edital de abertura',
          documentos: { anexos: [] },
        },
      ],
    };

    const botaoTentarNovamente = (): HTMLButtonElement | undefined =>
      Array.from(cenario.host().querySelectorAll<HTMLButtonElement>('button')).find(
        (elemento) => elemento.textContent?.trim() === 'Tentar novamente',
      );

    it('não mostra o link "Ver edital" quando a publicação não tem documento de abertura', async () => {
      cenario = new CenarioDaVitrine(
        publicacoesImediatas(new Map([[semDocumento.processoSeletivoId, publicacaoSemDocumento]])),
      );

      await cenario.responderLista([semDocumento]);
      cenario.fixture.detectChanges();

      expect(cenario.host().querySelector('.publicacoes-toggle')).toBeTruthy();
      expect(cenario.host().querySelector('.certame-edital-link')).toBeNull();
    });

    it('o certame cuja consulta das publicações falhou mostra o erro no accordion, sem "Ver edital"', async () => {
      cenario = new CenarioDaVitrine(
        publicacoesImediatas(new Map([[semDocumento.processoSeletivoId, null]])),
      );
      await cenario.responderLista([semDocumento]);
      cenario.fixture.detectChanges();

      cenario.host().querySelector<HTMLButtonElement>('.publicacoes-toggle')?.click();
      cenario.fixture.detectChanges();

      expect(cenario.host().querySelector('.alert--danger')?.textContent).toContain(
        'Não foi possível carregar as publicações',
      );
      expect(cenario.host().querySelector('.certame-edital-link')).toBeNull();
    });

    it('"Tentar novamente" nas publicações lê de novo e mostra a linha do tempo do certame', async () => {
      const retorno = new Subject<PublicacoesPorCertame>();
      const falhou = new Map([[semDocumento.processoSeletivoId, null]]);
      // A primeira leitura é a da vitrine ainda vazia; as seguintes, a do certame e a nova tentativa.
      const buscar = vi
        .fn<(certames: readonly CertameParaPublicacoes[]) => Observable<PublicacoesPorCertame>>()
        .mockReturnValueOnce(of(new Map()))
        .mockReturnValueOnce(of(falhou))
        .mockReturnValueOnce(retorno);
      cenario = new CenarioDaVitrine({ buscarPorCertames: buscar });
      await cenario.responderLista([semDocumento]);
      cenario.fixture.detectChanges();
      cenario.host().querySelector<HTMLButtonElement>('.publicacoes-toggle')?.click();
      cenario.fixture.detectChanges();

      botaoTentarNovamente()?.click();
      await cenario.propagar();
      cenario.fixture.detectChanges();

      expect(buscar).toHaveBeenCalledTimes(3);
      expect(cenario.host().querySelector('.publicacoes-loading')).not.toBeNull();
      expect(cenario.host().querySelector('ui-situacao-da-nova-tentativa')?.textContent).toBe(
        'Tentando novamente…',
      );

      retorno.next(new Map([[semDocumento.processoSeletivoId, publicacoesDe(semDocumento)]]));
      await cenario.propagar();
      cenario.fixture.detectChanges();

      expect(cenario.host().querySelector('.publicacao-timeline')).not.toBeNull();
      expect(cenario.host().querySelector('.certame-edital-link')).not.toBeNull();
    });

    it('a nova tentativa de um certame não tira a linha do tempo nem o edital de outro já carregado', async () => {
      const retorno = new Subject<PublicacoesPorCertame>();
      const buscar = vi
        .fn<(certames: readonly CertameParaPublicacoes[]) => Observable<PublicacoesPorCertame>>()
        .mockReturnValueOnce(of(new Map()))
        .mockImplementationOnce((certames) =>
          of(
            new Map(
              certames.map((certame) => [
                certame.processoSeletivoId,
                certame.processoSeletivoId === sisu.processoSeletivoId
                  ? null
                  : publicacoesDe(certame),
              ]),
            ),
          ),
        )
        .mockReturnValueOnce(retorno);
      cenario = new CenarioDaVitrine({ buscarPorCertames: buscar });
      await cenario.responderLista([sisu, tecnicoEnfermagem]);
      cenario.fixture.detectChanges();
      cenario
        .host()
        .querySelectorAll<HTMLButtonElement>('.publicacoes-toggle')
        .forEach((toggle) => toggle.click());
      cenario.fixture.detectChanges();
      const linksAntes = cenario.host().querySelectorAll('.certame-edital-link').length;

      botaoTentarNovamente()?.click();
      await cenario.propagar();
      cenario.fixture.detectChanges();

      expect(buscar.mock.calls.at(-1)?.[0].map((certame) => certame.processoSeletivoId)).toEqual([
        sisu.processoSeletivoId,
      ]);
      expect(cenario.host().querySelectorAll('.publicacoes-loading')).toHaveLength(1);
      expect(cenario.host().querySelectorAll('.certame-edital-link')).toHaveLength(linksAntes);
      expect(linksAntes).toBeGreaterThan(0);
    });
  });
});
