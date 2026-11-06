import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  ID,
  Pagina,
  criado,
  montarPagina,
  problema,
  recusaDeCampo,
  sucesso,
  unifesspa,
} from './instituicao.testing';

const JA_EXISTE = {
  code: 'uniplus.organizacao.instituicao.ja_existe',
  title: 'Já existe uma instituição cadastrada — a plataforma atende uma única instituição',
};
const PROCESSANDO = {
  code: 'uniplus.idempotency.processing_conflict',
  title: 'Uma requisição idêntica ainda está em processamento',
};
const RAIZ_NAO_EH_REITORIA = {
  code: 'uniplus.organizacao.instituicao.unidade_raiz_nao_eh_reitoria',
  title: 'A unidade informada como raiz da instituição deve ser do tipo reitoria',
};
const RAIZ_NAO_ENCONTRADA = {
  code: 'uniplus.organizacao.instituicao.unidade_raiz_nao_encontrada',
  title: 'A unidade informada como raiz não foi encontrada ou foi removida',
};
const RAIZ_DE_OUTRO_AGREGADO = {
  code: 'uniplus.organizacao.unidade.unidade_raiz_orfa',
  title: 'Unidade raiz órfã em outro agregado',
};

describe('InstituicaoPage — recusas do servidor ao salvar', () => {
  let p: Pagina;

  const chaveDe = (req: { request: { headers: { get(n: string): string | null } } }) =>
    req.request.headers.get('Idempotency-Key');
  const alertaDoDrawer = (): HTMLElement => p.elemento('ui-drawer ui-alert');
  const semCampoMarcado = (): boolean =>
    p.fixture.nativeElement.querySelector('.field.is-error') === null;

  const cancelarDoFormulario = async (): Promise<void> => {
    const cancelar = [
      ...p.fixture.nativeElement.querySelectorAll('.form-drawer__footer button'),
    ].find((b) => (b as HTMLElement).textContent?.trim() === 'Cancelar') as HTMLButtonElement;
    cancelar.focus();
    cancelar.click();
    await p.propagar();
    await p.propagar();
  };

  afterEach(() => p.http.verify());

  describe('na edição', () => {
    beforeEach(async () => {
      p = await montarPagina();
      await p.abrirFormulario();
    });

    it.each([
      [RAIZ_NAO_EH_REITORIA, 'reitoria'],
      [RAIZ_NAO_ENCONTRADA, 'não foi encontrada'],
    ])(
      'a unidade raiz recusada (%#) marca o select, renova a chave e não vai ao alerta',
      async (recusa, trecho) => {
        const primeira = await p.enviar(`${ESCRITA}/${ID}`);
        const chave = chaveDe(primeira);
        primeira.flush(...problema(422, recusa));
        await p.propagar();
        await p.propagar();

        const select = p.elemento<HTMLSelectElement>('select[formcontrolname="unidadeRaizId"]');
        expect(select.getAttribute('aria-invalid')).toBe('true');
        expect(p.elemento('#cfg-instituicao-unidadeRaizId-erro').textContent).toContain(trecho);
        expect(p.edicao.erro()).toBeNull();
        expect(p.erros).not.toHaveBeenCalled();
        expect(chaveDe(await p.enviar(`${ESCRITA}/${ID}`))).not.toBe(chave);
      },
    );

    it('o código de unidade raiz de outro agregado não ancora no select: vai ao alerta', async () => {
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(...problema(422, RAIZ_DE_OUTRO_AGREGADO));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain(RAIZ_DE_OUTRO_AGREGADO.title);
      expect(semCampoMarcado()).toBe(true);
    });

    it('a recusa de campo opcional aparece no campo, associada e focada, sem toast', async () => {
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(...recusaDeCampo('Cnpj', 'CNPJ inválido.'));
      await p.propagar();
      await p.propagar();

      expect(p.campo('cnpj').getAttribute('aria-invalid')).toBe('true');
      expect(p.elemento('#cfg-instituicao-cnpj-erro').textContent?.trim()).toBe('CNPJ inválido.');
      expect(p.campo('cnpj').getAttribute('aria-describedby')).toBe('cfg-instituicao-cnpj-erro');
      expect(document.activeElement).toBe(p.campo('cnpj'));
      expect(p.elemento('ui-drawer [role="status"]').textContent).toContain('Revise os campos');
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('a recusa só do endereço aparece no bloco do endereço, não no alerta', async () => {
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(
        ...problema(422, {
          code: 'uniplus.validacao',
          errors: [
            {
              field: 'CidadeCodigoIbge',
              code: 'uniplus.endereco_referencia.cidade_incoerente',
              message: 'A cidade não corresponde ao CEP informado.',
            },
          ],
        }),
      );
      await p.propagar();

      expect(p.elemento('ui-endereco-geo').textContent).toContain(
        'A cidade não corresponde ao CEP informado.',
      );
      expect(p.edicao.erro()).toBeNull();
    });

    it('a recusa de campo que o formulário não tem vai ao alerta com a orientação de revisar', async () => {
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(...recusaDeCampo('Inexistente', 'Recusado.'));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain(
        'Não foi possível mapear os erros de validação.',
      );
    });

    it('conflito de processamento mantém a chave e mostra a mensagem no alerta, sem marcar campo', async () => {
      const primeira = await p.enviar(`${ESCRITA}/${ID}`);
      const chave = chaveDe(primeira);
      primeira.flush(...problema(409, PROCESSANDO));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain(PROCESSANDO.title);
      expect(semCampoMarcado()).toBe(true);
      expect(p.erros).not.toHaveBeenCalled();
      const segunda = await p.enviar(`${ESCRITA}/${ID}`);
      expect(chaveDe(segunda)).toBe(chave);
      segunda.flush(...sucesso());
      await p.responderLeitura(unifesspa);
    });

    it('corpo divergente da chave vai ao alerta e renova a chave', async () => {
      const primeira = await p.enviar(`${ESCRITA}/${ID}`);
      const chave = chaveDe(primeira);
      primeira.flush(
        ...problema(422, { code: 'uniplus.idempotency.body_mismatch', title: 'Corpo divergente' }),
      );
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain('Corpo divergente');
      expect(chaveDe(await p.enviar(`${ESCRITA}/${ID}`))).not.toBe(chave);
    });

    it('instituição não encontrada vai ao alerta, sem toast, e a tela relê o que o servidor tem', async () => {
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(
        ...problema(404, { code: 'uniplus.organizacao.instituicao.nao_encontrada' }),
      );
      await p.propagar();

      expect(alertaDoDrawer()).toBeTruthy();
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.edicao.gravando()).toBe(true);
      await p.responderLeitura(null);
      expect(p.edicao.gravando()).toBe(false);
      expect(p.store.naoCadastrada()).toBe(true);
      expect(p.fixture.nativeElement.querySelector('.cfg-instituicao__ficha')).toBeNull();
    });

    it('instituição não encontrada, sem nenhuma cadastrada: cancelar leva o foco a "Cadastrar instituição"', async () => {
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(
        ...problema(404, { code: 'uniplus.organizacao.instituicao.nao_encontrada' }),
      );
      await p.propagar();
      await p.responderLeitura(null);

      await cancelarDoFormulario();

      expect(p.edicao.aberto()).toBe(false);
      expect(p.acao().textContent).toContain('Cadastrar instituição');
      expect(document.activeElement).toBe(p.acao());
    });

    it('releitura com falha após a recusa: cancelar leva o foco ao título da página', async () => {
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(
        ...problema(404, { code: 'uniplus.organizacao.instituicao.nao_encontrada' }),
      );
      await p.propagar();
      await p.falharLeitura(500);

      await cancelarDoFormulario();

      expect(p.edicao.aberto()).toBe(false);
      expect(document.activeElement).toBe(p.elemento('#cfg-instituicao-titulo-da-pagina'));
    });

    it('falha 5xx vai ao alerta, avisa por toast e mantém a chave para o reenvio', async () => {
      const primeira = await p.enviar(`${ESCRITA}/${ID}`);
      const chave = chaveDe(primeira);
      primeira.flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();

      expect(alertaDoDrawer()).toBeTruthy();
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(chaveDe(await p.enviar(`${ESCRITA}/${ID}`))).toBe(chave);
    });

    it('recusa seguida de sucesso: o reenvio usa chave nova, fecha e devolve o foco', async () => {
      const primeira = await p.enviar(`${ESCRITA}/${ID}`);
      const chave = chaveDe(primeira);
      primeira.flush(...recusaDeCampo('Cnpj', 'CNPJ inválido.'));
      await p.propagar();
      await p.propagar();
      p.preencher('cnpj', '');

      const segunda = await p.enviar(`${ESCRITA}/${ID}`);
      expect(chaveDe(segunda)).not.toBe(chave);
      segunda.flush(...sucesso());
      await p.responderLeitura(unifesspa);

      expect(p.edicao.aberto()).toBe(false);
      expect(document.activeElement).toBe(p.acao());
    });

    it('um novo envio, ainda que barrado pela validação, retira a recusa anterior da tela', async () => {
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(
        ...problema(500, { code: 'uniplus.internal.unexpected' }),
      );
      await p.propagar();
      expect(alertaDoDrawer()).toBeTruthy();

      p.preencher('nome', '');
      p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('ui-drawer ui-alert')).toBeNull();
      p.http.expectNone((r) => r.method === 'PUT');
    });
  });

  describe('no cadastro', () => {
    beforeEach(async () => {
      p = await montarPagina(null);
      await p.abrirCadastro();
    });

    it('a segunda criação mostra o aviso de registro único, renova a chave e não avisa por toast', async () => {
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(...problema(409, JA_EXISTE));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain(
        'Já existe uma instituição cadastrada nesta instância',
      );
      expect(alertaDoDrawer().textContent).toContain('primeiro remova a existente');
      expect(semCampoMarcado()).toBe(true);
      expect(p.erros).not.toHaveBeenCalled();
      await p.responderLeitura(unifesspa);
      expect(p.store.instituicao()).toEqual(unifesspa);
      expect(p.fixture.nativeElement.querySelector('.cfg-instituicao__ficha')).not.toBeNull();
      expect(chaveDe(await p.enviar())).not.toBe(chave);
    });

    it('a segunda criação, com a instituição relida: cancelar leva o foco a "Editar"', async () => {
      (await p.enviar()).flush(...problema(409, JA_EXISTE));
      await p.propagar();
      await p.responderLeitura(unifesspa);

      await cancelarDoFormulario();

      expect(p.edicao.aberto()).toBe(false);
      expect(p.acao().textContent).toContain('Editar');
      expect(document.activeElement).toBe(p.acao());
    });

    it('o conflito de processamento não é confundido com a segunda criação', async () => {
      (await p.enviar()).flush(...problema(409, PROCESSANDO));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain(PROCESSANDO.title);
      expect(alertaDoDrawer().textContent).not.toContain('Já existe uma instituição cadastrada');
    });

    it('recusa seguida de sucesso devolve o foco ao botão que abriu o formulário', async () => {
      (await p.enviar()).flush(...recusaDeCampo('Cnpj', 'CNPJ inválido.'));
      await p.propagar();
      await p.propagar();
      p.preencher('cnpj', '');
      (await p.enviar()).flush(...criado());
      await p.responderLeitura(unifesspa);

      expect(p.edicao.aberto()).toBe(false);
      expect(document.activeElement).toBe(p.acao());
    });
  });
});
