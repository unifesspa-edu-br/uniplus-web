import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { marcarRecusaDoServidor } from '../../shared/formulario';
import { CATALOGO } from './catalogo-de-fatos.fixture';
import { EdicaoDaModalidade } from './edicao-da-modalidade';
import { comandoDeCriacao, regraDesabilitada } from './modalidade-form';
import { ModalidadeFormPage } from './modalidade-form.page';
import { ModalidadeFormStore } from './modalidade-form.store';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/modalidades`;
const URL_ADMIN = `${BASE}/api/configuracao/admin/modalidades`;
const URL_CATALOGO = `${BASE}/api/configuracao/fatos-candidato`;

function modalidade(over: Partial<ModalidadeDto>): ModalidadeDto {
  return {
    id: over.id ?? crypto.randomUUID(),
    codigo: 'AC',
    legalFixa: true,
    descricao: 'Ampla concorrência',
    naturezaLegal: 'AMPLA',
    composicaoVagas: 'RESIDUAL_DO_VO',
    composicaoOrigem: null,
    regraRemanejamento: null,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
    regraDeAplicabilidade: [],
    acaoQuandoIndeferido: null,
    baseLegal: null,
    criadoEm: '2026-07-03T12:00:00Z',
    ...over,
  };
}

const AC = modalidade({ id: 'id-ac', codigo: 'AC' });
const LB_PPI = modalidade({
  id: 'id-lb',
  codigo: 'LB_PPI',
  descricao: 'Cota PPI baixa renda',
  naturezaLegal: 'COTA_RESERVADA',
  composicaoVagas: 'DENTRO_DO_VR',
  regraRemanejamento: 'SEGUE_CASCATA',
  regraDeAplicabilidade: [
    [{ fato: 'COR_RACA', operador: 'EM', valor: ['PRETA', 'PARDA', 'INDIGENA'] }],
  ],
});
/** Modalidade institucional: fora do catálogo legal fixo, a regra se edita. */
const BONUS = modalidade({
  id: 'id-bonus',
  codigo: 'AA_REGIONAL',
  legalFixa: false,
  descricao: 'Ação afirmativa regional',
  naturezaLegal: 'ACAO_AFIRMATIVA',
  composicaoVagas: 'SUPLEMENTAR_AO_TOTAL',
  regraRemanejamento: 'DESTINO_UNICO',
  remanejamentoDestino: 'AC',
  regraDeAplicabilidade: [
    [{ fato: 'ESCOLA_PUBLICA', operador: 'IGUAL', valor: true }],
    [{ fato: 'COR_RACA', operador: 'IGUAL', valor: 'INDIGENA' }],
  ],
});

describe('ModalidadeFormPage', () => {
  let fixture: ComponentFixture<ModalidadeFormPage>;
  let edicao: EdicaoDaModalidade;
  let controller: HttpTestingController;

  beforeEach(() => {
    // Modo criação por padrão (sem `id`); os testes de edição trocam a rota via `usarRota`.
    TestBed.configureTestingModule({
      imports: [ModalidadeFormPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'modalidades', children: [] }]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}) } },
        },
      ],
    });
  });

  afterEach(() => {
    controller.match(URL_CATALOGO).forEach((req) => req.flush([]));
    controller.verify();
  });

  /** Instancia o componente e libera o GET das modalidades vivas (selects de FK). */
  async function montar(vivas: readonly ModalidadeDto[] = [AC, LB_PPI]): Promise<void> {
    fixture = TestBed.createComponent(ModalidadeFormPage);
    edicao = fixture.debugElement.injector.get(EdicaoDaModalidade);
    controller = TestBed.inject(HttpTestingController);
    TestBed.tick();
    const req = controller.expectOne((r) => r.url === URL && r.params.get('limit') === '100');
    req.flush([...vivas]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    TestBed.tick();
  }

  /** Reconfigura a rota para modo edição antes de montar. */
  function usarRota(id: string): void {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
    });
  }

  /** Abre em edição a modalidade dada, com o catálogo de fatos carregado. */
  async function editar(dto: ModalidadeDto): Promise<void> {
    usarRota(dto.id);
    await montar();
    controller.expectOne(`${URL}/${dto.id}`).flush(dto);
    TestBed.tick();
    controller.expectOne(URL_CATALOGO).flush([...CATALOGO]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  const textoDaRegra = (): string =>
    (
      fixture.nativeElement.querySelector('section[aria-labelledby="cfg-mod-regra"]') as HTMLElement
    ).textContent?.replace(/\s+/g, ' ') ?? '';

  const setControl = (nome: string, valor: string): void => {
    edicao.form.get(nome)?.setValue(valor);
  };

  it('percorre todas as páginas de modalidades vivas sem truncar', async () => {
    fixture = TestBed.createComponent(ModalidadeFormPage);
    edicao = fixture.debugElement.injector.get(EdicaoDaModalidade);
    controller = TestBed.inject(HttpTestingController);

    TestBed.tick();
    const pagina1 = controller.expectOne((r) => r.url === URL && r.params.get('limit') === '100');
    pagina1.flush([AC], {
      headers: { Link: `<${URL}?cursor=pagina-2&direction=next>; rel="next"` },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    TestBed.tick();
    const pagina2 = controller.expectOne(
      (r) => r.url === URL && r.params.get('cursor') === 'pagina-2',
    );
    expect(pagina2.request.params.get('direction')).toBe('next');
    pagina2.flush([LB_PPI]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    TestBed.tick();
    const store = fixture.debugElement.injector.get(ModalidadeFormStore);
    expect(store.opcoes()).toHaveLength(2);
    expect(store.opcoes().map((m) => m.codigo)).toEqual(['AC', 'LB_PPI']);
  });

  it('ModalidadeForm_Natureza_AmplaOcultaRemanejamento', async () => {
    await montar();
    setControl('naturezaLegal', 'AMPLA');
    edicao.aoMudarNatureza();
    expect(edicao.mostraRemanejamento()).toBe(false);
    expect(edicao.form.controls.regraRemanejamento.value).toBe('');
  });

  it('ModalidadeForm_Natureza_CotaFixaCascata', async () => {
    await montar();
    setControl('naturezaLegal', 'COTA_RESERVADA');
    edicao.aoMudarNatureza();
    expect(edicao.form.controls.regraRemanejamento.value).toBe('SEGUE_CASCATA');
    expect(regraDesabilitada(edicao.natureza(), 'SEGUE_CASCATA')).toBe(false);
    expect(regraDesabilitada(edicao.natureza(), 'DESTINO_UNICO')).toBe(true);
    expect(regraDesabilitada(edicao.natureza(), 'CRUZADO')).toBe(true);
  });

  it('ModalidadeForm_Natureza_AcaoAfirmativaOfertaDestinoOuCruzado', async () => {
    await montar();
    setControl('naturezaLegal', 'ACAO_AFIRMATIVA');
    edicao.aoMudarNatureza();
    expect(regraDesabilitada(edicao.natureza(), 'SEGUE_CASCATA')).toBe(true);
    expect(regraDesabilitada(edicao.natureza(), 'DESTINO_UNICO')).toBe(false);
    expect(regraDesabilitada(edicao.natureza(), 'CRUZADO')).toBe(false);
    // Regra passa a ser obrigatória.
    expect(edicao.form.controls.regraRemanejamento.invalid).toBe(true);
  });

  it('ModalidadeForm_RetiraDe_ExigeOrigem', async () => {
    await montar();
    setControl('composicaoVagas', 'RETIRA_DE');
    edicao.aoMudarComposicao();
    expect(edicao.mostraOrigem()).toBe(true);
    expect(edicao.form.controls.composicaoOrigem.invalid).toBe(true);
    edicao.form.controls.composicaoOrigem.setValue('AC');
    expect(edicao.form.controls.composicaoOrigem.valid).toBe(true);
    // Voltar para outra composição limpa e desobriga a origem.
    setControl('composicaoVagas', 'RESIDUAL_DO_VO');
    edicao.aoMudarComposicao();
    expect(edicao.mostraOrigem()).toBe(false);
    expect(edicao.form.controls.composicaoOrigem.value).toBe('');
  });

  it('ModalidadeForm_Args_PorRegra', async () => {
    await montar();
    setControl('naturezaLegal', 'ACAO_AFIRMATIVA');
    edicao.aoMudarNatureza();
    setControl('regraRemanejamento', 'DESTINO_UNICO');
    edicao.aoMudarRegra();
    expect(edicao.mostraDestino()).toBe(true);
    expect(edicao.mostraParFallback()).toBe(false);
    expect(edicao.form.controls.remanejamentoDestino.invalid).toBe(true);

    setControl('remanejamentoDestino', 'AC');
    setControl('regraRemanejamento', 'CRUZADO');
    edicao.aoMudarRegra();
    // Destino é limpo; par e fallback passam a ser exigidos.
    expect(edicao.form.controls.remanejamentoDestino.value).toBe('');
    expect(edicao.mostraParFallback()).toBe(true);
    expect(edicao.form.controls.remanejamentoPar.invalid).toBe(true);
    expect(edicao.form.controls.remanejamentoFallback.invalid).toBe(true);
  });

  it('ModalidadeForm_Codigo_RegexEUnicidade', async () => {
    await montar();
    const codigo = edicao.form.controls.codigo;
    codigo.setValue('AB-C');
    expect(codigo.hasError('pattern')).toBe(true);
    codigo.setValue('AB_C');
    expect(codigo.valid).toBe(true);
    // Unicidade entre vivas carregadas.
    codigo.setValue('AC');
    edicao.verificarCodigoDuplicado();
    expect(codigo.hasError('duplicado')).toBe(true);
  });

  it('ModalidadeForm_Salvar_DescartaARecusaDoServidorSemPerderOCodigoRepetido', async () => {
    await montar();
    const codigo = edicao.form.controls.codigo;
    codigo.setValue('AC');
    marcarRecusaDoServidor(codigo, 'uniplus.configuracao.modalidade.codigo_ja_existe', 'Recusado.');

    edicao.salvar();

    expect(codigo.hasError('backend')).toBe(false);
    expect(codigo.hasError('duplicado')).toBe(true);
  });

  it('ModalidadeForm_Codigo_ReadonlyNaEdicao', async () => {
    usarRota('id-lb');
    await montar();
    const obter = controller.expectOne(`${URL}/id-lb`);
    obter.flush(LB_PPI);
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(edicao.modoEdicao).toBe(true);
    expect(edicao.form.controls.codigo.disabled).toBe(true);
    expect(edicao.form.controls.codigo.value).toBe('LB_PPI');
  });

  it('ModalidadeForm_TrocaNatureza_ResetaDependentes', async () => {
    await montar();
    setControl('naturezaLegal', 'ACAO_AFIRMATIVA');
    edicao.aoMudarNatureza();
    setControl('regraRemanejamento', 'CRUZADO');
    edicao.aoMudarRegra();
    edicao.form.controls.remanejamentoPar.setValue('AC');
    edicao.form.controls.remanejamentoFallback.setValue('LB_PPI');

    // Trocar para AMPLA com args preenchidos pede confirmação.
    setControl('naturezaLegal', 'AMPLA');
    edicao.aoMudarNatureza();
    expect(edicao.confirmandoReset()).toBe(true);
    expect(edicao.form.controls.regraRemanejamento.value).toBe('CRUZADO');

    edicao.confirmarResetNatureza();
    expect(edicao.confirmandoReset()).toBe(false);
    expect(edicao.mostraRemanejamento()).toBe(false);
    expect(edicao.form.controls.regraRemanejamento.value).toBe('');
    expect(edicao.form.controls.remanejamentoPar.value).toBe('');
    expect(edicao.form.controls.remanejamentoFallback.value).toBe('');
  });

  it('ModalidadeForm_TrocaNatureza_CancelarPreserva', async () => {
    await montar();
    setControl('naturezaLegal', 'ACAO_AFIRMATIVA');
    edicao.aoMudarNatureza();
    setControl('regraRemanejamento', 'DESTINO_UNICO');
    edicao.aoMudarRegra();
    edicao.form.controls.remanejamentoDestino.setValue('AC');

    setControl('naturezaLegal', 'COTA_RESERVADA');
    edicao.aoMudarNatureza();
    expect(edicao.confirmandoReset()).toBe(true);

    edicao.cancelarResetNatureza();
    // Reverte a natureza e preserva os campos.
    expect(edicao.form.controls.naturezaLegal.value).toBe('ACAO_AFIRMATIVA');
    expect(edicao.form.controls.remanejamentoDestino.value).toBe('AC');
  });

  it('ModalidadeForm_TrocaNatureza_CascataAutoNaoPrompt', async () => {
    await montar();
    setControl('naturezaLegal', 'COTA_RESERVADA');
    edicao.aoMudarNatureza();
    // regra auto-preenchida SEGUE_CASCATA, sem argumentos digitados pelo usuário.
    setControl('naturezaLegal', 'ACAO_AFIRMATIVA');
    edicao.aoMudarNatureza();
    // Não pede confirmação (nada do usuário a descartar); aplica direto.
    expect(edicao.confirmandoReset()).toBe(false);
    expect(edicao.form.controls.naturezaLegal.value).toBe('ACAO_AFIRMATIVA');
    expect(edicao.form.controls.regraRemanejamento.value).toBe('');
    expect(regraDesabilitada(edicao.natureza(), 'SEGUE_CASCATA')).toBe(true);
  });

  it('montarComandoCriar anula campos inaplicáveis por coerência', async () => {
    await montar();
    setControl('codigo', 'AC2');
    setControl('naturezaLegal', 'AMPLA');
    edicao.aoMudarNatureza();
    setControl('composicaoVagas', 'RESIDUAL_DO_VO');
    edicao.aoMudarComposicao();
    const cmd = comandoDeCriacao(edicao.form.getRawValue(), []);
    expect(cmd.codigo).toBe('AC2');
    expect(cmd.regraRemanejamento).toBeNull();
    expect(cmd.composicaoOrigem).toBeNull();
    expect(cmd.remanejamentoDestino).toBeNull();
    expect(cmd.remanejamentoPar).toBeNull();
    expect(cmd.remanejamentoFallback).toBeNull();
  });

  it('CA-02: cria modalidade válida (POST com Idempotency-Key)', async () => {
    await montar();
    setControl('codigo', 'V');
    setControl('descricao', 'PcD ampla concorrência');
    setControl('naturezaLegal', 'ACAO_AFIRMATIVA');
    edicao.aoMudarNatureza();
    setControl('composicaoVagas', 'RETIRA_DE');
    edicao.aoMudarComposicao();
    setControl('composicaoOrigem', 'AC');
    setControl('regraRemanejamento', 'DESTINO_UNICO');
    edicao.aoMudarRegra();
    setControl('remanejamentoDestino', 'AC');

    edicao.salvar();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/modalidades`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body.codigo).toBe('V');
    expect(post.request.body.composicaoOrigem).toBe('AC');
    expect(post.request.body.remanejamentoDestino).toBe('AC');
    expect(post.request.body.regraRemanejamento).toBe('DESTINO_UNICO');
    post.flush('novo-id', { status: 201, statusText: 'Created' });
  });

  it('CA-05: código inválido bloqueia o submit (sem POST)', async () => {
    await montar();
    setControl('codigo', '');
    edicao.salvar();
    controller.expectNone(`${BASE}/api/configuracao/admin/modalidades`);
    expect(edicao.form.controls.codigo.invalid).toBe(true);
  });

  describe('edição', () => {
    it('mantém o que foi digitado ao trocar a natureza ou a composição', async () => {
      await editar(modalidade({ ...BONUS, regraRemanejamento: null, remanejamentoDestino: null }));
      edicao.form.controls.descricao.setValue('Descrição digitada');

      setControl('composicaoVagas', 'RETIRA_DE');
      edicao.aoMudarComposicao();
      TestBed.tick();
      setControl('naturezaLegal', 'COTA_RESERVADA');
      edicao.aoMudarNatureza();
      TestBed.tick();

      expect(edicao.form.controls.descricao.value).toBe('Descrição digitada');
      expect(edicao.form.controls.composicaoVagas.value).toBe('RETIRA_DE');
      expect(edicao.form.controls.naturezaLegal.value).toBe('COTA_RESERVADA');
      expect(edicao.natureza()).toBe('COTA_RESERVADA');
      expect(edicao.mostraOrigem()).toBe(true);
    });

    it('mantém a chave e mostra o título quando a gravação original ainda está em processamento (409)', async () => {
      await editar(BONUS);
      const enviar = (): TestRequest => {
        edicao.salvar();
        return controller.expectOne(`${URL_ADMIN}/${BONUS.id}`);
      };
      const primeira = enviar();
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(
        JSON.stringify({
          type: 'about:blank',
          title: 'Requisição em processamento',
          status: 409,
          code: 'uniplus.idempotency.processing_conflict',
        }),
        {
          status: 409,
          statusText: 'Conflict',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(edicao.erro()).toBe('Requisição em processamento');
      const segunda = enviar();
      expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
      segunda.flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  describe('código na edição', () => {
    it('não normaliza nem altera o código, que é somente leitura', async () => {
      await editar(BONUS);
      const campo = fixture.nativeElement.querySelector(
        'input[formcontrolname="codigo"]',
      ) as HTMLInputElement;
      campo.dispatchEvent(new Event('input'));
      expect(campo.readOnly || campo.disabled).toBe(true);
      expect(edicao.form.controls.codigo.value).toBe('AA_REGIONAL');
    });
  });

  describe('regra de aplicabilidade', () => {
    it('lê a regra salva em prosa, pelos nomes do catálogo, sem códigos', async () => {
      await editar(BONUS);

      const texto = textoDaRegra();
      expect(texto).toContain('Quem atende a pelo menos uma destas alternativas:');
      expect(texto).toContain('Cursou o ensino médio em escola pública é sim');
      expect(texto).toContain('Cor/raça é Indígena');
      expect(texto).not.toContain('"INDIGENA"');
    });

    it('lê a regra sem condição como todos os candidatos', async () => {
      await editar(modalidade({ ...BONUS, regraDeAplicabilidade: [] }));

      expect(textoDaRegra()).toContain('Todos os candidatos.');
    });

    it('mostra a regra da modalidade legal fixa só para leitura e a reenvia como veio', async () => {
      await editar(LB_PPI);

      expect(fixture.nativeElement.querySelector('ui-editor-de-condicoes')).toBeNull();
      expect(textoDaRegra()).toContain('Quem atende: Cor/raça é um de Preta, Parda, Indígena.');

      edicao.salvar();
      const put = controller.expectOne(`${URL_ADMIN}/${LB_PPI.id}`);
      expect(put.request.body.regraDeAplicabilidade).toEqual(LB_PPI.regraDeAplicabilidade);
      put.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('edita a regra da modalidade institucional e envia o que o editor escreveu', async () => {
      await editar(BONUS);
      expect(fixture.nativeElement.querySelector('ui-editor-de-condicoes')).not.toBeNull();

      edicao.aplicabilidade.trocar([
        { clausula: 1, fato: 'COR_RACA', operador: 'NAO_EM', valor: '["PRETA"]' },
      ]);
      edicao.salvar();

      const put = controller.expectOne(`${URL_ADMIN}/${BONUS.id}`);
      expect(put.request.body.regraDeAplicabilidade).toEqual([
        [{ fato: 'COR_RACA', operador: 'NAO_EM', valor: ['PRETA'] }],
      ]);
      put.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('envia a regra sem condição como lista vazia, nunca ausente', async () => {
      await editar(BONUS);

      edicao.aplicabilidade.trocar([]);
      edicao.salvar();

      const put = controller.expectOne(`${URL_ADMIN}/${BONUS.id}`);
      expect(put.request.body.regraDeAplicabilidade).toEqual([]);
      put.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('não oferece ao editor o fato da própria modalidade', async () => {
      await editar(BONUS);

      expect(edicao.aplicabilidade.fatos().map((fato) => fato.codigo)).toEqual([
        'ESCOLA_PUBLICA',
        'COR_RACA',
      ]);
    });

    it('recusa enviar a condição sem valor e aponta a condição', async () => {
      await editar(BONUS);

      edicao.aplicabilidade.trocar([
        { clausula: 1, fato: 'COR_RACA', operador: 'IGUAL', valor: '' },
      ]);
      edicao.salvar();

      controller.expectNone(`${URL_ADMIN}/${BONUS.id}`);
      expect(edicao.aplicabilidade.errosDasCondicoes()).toEqual({ 0: '"Cor/raça" está sem valor' });
    });

    it('mostra no campo da regra a recusa da API à regra', async () => {
      await editar(BONUS);

      edicao.salvar();
      controller.expectOne(`${URL_ADMIN}/${BONUS.id}`).flush(
        {
          type: 'https://uniplus.unifesspa.edu.br/errors/validacao',
          title: 'Erro de validação',
          status: 422,
          code: 'uniplus.validacao',
          errors: [
            {
              field: 'regraDeAplicabilidade',
              code: 'uniplus.configuracao.modalidade.regra_cita_fato_desativado',
              message: "O fato 'ESCOLA_PUBLICA' está desativado e não aceita citação nova.",
            },
          ],
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
      fixture.detectChanges();

      const erro = fixture.nativeElement.querySelector(
        'section[aria-labelledby="cfg-mod-regra"] [role="alert"]',
      ) as HTMLElement | null;
      expect(erro?.tagName).toBe('DIV');
      const itens = erro?.querySelectorAll(
        'ul[aria-label="Erros da regra de aplicabilidade"] > li',
      );
      expect(Array.from(itens ?? [], (item) => item.textContent?.trim())).toEqual([
        "O fato 'ESCOLA_PUBLICA' está desativado e não aceita citação nova.",
      ]);
      expect(edicao.erro()).toBeNull();
    });
  });
});
