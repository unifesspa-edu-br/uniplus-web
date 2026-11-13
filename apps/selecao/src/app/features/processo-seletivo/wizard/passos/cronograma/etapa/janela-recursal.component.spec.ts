import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
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
import { grupoDaEtapa } from '../cronograma-form';
import { BASE } from '../cronograma.testing';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';
import { ReleituraDasEtapas } from '../servicos/releitura-das-etapas.service';
import { UnidadesResponsaveisDasFases } from '../servicos/unidades-responsaveis-das-fases.service';
import { JanelaRecursalComponent } from './janela-recursal.component';

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
};

describe('JanelaRecursalComponent', () => {
  let fixture: ComponentFixture<JanelaRecursalComponent>;
  let grupo: ReturnType<typeof grupoDaEtapa>;

  beforeEach(async () => {
    grupo = grupoDaEtapa(etapa({ recursos: [RECURSO] }));
    await TestBed.configureTestingModule({
      imports: [JanelaRecursalComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicial,
        GravacaoDoProcesso,
        ...CATALOGOS_DO_CRONOGRAMA,
        UnidadesResponsaveisDasFases,
        ReleituraDasEtapas,
        FormularioDoCronograma,
        EdicaoDaEtapa,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(JanelaRecursalComponent);
    fixture.componentRef.setInput('grupo', grupo);
    fixture.componentRef.setInput('indiceDaEtapa', 0);
    fixture.componentRef.setInput('recursoDaEtapa', RECURSO);
    fixture.componentRef.setInput('indiceDoRecurso', 0);
    fixture.detectChanges();
  });

  const seletor = (id: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(`#${id}`);

  const unidadesDe = (id: string): string[] =>
    Array.from(seletor(id)?.options ?? []).map((opcao) => opcao.value);

  it('o prazo de interposição oferece dias úteis e horas, sem dias corridos', () => {
    expect(unidadesDe('cr-rec-un-0-0')).toEqual([UnidadePrazo.diasUteis, UnidadePrazo.horas]);
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
});
