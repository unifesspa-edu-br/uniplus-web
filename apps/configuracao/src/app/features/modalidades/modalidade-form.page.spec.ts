import { RegraRemanejamentoCodigo } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { marcarRecusaDoServidor } from '../../shared/formulario';
import { comandoDeCriacao, regraDesabilitada } from './modalidade-form';
import { LB_PPI, PaginaDaModalidade } from './modalidade-form.page.testing';
import { BASE, URL } from './modalidades-de-teste.testing';

describe('ModalidadeFormPage', () => {
  let pagina: PaginaDaModalidade;

  beforeEach(() => {
    pagina = new PaginaDaModalidade();
  });

  afterEach(() => {
    pagina.verificar();
  });

  it('ModalidadeForm_Natureza_AmplaOcultaRemanejamento', async () => {
    await pagina.montar();
    pagina.setControl('naturezaLegal', 'AMPLA');
    pagina.edicao.aoMudarNatureza();
    expect(pagina.edicao.mostraRemanejamento()).toBe(false);
    expect(pagina.edicao.form.controls.regraRemanejamento.value).toBe('');
  });

  it('ModalidadeForm_Natureza_CotaFixaCascata', async () => {
    await pagina.montar();
    pagina.setControl('naturezaLegal', 'COTA_RESERVADA');
    pagina.edicao.aoMudarNatureza();
    expect(pagina.edicao.form.controls.regraRemanejamento.value).toBe(
      RegraRemanejamentoCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO,
    );
    expect(
      regraDesabilitada(
        pagina.edicao.natureza(),
        RegraRemanejamentoCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO,
      ),
    ).toBe(false);
    expect(
      regraDesabilitada(pagina.edicao.natureza(), RegraRemanejamentoCodigo.DESTINO_UNICO),
    ).toBe(true);
    expect(regraDesabilitada(pagina.edicao.natureza(), RegraRemanejamentoCodigo.CRUZADO)).toBe(
      true,
    );
  });

  it('ModalidadeForm_Natureza_AcaoAfirmativaOfertaDestinoOuCruzado', async () => {
    await pagina.montar();
    pagina.setControl('naturezaLegal', 'ACAO_AFIRMATIVA');
    pagina.edicao.aoMudarNatureza();
    expect(
      regraDesabilitada(
        pagina.edicao.natureza(),
        RegraRemanejamentoCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO,
      ),
    ).toBe(true);
    expect(
      regraDesabilitada(pagina.edicao.natureza(), RegraRemanejamentoCodigo.DESTINO_UNICO),
    ).toBe(false);
    expect(regraDesabilitada(pagina.edicao.natureza(), RegraRemanejamentoCodigo.CRUZADO)).toBe(
      false,
    );
    // Regra passa a ser obrigatória.
    expect(pagina.edicao.form.controls.regraRemanejamento.invalid).toBe(true);
  });

  it('ModalidadeForm_RetiradaDeOutraModalidade_ExigeOrigem', async () => {
    await pagina.montar();
    pagina.setControl('composicaoVagas', 'RETIRADA_DE_OUTRA_MODALIDADE');
    pagina.edicao.aoMudarComposicao();
    expect(pagina.edicao.mostraOrigem()).toBe(true);
    expect(pagina.edicao.form.controls.composicaoOrigem.invalid).toBe(true);
    pagina.edicao.form.controls.composicaoOrigem.setValue('AC');
    expect(pagina.edicao.form.controls.composicaoOrigem.valid).toBe(true);
    // Voltar para outra composição limpa e desobriga a origem.
    pagina.setControl('composicaoVagas', 'RESTANTE_DAS_VAGAS_OFERTADAS');
    pagina.edicao.aoMudarComposicao();
    expect(pagina.edicao.mostraOrigem()).toBe(false);
    expect(pagina.edicao.form.controls.composicaoOrigem.value).toBe('');
  });

  it('ModalidadeForm_Args_PorRegra', async () => {
    await pagina.montar();
    pagina.setControl('naturezaLegal', 'ACAO_AFIRMATIVA');
    pagina.edicao.aoMudarNatureza();
    pagina.setControl('regraRemanejamento', 'DESTINO_UNICO');
    pagina.edicao.aoMudarRegra();
    expect(pagina.edicao.mostraDestino()).toBe(true);
    expect(pagina.edicao.mostraParFallback()).toBe(false);
    expect(pagina.edicao.form.controls.remanejamentoDestino.invalid).toBe(true);

    pagina.setControl('remanejamentoDestino', 'AC');
    pagina.setControl('regraRemanejamento', 'CRUZADO');
    pagina.edicao.aoMudarRegra();
    // Destino é limpo; par e fallback passam a ser exigidos.
    expect(pagina.edicao.form.controls.remanejamentoDestino.value).toBe('');
    expect(pagina.edicao.mostraParFallback()).toBe(true);
    expect(pagina.edicao.form.controls.remanejamentoPar.invalid).toBe(true);
    expect(pagina.edicao.form.controls.remanejamentoFallback.invalid).toBe(true);
  });

  it('ModalidadeForm_Codigo_RegexEUnicidade', async () => {
    await pagina.montar();
    const codigo = pagina.edicao.form.controls.codigo;
    codigo.setValue('AB-C');
    expect(codigo.hasError('pattern')).toBe(true);
    codigo.setValue('AB_C');
    expect(codigo.valid).toBe(true);
    // Unicidade entre vivas carregadas.
    codigo.setValue('AC');
    pagina.edicao.verificarCodigoDuplicado();
    expect(codigo.hasError('duplicado')).toBe(true);
  });

  it('ModalidadeForm_Salvar_DescartaARecusaDoServidorSemPerderOCodigoRepetido', async () => {
    await pagina.montar();
    const codigo = pagina.edicao.form.controls.codigo;
    codigo.setValue('AC');
    marcarRecusaDoServidor(codigo, 'uniplus.configuracao.modalidade.codigo_ja_existe', 'Recusado.');

    pagina.edicao.salvar();

    expect(codigo.hasError('backend')).toBe(false);
    expect(codigo.hasError('duplicado')).toBe(true);
  });

  it('ModalidadeForm_Codigo_ReadonlyNaEdicao', async () => {
    pagina.usarRota('id-lb');
    await pagina.montar();
    const obter = pagina.controller.expectOne(`${URL}/id-lb`);
    obter.flush(LB_PPI);
    await new Promise((resolve) => setTimeout(resolve, 0));
    pagina.fixture.detectChanges();
    expect(pagina.edicao.modoEdicao).toBe(true);
    expect(pagina.edicao.form.controls.codigo.disabled).toBe(true);
    expect(pagina.edicao.form.controls.codigo.value).toBe('LB_PPI');
  });

  it('ModalidadeForm_TrocaNatureza_ResetaDependentes', async () => {
    await pagina.montar();
    pagina.setControl('naturezaLegal', 'ACAO_AFIRMATIVA');
    pagina.edicao.aoMudarNatureza();
    pagina.setControl('regraRemanejamento', 'CRUZADO');
    pagina.edicao.aoMudarRegra();
    pagina.edicao.form.controls.remanejamentoPar.setValue('AC');
    pagina.edicao.form.controls.remanejamentoFallback.setValue('LB_PPI');

    // Trocar para AMPLA com args preenchidos pede confirmação.
    pagina.setControl('naturezaLegal', 'AMPLA');
    pagina.edicao.aoMudarNatureza();
    expect(pagina.edicao.confirmandoReset()).toBe(true);
    expect(pagina.edicao.form.controls.regraRemanejamento.value).toBe('CRUZADO');

    pagina.edicao.confirmarResetNatureza();
    expect(pagina.edicao.confirmandoReset()).toBe(false);
    expect(pagina.edicao.mostraRemanejamento()).toBe(false);
    expect(pagina.edicao.form.controls.regraRemanejamento.value).toBe('');
    expect(pagina.edicao.form.controls.remanejamentoPar.value).toBe('');
    expect(pagina.edicao.form.controls.remanejamentoFallback.value).toBe('');
  });

  it('ModalidadeForm_TrocaNatureza_CancelarPreserva', async () => {
    await pagina.montar();
    pagina.setControl('naturezaLegal', 'ACAO_AFIRMATIVA');
    pagina.edicao.aoMudarNatureza();
    pagina.setControl('regraRemanejamento', 'DESTINO_UNICO');
    pagina.edicao.aoMudarRegra();
    pagina.edicao.form.controls.remanejamentoDestino.setValue('AC');

    pagina.setControl('naturezaLegal', 'COTA_RESERVADA');
    pagina.edicao.aoMudarNatureza();
    expect(pagina.edicao.confirmandoReset()).toBe(true);

    pagina.edicao.cancelarResetNatureza();
    // Reverte a natureza e preserva os campos.
    expect(pagina.edicao.form.controls.naturezaLegal.value).toBe('ACAO_AFIRMATIVA');
    expect(pagina.edicao.form.controls.remanejamentoDestino.value).toBe('AC');
  });

  it('ModalidadeForm_TrocaNatureza_CascataAutoNaoPrompt', async () => {
    await pagina.montar();
    pagina.setControl('naturezaLegal', 'COTA_RESERVADA');
    pagina.edicao.aoMudarNatureza();
    // regra auto-preenchida SEGUE_CASCATA, sem argumentos digitados pelo usuário.
    pagina.setControl('naturezaLegal', 'ACAO_AFIRMATIVA');
    pagina.edicao.aoMudarNatureza();
    // Não pede confirmação (nada do usuário a descartar); aplica direto.
    expect(pagina.edicao.confirmandoReset()).toBe(false);
    expect(pagina.edicao.form.controls.naturezaLegal.value).toBe('ACAO_AFIRMATIVA');
    expect(pagina.edicao.form.controls.regraRemanejamento.value).toBe('');
    expect(
      regraDesabilitada(
        pagina.edicao.natureza(),
        RegraRemanejamentoCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO,
      ),
    ).toBe(true);
  });

  it('montarComandoCriar anula campos inaplicáveis por coerência', async () => {
    await pagina.montar();
    pagina.setControl('codigo', 'AC2');
    pagina.setControl('naturezaLegal', 'AMPLA');
    pagina.edicao.aoMudarNatureza();
    pagina.setControl('composicaoVagas', 'RESTANTE_DAS_VAGAS_OFERTADAS');
    pagina.edicao.aoMudarComposicao();
    const cmd = comandoDeCriacao(pagina.edicao.form.getRawValue(), []);
    expect(cmd.codigo).toBe('AC2');
    expect(cmd.remanejamento).toBeNull();
    expect(cmd.composicaoOrigem).toBeNull();
  });

  it('CA-02: cria modalidade válida (POST com Idempotency-Key)', async () => {
    await pagina.montar();
    pagina.setControl('codigo', 'V');
    pagina.setControl('descricao', 'PcD ampla concorrência');
    pagina.setControl('naturezaLegal', 'ACAO_AFIRMATIVA');
    pagina.edicao.aoMudarNatureza();
    pagina.setControl('composicaoVagas', 'RETIRADA_DE_OUTRA_MODALIDADE');
    pagina.edicao.aoMudarComposicao();
    pagina.setControl('composicaoOrigem', 'AC');
    pagina.setControl('regraRemanejamento', 'DESTINO_UNICO');
    pagina.edicao.aoMudarRegra();
    pagina.setControl('remanejamentoDestino', 'AC');

    pagina.edicao.salvar();
    const post = pagina.controller.expectOne(`${BASE}/api/configuracao/admin/modalidades`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body.codigo).toBe('V');
    expect(post.request.body.composicaoOrigem).toBe('AC');
    expect(post.request.body.remanejamento.destino).toBe('AC');
    expect(post.request.body.remanejamento.regra).toBe('DESTINO_UNICO');
    post.flush('novo-id', { status: 201, statusText: 'Created' });
  });

  it('CA-05: código inválido bloqueia o submit (sem POST)', async () => {
    await pagina.montar();
    pagina.setControl('codigo', '');
    pagina.edicao.salvar();
    pagina.controller.expectNone(`${BASE}/api/configuracao/admin/modalidades`);
    expect(pagina.edicao.form.controls.codigo.invalid).toBe(true);
  });
});
