import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor, type RecusaDoProblema } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, type TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import {
  EfeitoSuspensivoCodigo,
  PapelDaBancaCodigo,
  SELECAO_BASE_PATH,
  UnidadePrazoCodigo,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it } from 'vitest';

import type { RecursoDaEtapa } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { umaBancaDeclarada } from '../../../shared/bancas/banca-declarada.testing';
import { CadastroInicial } from '../../../shared/cadastro-inicial.service';
import {
  opcoesDoRecursoDaUrl,
  PARAMETROS_COM_INSTANCIA_SUPERIOR,
  umaLeituraDoRecurso,
} from '../../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
import { GravacaoDoProcesso } from '../../../shared/gravacao/gravacao-do-processo';
import { CatalogoDeBancas } from '../catalogos/catalogo-de-bancas.service';
import { CatalogoDasOpcoesDoRecurso } from '../catalogos/catalogo-das-opcoes-do-recurso.service';
import { CATALOGOS_DO_CRONOGRAMA } from '../catalogos/catalogos-do-cronograma';
import {
  provideTiposDeDecisaoDaApi,
  umProcessoLidoComOsTiposDeDecisao,
} from '../../../shared/decisoes-da-fase-ou-etapa/tipos-de-decisao-da-api.testing';
import { PROCESSO_DTO_MINIMO } from '../../revisao/revisao.testing';
import { etapa } from '../cronograma-do-certame.testing';
import { etapaDoFormulario, grupoDaEtapa } from '../cronograma-form';
import { BASE } from '../cronograma.testing';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { FormularioDoCronograma } from '../servicos/formulario-do-cronograma.service';
import { ReleituraDosIdentificadores } from '../servicos/releitura-dos-identificadores.service';
import { RecusasDoServidorNasEtapas } from '../servicos/recusas-do-servidor-nas-etapas.service';
import { RecusasDoServidorNasFases } from '../servicos/recusas-do-servidor-nas-fases.service';
import { UnidadesResponsaveisDasFases } from '../servicos/unidades-responsaveis-das-fases.service';
import { ConfiguracaoDoRecursoDaEtapaComponent } from './configuracao-do-recurso-da-etapa.component';
import { SEM_RECUSAS_DA_PUBLICACAO } from '../servicos/recusas-da-publicacao-no-cronograma.testing';

const RECURSO: RecursoDaEtapa = {
  ancora: 'CIENCIA_INDIVIDUAL',
  regraCodigo: 'PRAZO',
  regraVersao: 'v1',
  ...PARAMETROS_COM_INSTANCIA_SUPERIOR,
  atoAncoraCodigo: '',
  leitura: umaLeituraDoRecurso(),
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
        ReleituraDosIdentificadores,
        FormularioDoCronograma,
        RecusasDoServidorNasEtapas,
        SEM_RECUSAS_DA_PUBLICACAO,
        RecusasDoServidorNasFases,
        EdicaoDaEtapa,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        provideTiposDeDecisaoDaApi(),
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
    const catalogo = TestBed.inject(CatalogoDasOpcoesDoRecurso);
    catalogo.carregar();
    for (const requisicao of TestBed.inject(HttpTestingController).match(() => true)) {
      requisicao.flush(opcoesDoRecursoDaUrl(requisicao.request.url) ?? []);
    }
    fixture.detectChanges();
  });

  const seletor = (id: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(`#${id}`);

  const entrada = (id: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`#${id}`);

  const unidadesDe = (id: string): string[] =>
    Array.from(seletor(id)?.options ?? []).map((opcao) => opcao.value);

  const P = 'cr-rec-0-0';
  const recursoNoRascunho = () => grupo.controls.recursos.value[0];

  it('o prazo de interposição oferece as unidades que a API devolve', () => {
    expect(unidadesDe(`${P}-prazo-interposicao-unidade`)).toEqual([
      '',
      UnidadePrazoCodigo.DIAS_UTEIS,
      UnidadePrazoCodigo.HORAS,
    ]);
  });

  it('desenha o prazo de interposição e o da 2ª instância como grupos com legenda', () => {
    const legendas = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('sel-prazo-do-recurso legend'),
    ).map((legenda) => legenda.textContent?.trim());

    expect(legendas).toEqual([
      'Prazo de interposição (obrigatório)',
      'Prazo para recorrer em 2ª instância (obrigatório)',
    ]);
  });

  it('leva ao rascunho do recurso o valor digitado no prazo de interposição', () => {
    const campo = entrada(`${P}-prazo-interposicao-valor`) as HTMLInputElement;

    campo.value = '48';
    campo.dispatchEvent(new Event('input'));

    expect(recursoNoRascunho()?.prazoValor).toBe('48');
  });

  it('leva ao rascunho do recurso a unidade escolhida no prazo de interposição', () => {
    const campo = seletor(`${P}-prazo-interposicao-unidade`) as HTMLSelectElement;

    campo.value = UnidadePrazoCodigo.HORAS;
    campo.dispatchEvent(new Event('change'));

    expect(recursoNoRascunho()?.prazoUnidade).toBe(UnidadePrazoCodigo.HORAS);
  });

  it('mantém à vista e marcada a unidade gravada que a API não oferece', () => {
    fixture.componentRef.setInput('recursoDaEtapa', {
      ...RECURSO,
      prazoUnidade: UnidadePrazoCodigo.DIAS,
    });
    fixture.detectChanges();

    expect(seletor(`${P}-prazo-interposicao-unidade`)?.value).toBe(UnidadePrazoCodigo.DIAS);
    expect(unidadesDe(`${P}-prazo-interposicao-unidade`)).toContain(UnidadePrazoCodigo.DIAS);
  });

  it('leva ao rascunho o efeito suspensivo escolhido', () => {
    entrada(`${P}-efeito-opcao-${EfeitoSuspensivoCodigo.SEM_EFEITO_SUSPENSIVO}`)?.click();

    expect(recursoNoRascunho()?.efeitoSuspensivo).toBe(EfeitoSuspensivoCodigo.SEM_EFEITO_SUSPENSIVO);
  });

  it('marcar Não leva ao rascunho a resposta e retira o prazo da 2ª instância', () => {
    entrada(`${P}-superior-nao`)?.click();

    expect(recursoNoRascunho()).toMatchObject({
      admiteInstanciaSuperior: false,
      prazoSegundaInstanciaValor: '',
      prazoSegundaInstanciaUnidade: '',
    });
  });

  it('retira, pelo botão, o prazo da 2ª instância lido sem instância superior', () => {
    fixture.componentRef.setInput('recursoDaEtapa', {
      ...RECURSO,
      admiteInstanciaSuperior: false,
      leitura: umaLeituraDoRecurso({ prazoDaSegundaInstanciaSemInstanciaSuperior: true }),
    });
    fixture.detectChanges();

    (
      (fixture.nativeElement as HTMLElement).querySelector(
        `#${P}-prazo-segunda-retirar`,
      ) as HTMLElement
    ).click();

    expect(recursoNoRascunho()?.prazoSegundaInstanciaValor).toBe('');
  });

  it('em consulta, lê os parâmetros em texto e não desenha os controles', () => {
    TestBed.inject(ProcessoSeletivoStore).remoteSnapshot.set({
      status: PROCESSO_DTO_MINIMO.status,
    } as unknown as ProcessoSeletivoDto);
    fixture.componentRef.setInput('recursoDaEtapa', {
      ...RECURSO,
      leitura: umaLeituraDoRecurso({ rotulos: { prazoUnidade: 'Dias úteis' } }),
    });
    fixture.detectChanges();

    const nativo = fixture.nativeElement as HTMLElement;
    expect(nativo.querySelector('sel-parametros-do-recurso')).toBeNull();
    expect(nativo.textContent).toContain('2 — Dias úteis');
  });

  it('lista os procedimentos declarados, nomeando o item contestado pelo rótulo da etapa', () => {
    TestBed.inject(ProcessoSeletivoStore).remoteSnapshot.set({
      ...umProcessoLidoComOsTiposDeDecisao(),
      status: PROCESSO_DTO_MINIMO.status,
    });
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

  describe('aviso do recurso que se encerra na 1ª instância', () => {
    const AVISO = 'O recurso deste tipo se encerra na 1ª instância.';
    const ID_DO_AVISO = `${P}-superior-encerra`;
    const bancaComCopia = (encerra: boolean) =>
      umaBancaDeclarada({
        copiaDoTipo: {
          rotulo: 'Banca de entrevista',
          papel: { codigo: PapelDaBancaCodigo.AVALIA_O_MERITO, rotulo: 'Avalia o mérito' },
          exigeDuasOuMaisBancas: false,
          encerraRecursoNaPrimeiraInstancia: encerra,
        },
      });
    const noCadastro = (encerra: boolean) =>
      ({
        id: 'entrevista',
        codigo: { rotulo: 'Banca de entrevista' },
        encerraRecursoNaPrimeiraInstancia: encerra,
      }) as TipoBancaDto;
    const aviso = () => (fixture.nativeElement as HTMLElement).querySelector(`#${ID_DO_AVISO}`);

    beforeEach(() => TestBed.inject(FormularioDoCronograma).etapas.push(grupo));

    const comBancas = (...bancas: ReturnType<typeof bancaComCopia>[]) => {
      grupo.controls.bancas.setValue(bancas);
      fixture.detectChanges();
    };

    it('aparece junto da pergunta, ligado a ela, quando a cópia do tipo de uma banca da etapa traz a marca', () => {
      comBancas(bancaComCopia(false), { ...bancaComCopia(true), identificadorLocal: 'banca-2' });

      expect(aviso()?.textContent?.trim()).toBe(AVISO);
      expect(
        seletor(`${P}-superior-sim`)?.closest('fieldset')?.getAttribute('aria-describedby'),
      ).toContain(ID_DO_AVISO);
    });

    it('não aparece quando a etapa não tem banca ou nenhuma cópia traz a marca', () => {
      expect(aviso()).toBeNull();

      comBancas(bancaComCopia(false));

      expect(aviso()).toBeNull();
    });

    it('não aparece para a banca ainda sem cópia do tipo, que só tem o cadastro', () => {
      TestBed.inject(CatalogoDeBancas).bancas.set([noCadastro(true)]);
      comBancas(umaBancaDeclarada());

      expect(aviso()).toBeNull();
    });

    it('lê a cópia guardada na banca, mesmo que o cadastro diga outra coisa', () => {
      TestBed.inject(CatalogoDeBancas).bancas.set([noCadastro(false)]);
      comBancas(bancaComCopia(true));
      expect(aviso()).not.toBeNull();

      TestBed.inject(CatalogoDeBancas).bancas.set([noCadastro(true)]);
      comBancas(bancaComCopia(false));
      expect(aviso()).toBeNull();
    });
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
        identificadores: [],
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
      campo.value = 'PUBLICACAO_DO_ATO';
      campo.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(atributo(ANCORA, 'aria-invalid')).toBeNull();
      expect(atributo(ANCORA, 'aria-describedby')).toBe(BLOCO);
    });

    it('não marca o controle de onde o prazo corre pela recusa a outro controle do recurso', () => {
      recusar('etapas[0].recursos[0].prazoValor');

      expect(atributo(ANCORA, 'aria-invalid')).toBeNull();
      expect(atributo(ANCORA, 'aria-describedby')).toBeNull();
      expect(atributo(`${P}-prazo-interposicao-valor`, 'aria-invalid')).toBe('true');
    });

    it('mostra a recusa a um parâmetro no alto do recurso, com o botão para ir ao campo', () => {
      recusar('etapas[0].recursos[0].efeitoSuspensivo');

      const bloco = (fixture.nativeElement as HTMLElement).querySelector(
        `#${P.replace('cr-rec-', 'cr-rec-recusas-')}`,
      );
      expect(bloco?.textContent).toContain('Origem do prazo recusada.');
      expect(bloco?.textContent).toContain('Ir ao campo');
      expect(atributo(`${P}-efeito-grupo`, 'aria-invalid')).toBe('true');
    });
  });
});
