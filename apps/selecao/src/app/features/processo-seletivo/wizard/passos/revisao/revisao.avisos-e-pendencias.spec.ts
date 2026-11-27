import { ComponentFixture } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PASSOS } from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { nomeDoPasso } from './destino-das-pendencias';
import { RevisaoPassoComponent } from './revisao.component';
import {
  CONFORMIDADE_LEGAL_VERDE,
  CONFORMIDADE_VERDE,
  PROCESSO_ID,
  ROTA_CONFORMIDADE,
  ROTA_CONFORMIDADE_LEGAL,
  criarProcesso,
  flushMicrotasks,
  montarOCenario,
  prepararCamposLocais,
  CenarioDaRevisao,
} from './revisao.testing';

describe('RevisaoPassoComponent', () => {
  let cenario: CenarioDaRevisao;
  let fixture: ComponentFixture<RevisaoPassoComponent>;
  let componente: RevisaoPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    cenario = await montarOCenario();
    ({ fixture, componente, store, controller } = cenario);
  });

  afterEach(() => controller.verify());

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
      expect(PASSOS[store.passoAtual()].rotulo).toBe('Cronograma');
    });

    it('não bloqueia a publicação e o banner dos itens conformes traz a ressalva', async () => {
      const tela = await abrirComAvisos([AVISO]);

      expect(componente.validar()).toEqual({ valid: true });
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
      return PASSOS[store.passoAtual()].rotulo;
    }

    it('a pendência da resolução leva ao passo da fórmula e diz que a escolha vai com a classificação', async () => {
      await abrirComPendenciasDoEnem();

      const item = itemDaMensagem('Resolução de Pesos por Área');
      expect(item.querySelector('.revisao-item__onde')?.textContent?.trim()).toBe(
        `Escolha a resolução de Peso por Área. A escolha é gravada quando a classificação é gravada, ao avançar do passo ${nomeDoPasso('Fórmula e precisão')} ou do passo ${nomeDoPasso('Eliminação')}, ou na publicação do processo, e até lá esta pendência continua aqui.`,
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
        `A escolha é gravada quando a classificação é gravada, ao avançar do passo ${nomeDoPasso('Fórmula e precisão')} ou do passo ${nomeDoPasso('Eliminação')}`,
      );
      const daOferta = descricao('Grupo de área do ENEM congelado');
      expect(daOferta).toContain('Grupo de área do ENEM congelado em toda oferta');
      expect(daOferta).toContain(`regrave o passo ${nomeDoPasso('Vagas')}`);
      expect(descricao('Distribuição de vagas')).toBe('Distribuição de vagas');
    });
  });
});
