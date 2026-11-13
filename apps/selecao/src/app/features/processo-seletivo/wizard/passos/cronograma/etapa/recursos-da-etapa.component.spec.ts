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
import { ExpansaoDoCronograma } from '../servicos/expansao-do-cronograma.service';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';
import { ReleituraDasEtapas } from '../servicos/releitura-das-etapas.service';
import { UnidadesResponsaveisDasFases } from '../servicos/unidades-responsaveis-das-fases.service';
import { RecursosDaEtapaComponent } from './recursos-da-etapa.component';

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

const TIPO_DA_NOTA_DO_ENEM = {
  origemId: 'tipo-enem',
  nome: 'Nota do ENEM',
  notaDeOrigemNoEnem: true,
};

describe('RecursosDaEtapaComponent', () => {
  let fixture: ComponentFixture<RecursosDaEtapaComponent>;
  let grupo: ReturnType<typeof grupoDaEtapa>;
  let edicao: EdicaoDaEtapa;

  async function montar(
    notaDoEnem: boolean,
    recursos: readonly RecursoDaEtapa[],
    tipoCongelado = notaDoEnem ? TIPO_DA_NOTA_DO_ENEM : null,
  ): Promise<void> {
    grupo = grupoDaEtapa(
      etapa({
        recursos: [...recursos],
        tipoEtapaOrigemId: TIPO_DA_NOTA_DO_ENEM.origemId,
        tipoCongelado,
      }),
    );
    await TestBed.configureTestingModule({
      imports: [RecursosDaEtapaComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicial,
        GravacaoDoProcesso,
        ...CATALOGOS_DO_CRONOGRAMA,
        UnidadesResponsaveisDasFases,
        ReleituraDasEtapas,
        FormularioDoCronograma,
        ExpansaoDoCronograma,
        EdicaoDaEtapa,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RecursosDaEtapaComponent);
    fixture.componentRef.setInput('grupo', grupo);
    fixture.componentRef.setInput('indiceDaEtapa', 0);
    edicao = TestBed.inject(EdicaoDaEtapa);
    TestBed.inject(ExpansaoDoCronograma).alternarBloco(0, 'recursos');
    fixture.detectChanges();
  }

  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const botao = (nome: string): HTMLButtonElement | undefined =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes(nome),
    );

  describe('etapa de nota do ENEM', () => {
    beforeEach(() => montar(true, []));

    it('não oferece acrescentar recurso e explica onde a nota se contesta', () => {
      expect(botao('Acrescentar recurso')).toBeUndefined();
      expect(texto()).toContain('a nota do ENEM se contesta no recurso da fase que a divulga');
    });

    it('não acrescenta recurso nem por chamada direta', () => {
      edicao.acrescentarRecursoNaEtapa(grupo);

      expect(grupo.controls.recursos.value).toEqual([]);
    });
  });

  describe('etapa de nota do ENEM com recurso já declarado', () => {
    beforeEach(() => montar(true, [RECURSO]));

    it('pede a remoção da janela, que continua removível', () => {
      expect(texto()).toContain('não admite recurso próprio: remova a janela');
      expect(botao('Acrescentar recurso')).toBeUndefined();

      botao('Remover recurso')?.click();
      fixture.detectChanges();

      expect(grupo.controls.recursos.value).toEqual([]);
      expect(texto()).not.toContain('remova a janela');
    });
  });

  describe('etapa comum', () => {
    beforeEach(() => montar(false, []));

    it('oferece acrescentar recurso, que nasce ancorado na publicação do ato', () => {
      expect(botao('Acrescentar recurso')).toBeDefined();

      edicao.acrescentarRecursoNaEtapa(grupo);

      expect(grupo.controls.recursos.value).toHaveLength(1);
      expect(grupo.controls.recursos.value[0]?.ancora).toBe('atoPublicado');
    });
  });

  describe('etapa cujo tipo congelado do ENEM é de outro tipo', () => {
    beforeEach(() => montar(false, [], { ...TIPO_DA_NOTA_DO_ENEM, origemId: 'outro-tipo' }));

    it('segue como etapa comum e continua oferecendo recurso', () => {
      expect(botao('Acrescentar recurso')).toBeDefined();

      edicao.acrescentarRecursoNaEtapa(grupo);

      expect(grupo.controls.recursos.value).toHaveLength(1);
    });
  });
});
