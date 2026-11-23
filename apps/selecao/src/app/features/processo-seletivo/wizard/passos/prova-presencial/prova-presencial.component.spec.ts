import { provideHttpClient } from '@angular/common/http';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { BUSCA_DE_MUNICIPIOS, EscolhaComExplicacaoComponent } from '@uniplus/shared-ui/components';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { RecusaOrdenada } from '../../shared/recusas/ordem-das-recusas';
import { dtoComCronograma } from '../../shared/hidratacao.testing';
import { NumeracaoDasRespostasRecusadas } from '../../shared/recusas/numeracao-das-respostas-recusadas';
import { RecusasDaPublicacao } from '../../shared/recusas/recusas-da-publicacao.service';
import { RecusasDaPublicacaoNaProvaPresencial } from './recusas-da-publicacao-na-prova-presencial.service';
import { GravacaoDaProvaPresencialService } from './gravacao-da-prova-presencial.service';
import { MunicipiosDeProvaComponent } from './municipios-de-prova.component';
import { SITUACAO_PUBLICADO, SITUACAO_RASCUNHO } from './prova-presencial.testing';
import { ProvaPresencialPassoComponent } from './prova-presencial.component';
import { recusasDaProvaPresencial } from './recusas-da-prova-presencial';

const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };
const BELEM = { codigoIbge: '1501402', nome: 'Belém', uf: 'PA' };
const RECUSA_DA_LISTA: RecusaOrdenada = {
  campo: 'provaPresencial.municipios',
  codigo: 'ProvaPresencial.SemMunicipio',
  mensagem: 'Confira os municípios.',
  pagina: 'https://exemplo.org/erros/ProvaPresencial.SemMunicipio',
  ordem: 0,
  resposta: 1,
  origem: 'gravacao',
  aConferir: false,
};
const RECUSA_DO_MUNICIPIO: RecusaOrdenada = {
  ...RECUSA_DA_LISTA,
  campo: 'provaPresencial.municipios.0',
  codigo: 'ProvaPresencial.MunicipioInvalido',
};
const RECUSA_REPETIDA: RecusaOrdenada = {
  ...RECUSA_DA_LISTA,
  codigo: 'ProvaPresencial.MunicipioRepetido',
  mensagem: 'Confira o município.',
  pagina: 'https://exemplo.org/erros/ProvaPresencial.MunicipioRepetido',
  resposta: 2,
};
const ERRO_DA_LISTA_NA_PUBLICACAO = {
  field: 'provaPresencial.municipios',
  code: 'ProvaPresencial.SemMunicipio',
  message: 'Confira a lista.',
};
const ERRO_DO_MUNICIPIO_NA_PUBLICACAO = {
  field: '/provaPresencial/municipios/0/codigoIbge',
  code: 'ProvaPresencial.MunicipioNaoConferidoNoGeo',
  message: 'Confira.',
};

function preparar() {
  const gravacao = {
    gravar: vi.fn().mockResolvedValue({ valid: true }),
    aviso: signal<string | null>(null),
    gravadaNoServidor: signal<{
      processoId: string;
      declaracao: { temProvaPresencial: boolean | null; municipios: readonly (typeof MARABA)[] };
    } | null>(null),
    recusasDaGravacao: signal(recusasDaProvaPresencial([], [])),
  };
  TestBed.configureTestingModule({
    imports: [ProvaPresencialPassoComponent],
    providers: [
      provideHttpClient(),
      { provide: GEO_BASE_PATH, useValue: '/geo' },
      ProcessoSeletivoStore,
      NumeracaoDasRespostasRecusadas,
      RecusasDaPublicacao,
      RecusasDaPublicacaoNaProvaPresencial,
      { provide: GravacaoDaProvaPresencialService, useValue: gravacao },
    ],
  });
  TestBed.overrideComponent(MunicipiosDeProvaComponent, {
    set: {
      providers: [{ provide: BUSCA_DE_MUNICIPIOS, useValue: () => of({ ok: true, data: [] }) }],
    },
  });
  const fixture = TestBed.createComponent(ProvaPresencialPassoComponent);
  const store = TestBed.inject(ProcessoSeletivoStore);
  store.processoSeletivoId.set('processo');
  fixture.detectChanges();
  return { fixture, store, gravacao, componente: fixture.componentInstance };
}

function escolher(fixture: ReturnType<typeof preparar>['fixture'], valor: string) {
  fixture.debugElement
    .query(By.directive(EscolhaComExplicacaoComponent))
    .componentInstance.escolhido.emit(valor);
  fixture.detectChanges();
}

type Preparado = ReturnType<typeof preparar>;

const textoDaTela = (fixture: Preparado['fixture']): string => fixture.nativeElement.textContent;

function selecionarMaraba(store: ProcessoSeletivoStore): void {
  store.patchObjectSection('provaPresencial', { temProvaPresencial: true, municipios: [MARABA] });
}

function prepararComMarabaNoRascunho(): Preparado {
  const preparado = preparar();
  selecionarMaraba(preparado.store);
  preparado.fixture.detectChanges();
  return preparado;
}

function declararRemocaoNoServidor(
  preparado: Preparado,
  municipios: readonly (typeof MARABA)[],
): void {
  preparado.gravacao.gravadaNoServidor.set({
    processoId: 'processo',
    declaracao: { temProvaPresencial: true, municipios },
  });
  preparado.store.patchObjectSection('provaPresencial', { temProvaPresencial: false, municipios });
  preparado.fixture.detectChanges();
}

function definirRecusasDaGravacao(
  gravacao: Preparado['gravacao'],
  recusas: readonly RecusaOrdenada[],
): void {
  gravacao.recusasDaGravacao.set(recusasDaProvaPresencial(recusas, [MARABA]));
}

function registrarRecusaDaPublicacao(erro: { field: string; code: string; message: string }): void {
  TestBed.inject(RecusasDaPublicacao).registrar(
    {
      type: 'https://exemplo.org/erros/validacao',
      title: 'Validação',
      status: 422,
      code: 'validacao',
      traceId: 't',
      errors: [erro],
    },
    'Recusada',
  );
}

function linksDeRecusa(fixture: Preparado['fixture']): Element[] {
  return [...fixture.nativeElement.querySelectorAll('a')].filter((link: Element) =>
    link.textContent?.includes('Entenda a recusa'),
  );
}

function prepararRemocaoDeMunicipioGravado(): ReturnType<typeof preparar> {
  const preparado = preparar();
  preparado.store.remoteSnapshot.set(
    dtoComCronograma({
      situacao: SITUACAO_RASCUNHO,
      provaPresencial: { temProvaPresencial: true, municipios: [MARABA] },
    }),
  );
  preparado.store.patchObjectSection('provaPresencial', {
    temProvaPresencial: false,
    municipios: [MARABA],
  });
  return preparado;
}

describe('ProvaPresencialPassoComponent', () => {
  it('mostra o estado por declarar e exige a escolha', () => {
    const { fixture, componente } = preparar();
    expect(fixture.nativeElement.textContent).toContain(
      'A prova presencial ainda não foi declarada.',
    );
    expect(componente.validar()).toEqual({
      valid: false,
      messages: ['Escolha se o processo tem prova presencial.'],
    });
  });

  it('mantém os municípios no rascunho ao escolher sem prova', async () => {
    const { fixture, componente, gravacao } = prepararComMarabaNoRascunho();
    escolher(fixture, 'sem');
    expect(textoDaTela(fixture)).toContain(
      'O município de prova (Marabá (PA)) será removido ao salvar.',
    );
    expect(fixture.debugElement.query(By.directive(MunicipiosDeProvaComponent))).toBeNull();
    await componente.persistir();
    expect(gravacao.gravar).toHaveBeenCalledWith('processo', {
      temProvaPresencial: false,
      municipios: [MARABA],
    });
  });

  it('devolve os municípios ao escolher com prova depois de escolher sem prova', () => {
    const { fixture } = prepararComMarabaNoRascunho();
    escolher(fixture, 'sem');
    escolher(fixture, 'com');
    expect(textoDaTela(fixture)).toContain('Marabá (PA)');
  });

  it('adiciona e remove municípios pelo componente de apresentação', () => {
    const { fixture, store } = preparar();
    escolher(fixture, 'com');
    const municipios = fixture.debugElement.query(
      By.directive(MunicipiosDeProvaComponent),
    ).componentInstance;
    municipios.municipioAdicionado.emit(MARABA);
    expect(store.draft().provaPresencial.municipios).toEqual([MARABA]);
    municipios.municipioRemovido.emit(MARABA.codigoIbge);
    expect(store.draft().provaPresencial.municipios).toEqual([]);
  });

  it('exige confirmação para remover municípios gravados', () => {
    const { componente } = prepararRemocaoDeMunicipioGravado();

    expect(componente.confirmacaoDeGravacao()).toMatchObject({
      titulo: 'Município de prova será removido',
      aviso: 'O município de prova será removido do processo.',
    });
    expect(componente.confirmacaoDeGravacao()?.itens[0].valor).toBe('Marabá (PA)');
  });

  it('bloqueia a regravação da publicação até a confirmação da remoção', async () => {
    const { componente, gravacao } = prepararRemocaoDeMunicipioGravado();

    expect(await componente.persistir({ confirmadaPeloOperador: false })).toEqual({
      valid: false,
      messages: [
        'Grave o passo Prova presencial para confirmar a remoção dos municípios de prova.',
      ],
    });
    expect(gravacao.gravar).not.toHaveBeenCalled();
    await componente.persistir({ confirmadaPeloOperador: true });
    expect(gravacao.gravar).toHaveBeenCalledOnce();
  });

  it('apresenta a remoção de vários municípios no plural', () => {
    const preparado = preparar();
    declararRemocaoNoServidor(preparado, [MARABA, BELEM]);
    expect(textoDaTela(preparado.fixture)).toContain(
      'Os 2 municípios de prova (Marabá (PA), Belém (PA)) serão removidos ao salvar.',
    );
    expect(preparado.componente.confirmacaoDeGravacao()).toMatchObject({
      titulo: 'Municípios de prova serão removidos',
      aviso: 'Os municípios de prova serão removidos do processo.',
    });
  });

  it('ignora a declaração gravada de outro processo', () => {
    const { store, componente, gravacao } = preparar();
    gravacao.gravadaNoServidor.set({
      processoId: 'outro',
      declaracao: { temProvaPresencial: true, municipios: [MARABA] },
    });
    store.patchObjectSection('provaPresencial', { temProvaPresencial: false, municipios: [] });
    expect(componente.confirmacaoDeGravacao()).toBeNull();
  });

  it('mostra as recusas da lista e do município com código e link', () => {
    const { fixture, gravacao } = prepararComMarabaNoRascunho();
    definirRecusasDaGravacao(gravacao, [RECUSA_DA_LISTA, RECUSA_DO_MUNICIPIO]);
    fixture.detectChanges();
    expect(textoDaTela(fixture)).toContain('ProvaPresencial.SemMunicipio');
    expect(textoDaTela(fixture)).toContain('ProvaPresencial.MunicipioInvalido');
    expect(fixture.nativeElement.querySelectorAll('a').length).toBe(2);
  });

  it('mostra juntas as recusas da gravação e da publicação com código e link', () => {
    const { fixture, gravacao } = prepararComMarabaNoRascunho();
    registrarRecusaDaPublicacao(ERRO_DA_LISTA_NA_PUBLICACAO);
    definirRecusasDaGravacao(gravacao, [RECUSA_REPETIDA]);
    fixture.detectChanges();
    expect(textoDaTela(fixture)).toContain('ProvaPresencial.SemMunicipio');
    expect(textoDaTela(fixture)).toContain('ProvaPresencial.MunicipioRepetido');
    expect(linksDeRecusa(fixture)).toHaveLength(2);
  });

  it('leva o foco ao município recusado pela publicação', async () => {
    const { fixture, componente } = prepararComMarabaNoRascunho();
    registrarRecusaDaPublicacao(ERRO_DO_MUNICIPIO_NA_PUBLICACAO);
    fixture.detectChanges();
    expect(await componente.revelarCampoInvalido()).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Remover Marabá (PA)');
  });

  it('prefere a declaração gravada nesta sessão ao primeiro snapshot', () => {
    const { store, componente, gravacao } = preparar();
    store.patchObjectSection('provaPresencial', { temProvaPresencial: false, municipios: [] });
    gravacao.gravadaNoServidor.set({
      processoId: 'processo',
      declaracao: { temProvaPresencial: true, municipios: [MARABA] },
    });
    expect(componente.confirmacaoDeGravacao()?.itens[0].valor).toBe('Marabá (PA)');
  });

  it('mostra os três estados em consulta sem controles', () => {
    const { fixture, store } = preparar();
    store.remoteSnapshot.set(dtoComCronograma({ situacao: SITUACAO_PUBLICADO }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ainda não declarada');
    store.projetarSecao('provaPresencial', { temProvaPresencial: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sem prova presencial');
    store.projetarSecao('provaPresencial', { temProvaPresencial: true, municipios: [MARABA] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Com prova presencial em: Marabá (PA)');
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
  });

  it('leva o foco ao campo quando o destino é definido depois de a tela aberta', async () => {
    const { fixture } = preparar();
    const focar = vi.spyOn(
      fixture.debugElement.query(By.directive(EscolhaComExplicacaoComponent)).componentInstance,
      'focar',
    );
    registrarRecusaDaPublicacao({
      field: 'provaPresencial',
      code: 'ProvaPresencial.PorDeclarar',
      message: 'Declare.',
    });
    const recusaDaPublicacao = TestBed.inject(RecusasDaPublicacao);

    recusaDaPublicacao.destino.set(recusaDaPublicacao.recusas()[0]);
    fixture.detectChanges();

    await vi.waitFor(() => expect(focar).toHaveBeenCalled());
    expect(recusaDaPublicacao.destino()).toBeNull();
  });

  it('deixa o destino de outra etapa para quem o espera', async () => {
    const { fixture } = preparar();
    const focar = vi.spyOn(
      fixture.debugElement.query(By.directive(EscolhaComExplicacaoComponent)).componentInstance,
      'focar',
    );
    const recusas = TestBed.inject(RecusasDaPublicacao);
    const doCronograma = {
      campo: 'cronograma/0',
      codigo: 'Cronograma.Vazio',
      resposta: 1,
      ordem: 0,
    };

    recusas.destino.set(doCronograma as never);
    fixture.detectChanges();
    await new Promise((resolver) => setTimeout(resolver, 0));

    expect(recusas.destino()).toBe(doCronograma);
    expect(focar).not.toHaveBeenCalled();
  });
});
