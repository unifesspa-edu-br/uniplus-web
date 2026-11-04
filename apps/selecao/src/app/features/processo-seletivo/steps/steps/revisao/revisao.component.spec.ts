import { ComponentFixture } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { apiOk, errorResult, mockProblemDetails } from '@uniplus/shared-core/http';
import { StatusProcesso, type DocumentoDoAtoDto } from '@uniplus/shared-data/selecao';
import { FaseDoCronograma } from '../../processo-seletivo.models';
import { PASSOS } from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import {
  baseLegalNova,
  comExigencia,
  exigenciaNova,
  folhaDe,
} from '../../shared/exigencias/exigencias-documentais';
import { nomeDoPasso } from './destino-das-pendencias';
import { RevisaoStepComponent } from './revisao.component';
import {
  ATO_DO_PROCESSO,
  ATO_PUBLICADO,
  CONFORMIDADE_LEGAL_VERDE,
  CONFORMIDADE_VERDE,
  DOCUMENTO_ID,
  PROCESSO_DTO_MINIMO,
  PROCESSO_ID,
  ROTA_ATOS,
  ROTA_CONFORMIDADE,
  ROTA_CONFORMIDADE_LEGAL,
  ROTA_DETALHE,
  ROTA_PUBLICACAO,
  ROTA_SNAPSHOT,
  SNAPSHOT_DTO,
  criarProcesso,
  flushMicrotasks,
  flushProntidaoVerde,
  montarOCenario,
  prepararCamposLocais,
  CenarioDaRevisao,
} from './revisao.testing';

describe('RevisaoStepComponent', () => {
  let cenario: CenarioDaRevisao;
  let fixture: ComponentFixture<RevisaoStepComponent>;
  let componente: RevisaoStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    cenario = await montarOCenario();
    ({ fixture, componente, store, controller } = cenario);
  });

  afterEach(() => controller.verify());

  it('em consulta, não orienta a anexar o edital nem a concluir a identificação', async () => {
    store.remoteSnapshot.set(PROCESSO_DTO_MINIMO as never);
    store.currentStep.set(store.totalSteps - 1);
    await flushMicrotasks();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(store.emConsulta()).toBe(true);
    expect(texto).not.toContain('Anexe e confirme o edital');
    expect(texto).not.toContain('Conclua a identificação');
  });

  it('sem a permissão de publicar, não orienta a anexar o edital que a pessoa não vê', async () => {
    cenario.negadas.set(['selecao:processos:publicar']);
    await flushMicrotasks();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain('Anexe e confirme o edital');
  });

  it('com a permissão de publicar, orienta a anexar o edital', async () => {
    await flushMicrotasks();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Anexe e confirme o edital');
  });

  describe('documentos exigidos', () => {
    const FASE = (codigo: string) => ({ codigo }) as FaseDoCronograma;
    const documento = (obrigatorio: boolean, comNorma: boolean) => ({
      ...exigenciaNova('01960000-0000-7000-0000-0000000000d1', 'INSCRICAO'),
      obrigatorio,
      basesLegais: [{ ...baseLegalNova(), referencia: comNorma ? 'Lei 12.711/2012' : '' }],
    });

    async function abrirRevisao(): Promise<string> {
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).textContent ?? '';
    }

    it('resume os documentos por fase e diz que a base legal está resolvida', async () => {
      store.patchSection('cronograma', { ...store.draft().cronograma, fases: [FASE('INSCRICAO')] });
      store.patchSection(
        'documentos',
        comExigencia({ raizes: [], emTodasAsFases: [] }, documento(true, true)),
      );

      const texto = await abrirRevisao();

      expect(texto).toContain('Fase INSCRICAO: 1 obrigatório, 0 facultativos.');
      expect(texto).toContain('Base legal resolvida');
    });

    it('materializa na fase acrescentada depois o documento exigido em todas as fases', async () => {
      store.patchSection('cronograma', {
        ...store.draft().cronograma,
        fases: [FASE('INSCRICAO'), FASE('NOVA')],
      });
      store.patchSection('documentos', {
        ...comExigencia({ raizes: [], emTodasAsFases: [] }, documento(true, true)),
        emTodasAsFases: ['01960000-0000-7000-0000-0000000000d1'],
      });

      expect(await abrirRevisao()).toContain('Fase NOVA: 1 obrigatório');
    });

    it('não diz que a fase dispensa base legal quando o grupo decisivo tem norma resolvida', async () => {
      store.patchSection('cronograma', { ...store.draft().cronograma, fases: [FASE('INSCRICAO')] });
      const facultativo = (tipo: string) =>
        folhaDe({ ...documento(false, true), tipoDocumentoId: tipo });
      store.patchSection('documentos', {
        emTodasAsFases: [],
        raizes: [
          {
            ...folhaDe(documento(false, true)),
            tipo: 'OU',
            documento: null,
            consequencia: 'INDEFERIMENTO',
            basesLegais: [baseLegalNova()].map((base) => ({ ...base, referencia: 'Edital' })),
            filhos: [facultativo('a'), facultativo('b')],
          },
        ],
      });

      const texto = await abrirRevisao();

      expect(texto).toContain('Base legal resolvida');
      expect(texto).not.toContain('Sem exigência de base legal');
    });

    it('acusa a fase cujo grupo de alternativas decide o resultado sem norma resolvida', async () => {
      store.patchSection('cronograma', { ...store.draft().cronograma, fases: [FASE('INSCRICAO')] });
      const facultativo = (tipo: string) =>
        folhaDe({ ...documento(false, true), tipoDocumentoId: tipo });
      store.patchSection('documentos', {
        emTodasAsFases: [],
        raizes: [
          {
            ...folhaDe(documento(false, true)),
            tipo: 'OU',
            documento: null,
            consequencia: 'INDEFERIMENTO',
            basesLegais: [],
            filhos: [facultativo('a'), facultativo('b')],
          },
        ],
      });

      expect(await abrirRevisao()).toContain('Base legal pendente em 1 exigência');
    });

    it('acusa a fase cuja exigência a publicação recusaria por falta de norma', async () => {
      store.patchSection('cronograma', { ...store.draft().cronograma, fases: [FASE('INSCRICAO')] });
      store.patchSection(
        'documentos',
        comExigencia({ raizes: [], emTodasAsFases: [] }, documento(true, false)),
      );

      expect(await abrirRevisao()).toContain('Base legal pendente em 1 exigência');
    });
  });

  describe('rotuloDeAvanco()', () => {
    it('diz "Publicar processo"', () => {
      expect(componente.rotuloDeAvanco()).toBe('Publicar processo');
    });
  });

  describe('confirmacaoDeGravacao()', () => {
    it('null enquanto inválido', () => {
      expect(componente.confirmacaoDeGravacao()).toBeNull();
    });

    it('resume os dados do ato quando válido', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

      const confirmacao = componente.confirmacaoDeGravacao();
      expect(confirmacao).not.toBeNull();
      expect(confirmacao?.itens.some((item) => item.valor.includes('Portaria'))).toBe(true);
    });
  });

  describe('avisos de conformidade', () => {
    const AVISO = {
      codigo: 'cronograma_tipo_definitivo_em_mais_de_um_lugar',
      dimensao: 'cronograma',
      mensagem:
        'O mesmo tipo de ato definitivo foi declarado em mais de uma fase. Confirme que o edital quer isso.',
    };

    async function abrirComAvisos(avisos: readonly unknown[]): Promise<HTMLElement> {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      controller.expectOne(ROTA_CONFORMIDADE).flush({ ...CONFORMIDADE_VERDE, avisos });
      controller
        .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
        .flush(CONFORMIDADE_LEGAL_VERDE);
      await flushMicrotasks();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('mostra o aviso numa região própria, com título, fora do checklist de pendências', async () => {
      const tela = await abrirComAvisos([AVISO]);

      const regiao = tela.querySelector('section[aria-labelledby="revisao-avisos-titulo"]');
      expect(regiao?.querySelector('h2')?.textContent?.trim()).toBe('Avisos para conferir');
      expect(regiao?.textContent).toContain(AVISO.mensagem);
      expect(regiao?.textContent).toContain('não impedem a publicação');
      expect(tela.querySelector('.revisao-list')?.textContent).not.toContain(AVISO.mensagem);
    });

    it('oferece o atalho para o passo da dimensão do aviso', async () => {
      const tela = await abrirComAvisos([AVISO]);

      const botao = tela.querySelector<HTMLButtonElement>(
        '[aria-labelledby="revisao-avisos-titulo"] .revisao-item__ir',
      );
      expect(botao?.textContent?.trim()).toBe(`Ir para ${nomeDoPasso('Cronograma')}`);
      botao?.click();
      expect(PASSOS[store.currentStep()].rotulo).toBe('Cronograma');
    });

    it('não bloqueia a publicação e o banner dos itens conformes traz a ressalva', async () => {
      const tela = await abrirComAvisos([AVISO]);

      expect(componente.validate()).toEqual({ valid: true });
      expect(tela.textContent).toContain('Há avisos abaixo, que não impedem a publicação');
    });

    it('sem aviso, nada aparece e o banner segue sem ressalva', async () => {
      const tela = await abrirComAvisos([]);

      expect(tela.querySelector('#revisao-avisos-titulo')).toBeNull();
      expect(tela.textContent).toContain('Nenhuma pendência estrutural.');
      expect(tela.textContent).not.toContain('avisos abaixo');
    });
  });

  describe('pendências do processo ENEM', () => {
    const OFERTA_A = '01960000-0000-7000-0000-00000000aaa1';
    const OFERTA_B = '01960000-0000-7000-0000-00000000aaa2';

    async function abrirComPendenciasDoEnem(): Promise<void> {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      controller.expectOne(ROTA_CONFORMIDADE).flush({
        processoSeletivoId: PROCESSO_ID,
        avisos: [],
        itens: [
          {
            codigo: 'distribuicao_vagas_ausente',
            dimensao: 'distribuicao_vagas',
            mensagem: 'Distribuição de vagas',
            ok: false,
          },
          {
            codigo: 'classificacao_resolucao_peso_area_enem_ausente',
            dimensao: 'classificacao',
            mensagem:
              'Resolução de Pesos por Área com quadro congelado (classificação baseada em ENEM com cálculo local)',
            ok: false,
          },
          {
            codigo: 'distribuicao_vagas_oferta_sem_grupo_area_enem',
            dimensao: 'distribuicao_vagas',
            mensagem: `Grupo de área do ENEM congelado em toda oferta (ofertas: ${OFERTA_A}; ${OFERTA_B})`,
            ok: false,
          },
          {
            codigo: 'classificacao_grupo_area_enem_da_oferta_fora_do_quadro',
            dimensao: 'classificacao',
            mensagem: `Grupo de área do ENEM de cada oferta presente no quadro de pesos por área (ofertas: ${OFERTA_A} (grupo SAUDE_E_BIOLOGICAS — Saúde e Biológicas); ${OFERTA_B} (grupo TECNOLOGICA))`,
            ok: false,
          },
        ],
      });
      controller
        .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
        .flush(CONFORMIDADE_LEGAL_VERDE);
      await flushMicrotasks();
      fixture.detectChanges();
    }

    function itemDaMensagem(trecho: string): HTMLElement {
      const itens = Array.from(
        fixture.nativeElement.querySelectorAll('.revisao-item') as NodeListOf<HTMLElement>,
      );
      const item = itens.find((elemento) => elemento.textContent?.includes(trecho));
      if (item === undefined) throw new Error(`item "${trecho}" não renderizado`);
      return item;
    }

    function rotuloDoPassoAtual(): string {
      return PASSOS[store.currentStep()].rotulo;
    }

    it('a pendência da resolução leva ao passo da fórmula e diz que a escolha vai com a classificação', async () => {
      await abrirComPendenciasDoEnem();

      const item = itemDaMensagem('Resolução de Pesos por Área');
      expect(item.querySelector('.revisao-item__onde')?.textContent?.trim()).toBe(
        `Escolha a resolução de Peso por Área. A escolha é gravada quando a classificação é gravada, no passo ${nomeDoPasso('Eliminação')}, ou na publicação do processo, e até lá esta pendência continua aqui.`,
      );

      const botao = item.querySelector<HTMLButtonElement>('.revisao-item__ir');
      expect(botao?.textContent?.trim()).toBe(`Ir para ${nomeDoPasso('Fórmula e precisão')}`);
      botao?.click();
      expect(rotuloDoPassoAtual()).toBe('Fórmula e precisão');
    });

    it('a pendência do grupo fora do quadro lista as ofertas com o grupo e diz as duas metades da correção', async () => {
      await abrirComPendenciasDoEnem();

      const item = itemDaMensagem('presente no quadro de pesos por área');
      expect(item.querySelector('.revisao-item__name')?.textContent).toContain(
        `${OFERTA_A} (grupo SAUDE_E_BIOLOGICAS — Saúde e Biológicas); ${OFERTA_B} (grupo TECNOLOGICA)`,
      );
      const orientacao = item.querySelector('.revisao-item__onde')?.textContent ?? '';
      expect(orientacao).toContain(
        'Corrija o grupo de área do ENEM no cadastro do curso, em Configuração',
      );
      expect(orientacao).toContain(`regrave o passo ${nomeDoPasso('Vagas')}`);

      item.querySelector<HTMLButtonElement>('.revisao-item__ir')?.click();
      expect(rotuloDoPassoAtual()).toBe('Vagas');
    });

    it('a pendência da oferta sem grupo explica o cadastro de cursos e a regravação de Vagas', async () => {
      await abrirComPendenciasDoEnem();

      const item = itemDaMensagem('Grupo de área do ENEM congelado');
      expect(item.querySelector('.revisao-item__name')?.textContent).toContain(
        `${OFERTA_A}; ${OFERTA_B}`,
      );
      const orientacao = item.querySelector('.revisao-item__onde')?.textContent ?? '';
      expect(orientacao).toContain('cadastro do curso, em Configuração');
      expect(orientacao).toContain(`regrave o passo ${nomeDoPasso('Vagas')}`);

      item.querySelector<HTMLButtonElement>('.revisao-item__ir')?.click();
      expect(rotuloDoPassoAtual()).toBe('Vagas');
    });

    /** Dois itens podem levar ao mesmo passo: o botão é descrito pela pendência que resolve. */
    it('descreve cada botão pela mensagem do item e pela orientação', async () => {
      await abrirComPendenciasDoEnem();

      const descricao = (trecho: string): string => {
        const botao = itemDaMensagem(trecho).querySelector('.revisao-item__ir');
        return (botao?.getAttribute('aria-describedby') ?? '')
          .split(' ')
          .map(
            (id) => fixture.nativeElement.querySelector(`[id="${id}"]`)?.textContent?.trim() ?? '',
          )
          .join(' ');
      };

      const daResolucao = descricao('Resolução de Pesos por Área');
      expect(daResolucao).toContain('Resolução de Pesos por Área com quadro congelado');
      expect(daResolucao).toContain(
        `A escolha é gravada quando a classificação é gravada, no passo ${nomeDoPasso('Eliminação')}`,
      );
      const daOferta = descricao('Grupo de área do ENEM congelado');
      expect(daOferta).toContain('Grupo de área do ENEM congelado em toda oferta');
      expect(daOferta).toContain(`regrave o passo ${nomeDoPasso('Vagas')}`);
      expect(descricao('Distribuição de vagas')).toBe('Distribuição de vagas');
    });
  });

  describe('processo já publicado', () => {
    async function abrirPublicado(): Promise<void> {
      store.remoteSnapshot.set(PROCESSO_DTO_MINIMO as never);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);
    }

    function texto(): string {
      return (fixture.nativeElement as HTMLElement).textContent ?? '';
    }

    /** Responde a consulta dos atos do processo, de onde vêm os anexos que a versão publicou. */
    async function responderAtos(anexos: readonly DocumentoDoAtoDto[] = []): Promise<void> {
      controller
        .expectOne(ROTA_ATOS)
        .flush([{ ...ATO_DO_PROCESSO, id: SNAPSHOT_DTO.atoId, anexos }]);
      await flushMicrotasks();
      fixture.detectChanges();
    }

    it('lê o ato vigente pelo snapshot e o mostra como texto, sem o formulário', async () => {
      await abrirPublicado();
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await flushMicrotasks();
      fixture.detectChanges();

      expect(cenario.atosLidos).toEqual([SNAPSHOT_DTO.atoId]);
      await responderAtos();
      const lista = (fixture.nativeElement as HTMLElement).querySelector(
        'dl[aria-label="Ato publicado"]',
      );
      expect(lista?.textContent).toContain('001/2026');
      expect(lista?.textContent).toContain('Portaria');
      expect(lista?.textContent).toContain('25/09/2026');
      expect(lista?.textContent).toContain('Reitor da Unifesspa');
      expect((fixture.nativeElement as HTMLElement).querySelector('#rev-numero')).toBeNull();
    });

    it('mostra a falha da leitura com "Tentar novamente", que lê de novo', async () => {
      cenario.respostaDoAto = of(errorResult(mockProblemDetails({ status: 503 })));
      await abrirPublicado();
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await flushMicrotasks();
      fixture.detectChanges();

      expect(texto()).toContain('Não foi possível ler o ato publicado');

      cenario.respostaDoAto = of(apiOk(ATO_PUBLICADO, 200, new HttpHeaders()));
      const botoes = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
      const botao = botoes.find((item) => item.textContent?.includes('Tentar novamente'));
      botao?.click();
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await flushMicrotasks();
      fixture.detectChanges();

      expect(texto()).toContain('Reitor da Unifesspa');
      expect(cenario.atosLidos).toHaveLength(2);
      await responderAtos();
    });

    it('mostra para leitura os anexos que o ato da versão vigente publicou', async () => {
      await abrirPublicado();
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await flushMicrotasks();
      fixture.detectChanges();
      await responderAtos([
        {
          documentoAPublicarId: DOCUMENTO_ID,
          nomeArquivo: 'cronograma.pdf',
          nomeDeExibicao: 'Cronograma detalhado.pdf',
          tipoDeMidia: 'application/pdf',
          hashSha256: 'a'.repeat(64),
        },
      ]);

      const bloco = (fixture.nativeElement as HTMLElement).querySelector('sel-anexos-do-edital');
      expect(bloco?.textContent).toContain('Cronograma detalhado.pdf');
      expect(bloco?.querySelector('input')).toBeNull();
    });

    it('depois de publicar nesta sessão, lê o ato pelo snapshot já relido', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(null, { status: 204, statusText: 'No Content' });
      await flushMicrotasks();
      controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await gravacao;
      await flushMicrotasks();
      fixture.detectChanges();
      await flushMicrotasks();

      controller.expectNone(ROTA_SNAPSHOT);
      expect(cenario.atosLidos).toEqual([SNAPSHOT_DTO.atoId]);
      await responderAtos();
    });

    // Cancelado e encerrado não dizem se houve publicação: um rascunho cancelado não tem
    // snapshot vigente, e a transcrição que ele guarda precisa continuar na tela.
    it.each([StatusProcesso.rascunho, StatusProcesso.cancelado, StatusProcesso.encerrado])(
      'em %s não lê ato nenhum e mantém a transcrição',
      async (status) => {
        store.remoteSnapshot.set({ ...PROCESSO_DTO_MINIMO, status } as never);
        await criarProcesso(cenario);
        await flushProntidaoVerde(cenario);
        fixture.detectChanges();

        controller.expectNone(ROTA_SNAPSHOT);
        expect(cenario.atosLidos).toEqual([]);
        const tela = fixture.nativeElement as HTMLElement;
        // Rascunho a edita; cancelado e encerrado a leem como texto, sem campo.
        expect(tela.querySelector('#rev-numero') !== null).toBe(status === StatusProcesso.rascunho);
        if (status !== StatusProcesso.rascunho) {
          expect(tela.textContent).toContain('Número do ato');
        }
      },
    );
  });

  it('nomeia as seções da conferência como regiões pelo título de cada uma', async () => {
    await criarProcesso(cenario);
    await flushProntidaoVerde(cenario);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    for (const [id, titulo] of [
      ['revisao-estrutural-titulo', 'Checklist estrutural'],
      ['revisao-legal-titulo', 'Conformidade legal'],
      ['revisao-documento-titulo', 'Documento e ato de publicação'],
    ]) {
      const regiao = raiz.querySelector(`[role="region"][aria-labelledby="${id}"]`);
      expect(regiao, id).not.toBeNull();
      expect(regiao?.querySelector(`#${id}`)?.textContent?.trim()).toBe(titulo);
    }
  });
});
