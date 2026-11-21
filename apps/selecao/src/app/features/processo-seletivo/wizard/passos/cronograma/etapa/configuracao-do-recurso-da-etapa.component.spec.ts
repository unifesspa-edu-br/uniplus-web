import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor, type RecusaDoProblema } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { SELECAO_BASE_PATH, UnidadePrazo } from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it } from 'vitest';

import type { RecursoDaEtapa } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicial } from '../../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../../shared/gravacao/gravacao-do-processo';
import { CATALOGOS_DO_CRONOGRAMA } from '../catalogos/catalogos-do-cronograma';
import { etapa } from '../cronograma-do-certame.testing';
import { etapaDoFormulario, grupoDaEtapa } from '../cronograma-form';
import { BASE } from '../cronograma.testing';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';
import { ReleituraDasEtapas } from '../servicos/releitura-das-etapas.service';
import { RecusasDoServidorNasEtapas } from '../servicos/recusas-do-servidor-nas-etapas.service';
import { RecusasDoServidorNasFases } from '../servicos/recusas-do-servidor-nas-fases.service';
import { UnidadesResponsaveisDasFases } from '../servicos/unidades-responsaveis-das-fases.service';
import { ConfiguracaoDoRecursoDaEtapaComponent } from './configuracao-do-recurso-da-etapa.component';

const RECURSO: RecursoDaEtapa = {
  ancora: 'cienciaIndividual',
  regraCodigo: 'PRAZO',
  regraVersao: 'v1',
  prazoValor: '2',
  prazoUnidade: UnidadePrazo.diasUteis,
  atoAncoraCodigo: '',
  suspensividadePrimeiraInstanciaValor: '',
  suspensividadePrimeiraInstanciaUnidade: '',
  admiteInstanciaSuperior: true,
  suspensividadeSegundaInstanciaValor: '',
  suspensividadeSegundaInstanciaUnidade: '',
  procedimentos: [],
};

describe('ConfiguracaoDoRecursoDaEtapaComponent', () => {
  let fixture: ComponentFixture<ConfiguracaoDoRecursoDaEtapaComponent>;
  let grupo: ReturnType<typeof grupoDaEtapa>;

  beforeEach(async () => {
    grupo = grupoDaEtapa(etapa({ recursos: [RECURSO] }));
    await TestBed.configureTestingModule({
      imports: [ConfiguracaoDoRecursoDaEtapaComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicial,
        GravacaoDoProcesso,
        ...CATALOGOS_DO_CRONOGRAMA,
        UnidadesResponsaveisDasFases,
        ReleituraDasEtapas,
        FormularioDoCronograma,
        RecusasDoServidorNasEtapas,
        RecusasDoServidorNasFases,
        EdicaoDaEtapa,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfiguracaoDoRecursoDaEtapaComponent);
    fixture.componentRef.setInput('grupo', grupo);
    fixture.componentRef.setInput('indiceDaEtapa', 0);
    fixture.componentRef.setInput('recursoDaEtapa', RECURSO);
    fixture.componentRef.setInput('indiceDoRecurso', 0);
    fixture.detectChanges();
  });

  const seletor = (id: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(`#${id}`);

  const entrada = (id: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`#${id}`);

  const unidadesDe = (id: string): string[] =>
    Array.from(seletor(id)?.options ?? []).map((opcao) => opcao.value);

  it('o prazo de interposição oferece dias úteis e horas, sem dias corridos', () => {
    expect(unidadesDe('cr-rec-un-0-0')).toEqual(['', UnidadePrazo.diasUteis, UnidadePrazo.horas]);
  });

  it.each(['cr-rec-susp1-un-0-0', 'cr-rec-susp2-un-0-0'])(
    'a suspensividade de %s oferece sem suspensividade, dias úteis, dias corridos e horas',
    (id) => {
      expect(unidadesDe(id)).toEqual([
        '',
        UnidadePrazo.diasUteis,
        UnidadePrazo.dias,
        UnidadePrazo.horas,
      ]);
      expect(unidadesDe(id)).not.toContain(UnidadePrazo.nenhuma);
    },
  );

  it('nomeia a opção de dias corridos em português', () => {
    const rotulos = Array.from(seletor('cr-rec-susp1-un-0-0')?.options ?? []).map((o) =>
      (o.textContent ?? '').trim(),
    );

    expect(rotulos).toEqual(['Sem suspensividade', 'dias úteis', 'dias corridos', 'horas']);
  });

  it('guarda no rascunho os dias corridos escolhidos na primeira instância', () => {
    const campo = seletor('cr-rec-susp1-un-0-0') as HTMLSelectElement;

    campo.value = UnidadePrazo.dias;
    campo.dispatchEvent(new Event('change'));

    expect(grupo.controls.recursos.value[0]?.suspensividadePrimeiraInstanciaUnidade).toBe(
      UnidadePrazo.dias,
    );
  });

  it('guarda no rascunho os dias corridos escolhidos na segunda instância', () => {
    const campo = seletor('cr-rec-susp2-un-0-0') as HTMLSelectElement;

    campo.value = UnidadePrazo.dias;
    campo.dispatchEvent(new Event('change'));

    expect(grupo.controls.recursos.value[0]?.suspensividadeSegundaInstanciaUnidade).toBe(
      UnidadePrazo.dias,
    );
  });

  it('desenha o prazo de interposição e as duas suspensividades como grupos com legenda', () => {
    const legendas = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('sel-prazo-do-recurso legend'),
    ).map((legenda) => legenda.textContent?.trim());

    expect(legendas).toEqual([
      'Prazo de interposição (obrigatório)',
      'Suspensividade da 1ª instância',
      'Suspensividade da 2ª instância',
    ]);
  });

  it('descreve os dois campos de cada suspensividade pela ajuda, e o prazo de interposição sem ela', () => {
    const descritoPor = (id: string) => seletor(id)?.getAttribute('aria-describedby');

    expect(descritoPor('cr-rec-prazo-0-0')).toBeNull();
    for (const id of ['susp1-val', 'susp1-un', 'susp2-val', 'susp2-un']) {
      expect(descritoPor(`cr-rec-${id}-0-0`)).toBe('cr-rec-susp-ajuda-0-0');
    }
  });

  it('leva ao rascunho do recurso o valor digitado no prazo de interposição', () => {
    const campo = entrada('cr-rec-prazo-0-0') as HTMLInputElement;

    campo.value = '48';
    campo.dispatchEvent(new Event('input'));

    expect(grupo.controls.recursos.value[0]?.prazoValor).toBe('48');
  });

  it('leva ao rascunho do recurso a unidade escolhida no prazo de interposição', () => {
    const campo = seletor('cr-rec-un-0-0') as HTMLSelectElement;

    campo.value = UnidadePrazo.horas;
    campo.dispatchEvent(new Event('change'));

    expect(grupo.controls.recursos.value[0]?.prazoUnidade).toBe(UnidadePrazo.horas);
  });

  it('mantém à vista e marcados os dias corridos já gravados no prazo de interposição', () => {
    fixture.componentRef.setInput('recursoDaEtapa', {
      ...RECURSO,
      prazoUnidade: UnidadePrazo.dias,
    });
    fixture.detectChanges();

    expect(seletor('cr-rec-un-0-0')?.value).toBe(UnidadePrazo.dias);
    expect(unidadesDe('cr-rec-un-0-0')).toEqual([
      '',
      UnidadePrazo.diasUteis,
      UnidadePrazo.horas,
      UnidadePrazo.dias,
    ]);
  });

  it('lista os procedimentos declarados, nomeando o item contestado pelo rótulo da etapa', () => {
    grupo.controls.itensDeAvaliacao.setValue([
      { id: 'item-1', rotulo: 'Clareza', pontuacaoMaxima: '4' },
    ]);
    fixture.componentRef.setInput('recursoDaEtapa', {
      ...RECURSO,
      procedimentos: [
        {
          tipoDeDecisao: 'NOTA_DA_ETAPA',
          alvo: { itemDeAvaliacaoId: 'item-1' },
          regraCodigo: 'PROCEDIMENTO-RECURSO-COLEGIADO',
          regraVersao: 'v1',
          sugestao: 'PROCEDIMENTO-RECURSO-MONOCRATICO',
        },
      ],
    });
    fixture.detectChanges();

    const lista = (fixture.nativeElement as HTMLElement).querySelector(
      'sel-procedimentos-do-recurso',
    );
    expect(lista?.classList.contains('form-grid__full')).toBe(true);
    expect(lista?.textContent).toContain('Nota da etapa');
    expect(lista?.textContent).toContain('Clareza');
    expect(lista?.textContent).toContain('Sugestão: PROCEDIMENTO-RECURSO-MONOCRATICO');
  });

  describe('recusas do servidor ao controle de onde o prazo corre', () => {
    const ANCORA = 'cr-rec-anc-0-0';
    const BLOCO = 'cr-rec-recusa-origemDoPrazo-0-0';

    const recusar = (campo: string): void => {
      const recusa: RecusaDoProblema = {
        campo,
        codigo: 'uniplus.selecao.codigo_a',
        mensagem: 'Origem do prazo recusada.',
        pagina: null,
        ordem: 0,
      };
      TestBed.inject(FormularioDoCronograma).etapas.push(grupo);
      TestBed.inject(RecusasDoServidorNasEtapas).registrar(
        1,
        { grupos: [grupo], etapasNoFormulario: [etapaDoFormulario(grupo)] },
        [recusa],
        () => true,
      );
      fixture.detectChanges();
    };

    const atributo = (id: string, nome: string) => seletor(id)?.getAttribute(nome) ?? null;

    it('sem recusa, não marca o controle como inválido nem o liga a mensagem alguma', () => {
      expect(atributo(ANCORA, 'aria-invalid')).toBeNull();
      expect(atributo(ANCORA, 'aria-describedby')).toBeNull();
    });

    it('com recusa que ainda vale, marca o controle como inválido e o liga ao bloco dela', () => {
      recusar('etapas[0].recursos[0].ancora');

      expect(atributo(ANCORA, 'aria-invalid')).toBe('true');
      expect(atributo(ANCORA, 'aria-describedby')).toBe(BLOCO);
      expect(
        (fixture.nativeElement as HTMLElement).querySelector(`#${BLOCO}`)?.textContent,
      ).toContain('Origem do prazo recusada.');
    });

    it('com recusa a conferir de novo, mantém a mensagem ligada mas desmarca o controle', () => {
      recusar('etapas[0].recursos[0].ancora');

      const campo = seletor(ANCORA) as HTMLSelectElement;
      campo.value = 'atoPublicado';
      campo.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(atributo(ANCORA, 'aria-invalid')).toBeNull();
      expect(atributo(ANCORA, 'aria-describedby')).toBe(BLOCO);
    });

    it('não marca o controle de onde o prazo corre pela recusa a outro controle do recurso', () => {
      recusar('etapas[0].recursos[0].prazoValor');

      expect(atributo(ANCORA, 'aria-invalid')).toBeNull();
      expect(atributo(ANCORA, 'aria-describedby')).toBeNull();
      expect(atributo('cr-rec-prazo-0-0', 'aria-invalid')).toBe('true');
    });
  });
});
