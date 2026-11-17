import { describe, expect, it } from 'vitest';

import { documentoSemNada, exemploDoContrato, NOMES_DOS_EXEMPLOS } from '../exemplos.testing';
import { edicaoDoPasso, valoresDoFormulario } from './tipo-processo.adaptador';

describe('adaptador do passo Tipo do processo', () => {
  it.each(NOMES_DOS_EXEMPLOS)('devolve o exemplo %s idêntico depois de ler e editar', (nome) => {
    const documento = exemploDoContrato(nome);

    expect(edicaoDoPasso(valoresDoFormulario(documento))(documento)).toEqual(documento);
  });

  it('lê o código e o nome que o processo gravou', () => {
    const valores = valoresDoFormulario(exemploDoContrato('inscricao-pelo-sistema'));

    expect(valores).toEqual({ codigo: 'PSR', nomeGravado: 'Processo Seletivo Regular' });
  });

  it('lê tipo ausente como não escolhido, sem inventar código', () => {
    expect(valoresDoFormulario(documentoSemNada())).toEqual({ codigo: null, nomeGravado: null });
  });

  it('não cria a identificação quando nenhum tipo foi escolhido', () => {
    const documento = documentoSemNada();

    expect(edicaoDoPasso({ codigo: null, nomeGravado: null })(documento)).toBe(documento);
  });

  it('escolher outro tipo troca o código e descarta o nome do tipo anterior', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');

    const editado = edicaoDoPasso({ codigo: 'PSE', nomeGravado: null })(documento);

    expect(editado.identificacao?.tipoProcessoCodigo).toBe('PSE');
    expect(editado.identificacao?.tipoProcessoNome).toBeUndefined();
    expect(editado.identificacao?.nome).toBe(documento.identificacao?.nome);
  });

  it('limpar a escolha remove o código em vez de gravar texto vazio', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');

    const editado = edicaoDoPasso({ codigo: null, nomeGravado: null })(documento);

    expect(editado.identificacao).not.toHaveProperty('tipoProcessoCodigo');
    expect(editado.identificacao).not.toHaveProperty('tipoProcessoNome');
  });

  it('devolve intacto tudo o que o passo não edita e não altera o documento recebido', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const antes = structuredClone(documento);

    const editado = edicaoDoPasso({ codigo: 'PSE', nomeGravado: null })(documento);

    expect({ ...editado, identificacao: undefined }).toEqual({
      ...antes,
      identificacao: undefined,
    });
    expect(documento).toEqual(antes);
  });
});
