# **App Name**: NRH - GMVV

## Core Features:

- Autenticação Segura e Onboarding de Usuário: Facilita o login do usuário via QRA e senha, e gerencia o fluxo de 'Primeiro Acesso' onde novos usuários se registram com um código de validação, atualizam seu perfil e criam credenciais de Autenticação Firebase vinculadas ao seu registro no Firestore.
- Administrador: Cadastro de Funcionários e Geração de QRA: Permite aos administradores registrar novos funcionários de forma segura no sistema, gerando automaticamente identificadores QRA (Consulta de Registro) únicos e códigos de validação para o onboarding inicial do usuário.
- Visão Geral Dinâmica do Painel: Apresenta uma visualização inicial personalizada com indicadores-chave de desempenho e resumos, como total de pessoal efetivo, lançamentos recentes, solicitações pendentes e resumos de atividades.
- Controle Centralizado de Dados: Fornece aos administradores uma página estruturada contendo tabelas dinâmicas para visualizar e gerenciar dados de funcionários, com formulários modais para criar e atualizar registros que refletem as alterações em tempo real.
- Perfil Pessoal e Relatório Individual: Permite que usuários individuais acessem e atualizem suas informações pessoais e de contato, foto, e visualizem um relatório abrangente de seus dados, incluindo seu 'Banco de Horas' em formato tabular.
- Sistema de Solicitação Operacional: Oferece formulários dedicados para funcionários enviarem várias solicitações operacionais, como folgas, férias ou permuta de serviço, cada uma adaptada a requisitos específicos.
- Assistente de Resposta Alimentado por IA: Uma ferramenta administrativa que aproveita a IA para sugerir rascunhos de respostas ou atualizações de status para solicitações operacionais enviadas, fornecendo uma base para uma comunicação mais rápida e consistente.

## Style Guidelines:

- Cor primária (menu, botões): Azul Royal (#1A56DB), simbolizando confiabilidade e profissionalismo. Tonalidade 221, saturação 79%, luminosidade 47%.
- Cor de fundo (geral): Azul-cinza claro dessaturado (#F3F4F6), criando uma sensação de limpeza e espaço. Tonalidade 220, saturação 25%, luminosidade 96%.
- Cor de destaque (realces): Ciano Energético (#61DAE3), proporcionando interesse visual e chamando a atenção para elementos interativos. Tonalidade 190, saturação 70%, luminosidade 65%.
- Fonte principal: 'Inter' (sans-serif), escolhida por suas linhas modernas e limpas e excelente legibilidade em várias telas e densidades de texto, adequada para títulos e corpo de texto.
- Utilize um conjunto de ícones claros e universalmente reconhecíveis para elementos de navegação, ações dentro de tabelas e indicadores de status, mantendo a consistência com uma estética moderna e profissional.
- Implemente um design responsivo com um menu de navegação lateral persistente. As áreas de conteúdo usarão um layout baseado em cartões com sombras suaves ('box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1)') para blocos de informação distintos e modais para envio de formulários.
- Incorpore animações de transição sutis e rápidas para expansões de menu, aberturas de modais e atualizações de dados em tabelas para aprimorar a experiência do usuário sem causar distração ou atrasos.