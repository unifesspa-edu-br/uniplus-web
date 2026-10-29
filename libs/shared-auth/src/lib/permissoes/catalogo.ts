/**
 * Códigos de permissão que a interface consulta, no formato `{módulo}:{recurso}:{ação}` do
 * catálogo da API. Cada tela declara aqui o que exige; a decisão de acesso segue sendo da API.
 */
export const PERMISSAO = {
  autorizacao: {
    concessoesAdministrar: 'autorizacao:concessoes:administrar',
    pedidosAprovarFuncional: 'autorizacao:pedidos:aprovar-funcional',
    pedidosAprovarProtecaoDeDados: 'autorizacao:pedidos:aprovar-protecao-de-dados',
    perfisManter: 'autorizacao:perfis:manter',
  },
  configuracao: {
    baseLegalBonusRegionalManter: 'configuracao:base-legal-bonus-regional:manter',
    calendariosDiasUteisManter: 'configuracao:calendarios-dias-uteis:manter',
    campiManter: 'configuracao:campi:manter',
    condicoesAtendimentoManter: 'configuracao:condicoes-atendimento:manter',
    cursosManter: 'configuracao:cursos:manter',
    fasesCanonicasManter: 'configuracao:fases-canonicas:manter',
    fatosCandidatoConsultar: 'configuracao:fatos-candidato:consultar',
    fatosCandidatoManter: 'configuracao:fatos-candidato:manter',
    locaisOfertaManter: 'configuracao:locais-oferta:manter',
    modalidadesManter: 'configuracao:modalidades:manter',
    modelosFormularioConsultar: 'configuracao:modelos-formulario:consultar',
    modelosFormularioManter: 'configuracao:modelos-formulario:manter',
    ofertasCursoManter: 'configuracao:ofertas-curso:manter',
    pesosAreaEnemManter: 'configuracao:pesos-area-enem:manter',
    precedenciasFaseManter: 'configuracao:precedencias-fase:manter',
    recursosAcessibilidadeManter: 'configuracao:recursos-acessibilidade:manter',
    referenciasReservaDemograficaManter: 'configuracao:referencias-reserva-demografica:manter',
    termosConsentimentoManter: 'configuracao:termos-consentimento:manter',
    tiposBancaManter: 'configuracao:tipos-banca:manter',
    tiposDeficienciaManter: 'configuracao:tipos-deficiencia:manter',
    tiposDocumentoManter: 'configuracao:tipos-documento:manter',
    tiposEtapaManter: 'configuracao:tipos-etapa:manter',
    tiposProcessoConsultar: 'configuracao:tipos-processo:consultar',
    tiposProcessoManter: 'configuracao:tipos-processo:manter',
  },
  organizacao: {
    instituicaoManter: 'organizacao:instituicao:manter',
    unidadesManter: 'organizacao:unidades:manter',
  },
  publicacoes: {
    tiposAtoManter: 'publicacoes:tipos-ato:manter',
  },
  selecao: {
    documentosPessoaisConsultar: 'selecao:documentos-pessoais:consultar',
    documentosSensiveisConsultar: 'selecao:documentos-sensiveis:consultar',
    enviosInepGerar: 'selecao:envios-inep:gerar',
    inscricoesConsultar: 'selecao:inscricoes:consultar',
    inscricoesRevelarCpf: 'selecao:inscricoes:revelar-cpf',
    leiautesInepConsultar: 'selecao:leiautes-inep:consultar',
    motivosDecisaoIsencaoManter: 'selecao:motivos-decisao-isencao:manter',
    notasEnemImportar: 'selecao:notas-enem:importar',
    obrigatoriedadesLegaisManter: 'selecao:obrigatoriedades-legais:manter',
    processosAcompanhar: 'selecao:processos:acompanhar',
    processosConfigurar: 'selecao:processos:configurar',
    processosPublicar: 'selecao:processos:publicar',
    regrasCatalogoConsultar: 'selecao:regras-catalogo:consultar',
  },
} as const;

type Valores<T> = T extends string ? T : { [K in keyof T]: Valores<T[K]> }[keyof T];

/** União dos códigos declarados em {@link PERMISSAO}. */
export type CodigoDePermissao = Valores<typeof PERMISSAO>;

/** Módulos que têm permissão declarada em {@link PERMISSAO}. */
export type ModuloDePermissao = keyof typeof PERMISSAO;
