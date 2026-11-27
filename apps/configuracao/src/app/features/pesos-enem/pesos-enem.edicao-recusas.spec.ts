import { TestBed } from '@angular/core/testing';
import { ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { linhas805 } from './pesos-enem-exemplos.testing';
import {
  NAO_ENCONTRADO,
  NAO_PROCESSAVEL,
  PROBLEMA_LINHA_NAO_ENCONTRADA,
  PROBLEMA_PESO_EXCEDE_MAXIMO,
  PROIBIDO,
  SEM_CORPO,
  confirmarSemCorpo,
  flushProblema,
  problem,
} from './pesos-enem-respostas.testing';
import { PaginaDeTeste, areaDo, erroDaArea } from './pesos-enem.testing';

describe('PesosEnemPage — recusas no envio da edição', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());

  // Durante o envio os campos ficam desabilitados: uma edição feita depois de o corpo partir não
  // pode aparecer como gravada. O estado dos controles não muda; o fieldset da grade os desabilita.
  it('PesosEnemPage_Salvar_DesabilitaInputsDuranteEnvioEReabilitaSoALinhaComFalha', async () => {
    await t.carregarUmaPagina([...linhas805]);
    const { primeira, demais } = await t.enviarEdicaoPeloModelo();
    t.conferirCamposDaGradeDesabilitados();
    expect(t.linhasEmEdicaoDesabilitadas()).toEqual([false, false, false, false]);
    flushProblema(primeira, NAO_PROCESSAVEL, PROBLEMA_PESO_EXCEDE_MAXIMO);
    demais.forEach(confirmarSemCorpo);
    await t.atualizarAplicacao();
    expect(t.linhasEmEdicaoDesabilitadas().slice(0, 2)).toEqual([false, true]);
    expect(
      t.elementoDaPagina.querySelector<HTMLFieldSetElement>('.pe-grid fieldset')?.disabled,
    ).toBe(false);
  });

  it('PesosEnemPage_RecusaSemErrorsNaEdicao_VaiAoBannerSemMarcarCampo', async () => {
    await t.carregarUmaPagina([...linhas805]);
    const { primeira, demais } = await t.enviarEdicaoPeloModelo();
    flushProblema(primeira, NAO_ENCONTRADO, PROBLEMA_LINHA_NAO_ENCONTRADA);
    demais.forEach(confirmarSemCorpo);
    await t.atualizarAplicacao();
    const naoEncontrado = JSON.parse(PROBLEMA_LINHA_NAO_ENCONTRADA) as ProblemDetails;
    const titulo = TestBed.inject(ProblemI18nService).resolve(naoEncontrado).title;
    expect(t.edicao.erro()).toContain(titulo);
    const grupo = t.formularioDaEdicao().controls[0];
    expect(erroDaArea(areaDo(grupo, 'REDACAO'), 'peso')).toBeNull();
    expect(t.formularioDaEdicao().invalid).toBe(false);
  });

  it('PesosEnemPage_RecusaSemCampoNaEdicao_BannerEhRegiaoViva', async () => {
    await t.carregarUmaPagina([...linhas805]);
    const { primeira, demais } = await t.enviarEdicaoPeloModelo();
    flushProblema(primeira, NAO_ENCONTRADO, PROBLEMA_LINHA_NAO_ENCONTRADA);
    demais.forEach(confirmarSemCorpo);
    await t.propagar();
    const banner = t.elementoDaPagina.querySelector('#grid-pe-bar .alert [role="alert"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain(t.edicao.erro() ?? '<sem mensagem>');
  });

  // A API guarda a recusa 4xx: reenviar o mesmo corpo com a mesma chave devolveria a mesma
  // recusa, mesmo depois de a causa externa ter sido resolvida.
  it('PesosEnemPage_EdicaoEmLinha_RecusaDefinitivaSemErrors_ReenvioIgualSaiComChaveNova', async () => {
    await t.carregarUmaPagina([...linhas805]);
    const { primeira, demais } = await t.enviarEdicaoPeloModelo();
    const chaveOriginal = primeira.request.headers.get('Idempotency-Key');
    flushProblema(primeira, PROIBIDO, problem(403, 'uniplus.auth.forbidden', 'Sem permissão'));
    demais.forEach(confirmarSemCorpo);
    await t.atualizarAplicacao();
    t.edicao.salvar();
    await t.atualizarAplicacao();
    const retry = t.controller.expectOne(primeira.request.url);
    expect(retry.request.headers.get('Idempotency-Key')).not.toBe(chaveOriginal);
    retry.flush(null, SEM_CORPO);
    await t.atualizarAplicacao();
  });
});
