import { HttpContext } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { okResult } from '@uniplus/shared-core/http';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import { PublicacaoDoProcessoApi } from '@uniplus/shared-data/selecao';
import { BehaviorSubject, from, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PROCESSO_ID,
  OUTRO_ID,
  MONTAGEM_LENTA,
  detalhe,
  rascunhoGuardado,
  montar,
  propagar,
} from './processo-seletivo.retomada.testing';

describe(
  'ProcessoSeletivoPage — gravação e descarte do rascunho da publicação',
  MONTAGEM_LENTA,
  () => {
    beforeEach(() => TestBed.resetTestingModule());

    /**
     * A página é reusada entre processos, e sair daqui só pede confirmação: dá para confirmar
     * com a gravação em voo e abrir outro processo antes de a resposta chegar. Sem carimbo de
     * vez, essa resposta escreveria o documento e o horário do processo anterior sobre o novo.
     */
    it('a gravação que responde depois da troca de processo não escreve sobre o novo', async () => {
      const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
        get: () => PROCESSO_ID,
      });
      const cenario = montar({
        id: PROCESSO_ID,
        obter: vi.fn((id: string) => of(okResult(detalhe({ id })))),
        obterRascunho: rascunhoGuardado({ ato: { orgao: 'REITORIA' } }),
        paramMap,
      });
      await propagar();

      let concluir: (resposta: unknown) => void = () => undefined;
      const api = TestBed.inject(PublicacaoDoProcessoApi) as unknown as Record<string, unknown>;
      api['salvarRascunhoDaPublicacao'] = vi.fn(() =>
        from(new Promise((resolve) => (concluir = resolve))),
      );

      const pagina = cenario.componente as unknown as {
        salvarRascunhoDaPublicacao(): Promise<void>;
      };
      const gravacao = pagina.salvarRascunhoDaPublicacao();

      // O operador confirma a saída e abre outro processo com a gravação ainda pendente.
      paramMap.next({ get: () => OUTRO_ID });
      await propagar();
      await propagar();
      expect(cenario.store.processoSeletivoId()).toBe(OUTRO_ID);

      concluir(okResult(undefined));
      await gravacao;
      await propagar();

      expect(cenario.componente.rascunhoSalvoEm()).toBe('2026-09-14T14:32:00Z');
      expect(cenario.componente.salvandoRascunho()).toBe(false);
    });

    /**
     * O formulário da Revisão segue editável enquanto o descarte não responde. Esvaziar o bloco
     * sem olhar apagaria a transcrição que o operador começou nesse intervalo — ele pediu para
     * descartar o que havia, não o que escreveu depois.
     */
    it('não apaga a transcrição começada enquanto o descarte estava em voo', async () => {
      const cenario = montar({ obterRascunho: rascunhoGuardado({ ato: { orgao: 'REITORIA' } }) });
      await propagar();

      let concluir: (resposta: unknown) => void = () => undefined;
      const api = TestBed.inject(PublicacaoDoProcessoApi) as unknown as Record<string, unknown>;
      api['descartarRascunhoDaPublicacao'] = vi.fn(() =>
        from(new Promise((resolve) => (concluir = resolve))),
      );

      const pagina = cenario.componente as unknown as {
        descartarRascunhoDaPublicacao(): Promise<void>;
      };
      const descarte = pagina.descartarRascunhoDaPublicacao();

      // O operador começa outra transcrição antes de a resposta chegar.
      cenario.store.projetarSecao('publicacao', { numero: '09/2027' });

      concluir(okResult(undefined));
      await descarte;
      await propagar();

      expect(cenario.store.draft().publicacao.numero).toBe('09/2027');
    });

    /** Sem edição no intervalo, descartar continua esvaziando o bloco — é o que a ação promete. */
    it('esvazia o bloco quando nada foi digitado durante o descarte', async () => {
      const cenario = montar({ obterRascunho: rascunhoGuardado({ ato: { orgao: 'REITORIA' } }) });
      await propagar();

      const api = TestBed.inject(PublicacaoDoProcessoApi) as unknown as Record<string, unknown>;
      api['descartarRascunhoDaPublicacao'] = vi.fn(() => of(okResult(undefined)));

      await (
        cenario.componente as unknown as { descartarRascunhoDaPublicacao(): Promise<void> }
      ).descartarRascunhoDaPublicacao();

      expect(cenario.store.draft().publicacao.ato.orgao).toBe('');
    });

    /**
     * O documento guardado não inclui o anexo ainda em envio. Zerar o bloco por inteiro o tiraria da
     * lista com o envio em curso, e o documento selado sumiria da tela sem aviso.
     */
    it('mantém o anexo em envio e tira os confirmados ao descartar o rascunho', async () => {
      const cenario = montar({ obterRascunho: rascunhoGuardado({ ato: { orgao: 'REITORIA' } }) });
      await propagar();

      const base = { nomeArquivo: 'a.pdf', nome: 'a', progress: 100 };
      cenario.store.projetarSecao('publicacao', {
        anexos: [
          { ...base, id: 'confirmado', fase: 'confirmado', documentoAPublicarId: 'doc-1' },
          { ...base, id: 'em-envio', fase: 'enviando', progress: 40 },
        ],
      });

      const api = TestBed.inject(PublicacaoDoProcessoApi) as unknown as Record<string, unknown>;
      api['descartarRascunhoDaPublicacao'] = vi.fn(() => of(okResult(undefined)));
      await (
        cenario.componente as unknown as { descartarRascunhoDaPublicacao(): Promise<void> }
      ).descartarRascunhoDaPublicacao();

      expect(cenario.store.draft().publicacao.anexos.map((anexo) => anexo.id)).toEqual([
        'em-envio',
      ]);
      expect(cenario.store.draft().publicacao.ato.orgao).toBe('');
    });

    /**
     * A chave acompanha o rascunho que ela gravou. Descartado ele, reescrever a mesma transcrição
     * sairia com a chave que o servidor já viu e receberia o replay da gravação que este descarte
     * acabou de anular — a tela diria "salvo" sobre um rascunho que não foi recriado.
     */
    it('não reaproveita a chave de um rascunho que foi descartado', async () => {
      const cenario = montar();
      await propagar();

      const chaves: (string | null)[] = [];
      const api = TestBed.inject(PublicacaoDoProcessoApi) as unknown as Record<string, unknown>;
      api['salvarRascunhoDaPublicacao'] = vi.fn(
        (_id: string, _corpo: unknown, contexto: HttpContext) => {
          chaves.push(contexto.get(IDEMPOTENCY_KEY_TOKEN));
          return of(okResult(undefined));
        },
      );
      api['descartarRascunhoDaPublicacao'] = vi.fn(() => of(okResult(undefined)));

      const pagina = cenario.componente as unknown as {
        salvarRascunhoDaPublicacao(): Promise<void>;
        descartarRascunhoDaPublicacao(): Promise<void>;
      };

      // O bloco INTEIRO nas duas vezes, e igual: é o caso em que a chave não gira sozinha, porque
      // ela só gira quando o corpo enviado muda.
      const transcricao = {
        numero: '07/2027',
        periodoInscricaoInicio: '',
        periodoInscricaoFim: '',
        ato: {
          orgao: 'REITORIA',
          serie: 'EDITAL',
          ano: '2027',
          dataDoAto: '2027-01-15',
          assinante: 'Reitor',
          tipoAtoCodigo: 'EDITAL_ABERTURA',
        },
      };

      cenario.store.projetarSecao('publicacao', transcricao);
      await pagina.salvarRascunhoDaPublicacao();

      await pagina.descartarRascunhoDaPublicacao();

      cenario.store.projetarSecao('publicacao', transcricao);
      await pagina.salvarRascunhoDaPublicacao();

      expect(chaves).toHaveLength(2);
      expect(chaves[1]).not.toBe(chaves[0]);
    });

    /**
     * A chave termina com a gravação que a usou. Retida, um clique posterior em "Salvar rascunho"
     * com o mesmo conteúdo repetia a gravação anterior: o servidor devolve o resultado guardado
     * em vez de gravar de novo, e o que outra aba tenha posto lá permanece — com a tela
     * anunciando que salvou.
     */
    it('não reaproveita a chave entre duas gravações do mesmo conteúdo', async () => {
      const cenario = montar();
      await propagar();

      const chaves: (string | null)[] = [];
      const api = TestBed.inject(PublicacaoDoProcessoApi) as unknown as Record<string, unknown>;
      api['salvarRascunhoDaPublicacao'] = vi.fn(
        (_id: string, _corpo: unknown, contexto: HttpContext) => {
          chaves.push(contexto.get(IDEMPOTENCY_KEY_TOKEN));
          return of(okResult(undefined));
        },
      );

      const pagina = cenario.componente as unknown as {
        salvarRascunhoDaPublicacao(): Promise<void>;
      };

      cenario.store.projetarSecao('publicacao', { numero: '07/2027' });
      await pagina.salvarRascunhoDaPublicacao();
      await pagina.salvarRascunhoDaPublicacao();

      expect(chaves).toHaveLength(2);
      expect(chaves[1]).not.toBe(chaves[0]);
    });

    /**
     * A chave de idempotência do rascunho só gira sozinha quando o corpo muda, e dois processos
     * cujo bloco do ato está em branco produzem o MESMO documento serializado. Sem renová-la na
     * troca, a gravação do processo novo sairia com a chave que o servidor já viu e receberia de
     * volta o replay do anterior — a tela diria "salvo" sobre um rascunho que ninguém gravou.
     */
    it('não reaproveita a chave do rascunho de um processo no seguinte', async () => {
      const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
        get: () => PROCESSO_ID,
      });
      const cenario = montar({
        id: PROCESSO_ID,
        obter: vi.fn((id: string) => of(okResult(detalhe({ id })))),
        paramMap,
      });
      await propagar();

      const chaves: (string | null)[] = [];
      const api = TestBed.inject(PublicacaoDoProcessoApi) as unknown as Record<string, unknown>;
      api['salvarRascunhoDaPublicacao'] = vi.fn(
        (_id: string, _corpo: unknown, contexto: HttpContext) => {
          chaves.push(contexto.get(IDEMPOTENCY_KEY_TOKEN));
          return of(okResult(undefined));
        },
      );

      const pagina = cenario.componente as unknown as {
        salvarRascunhoDaPublicacao(): Promise<void>;
      };

      cenario.store.projetarSecao('publicacao', { numero: '07/2027' });
      await pagina.salvarRascunhoDaPublicacao();

      paramMap.next({ get: () => OUTRO_ID });
      await propagar();
      await propagar();

      // Corpo idêntico ao do processo anterior: é o caso em que a chave não giraria sozinha.
      cenario.store.projetarSecao('publicacao', { numero: '07/2027' });
      await pagina.salvarRascunhoDaPublicacao();

      expect(chaves).toHaveLength(2);
      expect(chaves[1]).not.toBe(chaves[0]);
    });
  },
);
