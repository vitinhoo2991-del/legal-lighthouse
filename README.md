# Legal Lighthouse

Quero construir um SaaS profissional chamado temporariamente de:

JurisIA

Slogan:

"A inteligência que transforma o atendimento jurídico."

IMPORTANTE:

Estou construindo uma plataforma SaaS para escritórios de advocacia.

A plataforma terá futuramente:

- Inteligência Artificial para atendimento

- WhatsApp oficial

- CRM jurídico

- qualificação automática de leads

- multiatendimento

- agenda

- documentos

- base de conhecimento

- IA de voz

- follow-ups

- captação multicanal

- analytics

- financeiro

- equipe e permissões

- monitoramento processual

- copiloto jurídico

- assinaturas e planos SaaS

PORÉM, NESTA PRIMEIRA ETAPA NÃO IMPLEMENTE ESSAS FUNCIONALIDADES AVANÇADAS.

Nesta etapa vamos construir a FUNDAÇÃO REAL do produto.

A fundação precisa ser planejada desde o início para suportar todas essas funcionalidades futuramente sem necessidade de reconstruir a aplicação.

Não quero uma landing page ou protótipo.

Quero a estrutura inicial de um SaaS real, funcional, escalável, seguro e profissional.

==================================================

1. REFERÊNCIA VISUAL E CONCEITO

==================================================

As imagens anexadas nesta conversa mostram a interface de uma plataforma concorrente chamada Sábio Adv.

Use as imagens SOMENTE como referência para entender:

- conceito de CRM jurídico

- organização de leads

- pipeline

- atendimento

- informações de clientes

- captação multicanal

- aparência de um software jurídico moderno

NÃO copie:

- logo

- nome

- identidade visual

- textos

- elementos proprietários

- layout exatamente igual

- componentes visuais específicos

Quero criar uma identidade própria e mais moderna.

A nossa plataforma deve parecer um produto SaaS premium.

Referências conceituais:

HubSpot

Intercom

Linear

Notion

Stripe

CRMs modernos

softwares jurídicos premium

Misturar:

tecnologia + inteligência artificial + jurídico + simplicidade.

==================================================

2. IDENTIDADE VISUAL

==================================================

Nome:

JurisIA

Criar uma identidade visual moderna.

Evitar aparência de:

- sistema governamental

- software antigo

- template administrativo genérico

- painel excessivamente colorido

Visual desejado:

- sofisticado

- tecnológico

- minimalista

- premium

- profissional

- confiável

- elegante

Usar uma paleta predominantemente escura/neutra com uma cor de destaque relacionada à tecnologia/IA.

Não exagerar em efeitos neon.

Usar:

- cards modernos

- bordas sutis

- sombras discretas

- boa hierarquia visual

- tipografia moderna

- espaçamento generoso

- ícones consistentes

==================================================

3. PRINCÍPIO FUNDAMENTAL DO PRODUTO

==================================================

A plataforma deve ser construída ao redor de três grandes áreas:

1. CENTRAL DE ATENDIMENTO

2. CENTRAL DE GESTÃO

3. CENTRAL DE INTELIGÊNCIA

A navegação deverá refletir esse conceito.

CENTRAL DE ATENDIMENTO:

- Conversas

- WhatsApp

- Atendimento IA

- Multiatendimento

CENTRAL DE GESTÃO:

- Dashboard

- Leads

- Clientes

- CRM

- Agenda

- Documentos

- Processos

- Financeiro

- Relatórios

- Equipe

CENTRAL DE INTELIGÊNCIA:

- IA

- Agentes de IA

- Base de conhecimento

- Copiloto

- Insights

Nesta primeira etapa, apenas criar a estrutura visual/navegação dessas áreas.

==================================================

4. TECNOLOGIA

==================================================

Frontend:

React

TypeScript

Tailwind CSS

Utilizar componentes reutilizáveis.

Backend:

Supabase

Utilizar:

- Supabase Auth

- PostgreSQL

- Row Level Security

- Supabase Storage

- Edge Functions quando necessário futuramente

A arquitetura deve ser preparada para integrações externas.

==================================================

5. SAAS MULTI-TENANT

==================================================

ESTA É UMA DAS PARTES MAIS IMPORTANTES.

A plataforma será vendida para vários escritórios.

Cada escritório será um tenant completamente isolado.

Criar entidade:

offices

Cada escritório terá seu próprio:

- usuários

- leads

- clientes

- conversas

- mensagens

- agenda

- documentos

- processos

- configurações

- agentes IA

- base de conhecimento

- financeiro

Todos os dados relacionados a um escritório devem possuir:

office_id

O isolamento deve ser garantido pelo banco através de Row Level Security.

NÃO confiar somente no frontend.

Um usuário do Escritório A jamais poderá acessar dados do Escritório B.

==================================================

6. BANCO DE DADOS

==================================================

Criar uma estrutura PostgreSQL organizada e preparada para crescimento.

Criar inicialmente:

OFFICES

Campos:

id

name

legal_name

document

email

phone

website

logo_url

address

city

state

zip_code

timezone

status

created_at

updated_at

PROFILES

Campos:

id

auth_user_id

office_id

name

email

phone

avatar_url

role

status

created_at

updated_at

ROLES:

owner

admin

lawyer

assistant

Preparar arquitetura para novas permissões posteriormente.

==================================================

7. ESTRUTURA FUTURA DO BANCO

==================================================

Planejar a arquitetura para posteriormente suportar:

leads

clients

conversations

conversation_participants

messages

message_attachments

appointments

documents

document_folders

processes

process_movements

ai_agents

ai_sessions

knowledge_bases

knowledge_documents

follow_ups

notifications

lead_sources

lead_tags

tags

pipelines

pipeline_stages

financial_transactions

subscriptions

plans

audit_logs

NÃO implementar todas as funcionalidades agora.

Porém, a arquitetura atual não pode impedir essas expansões.

==================================================

8. AUTENTICAÇÃO

==================================================

Implementar autenticação REAL utilizando Supabase Auth.

Criar:

/login

/register

/forgot-password

/reset-password

Fluxo:

Usuário cria conta

↓

Cria escritório

↓

Usuário vira OWNER

↓

Entra no onboarding

↓

Vai para dashboard

==================================================

9. LOGIN

==================================================

Criar uma tela de login premium.

Elementos:

Logo JurisIA

E-mail

Senha

Mostrar/ocultar senha

"Entrar"

"Esqueci minha senha"

"Não possui uma conta? Criar escritório"

Adicionar estados:

loading

erro

sucesso

Não criar autenticação falsa.

==================================================

10. CADASTRO

==================================================

Criar:

"Crie seu escritório"

Campos:

Nome do escritório

Nome do responsável

E-mail

Telefone

Senha

Confirmar senha

Ao criar:

1. criar usuário no Supabase Auth

2. criar office

3. criar profile

4. associar profile ao office_id

5. role = owner

6. iniciar onboarding

==================================================

11. ONBOARDING

==================================================

Criar onboarding em etapas.

ETAPA 1:

"Conte um pouco sobre seu escritório"

Nome

Telefone

Cidade

Estado

Site

Logo

ETAPA 2:

"Quais áreas seu escritório atende?"

Permitir múltiplas seleções:

Trabalhista

Previdenciário

Família

Civil

Consumidor

Empresarial

Tributário

Penal

Imobiliário

Outro

ETAPA 3:

"Como você pretende usar o JurisIA?"

Opções:

Captar mais clientes

Automatizar atendimento

Organizar leads

Gerenciar equipe

Agendar consultas

Centralizar atendimento

ETAPA 4:

"Seu escritório está pronto."

Botão:

"Entrar no JurisIA"

Salvar as informações no banco.

==================================================

12. LAYOUT PRINCIPAL

==================================================

Criar um layout global.

Desktop:

Sidebar esquerda

Header superior

Conteúdo principal

Mobile:

Sidebar transformada em menu mobile.

A sidebar deve ter:

LOGO JURISIA

----------------------

VISÃO GERAL

Dashboard

----------------------

ATENDIMENTO

Conversas

WhatsApp

----------------------

GESTÃO

Leads

Clientes

CRM

Agenda

Documentos

Processos

Financeiro

Relatórios

----------------------

INTELIGÊNCIA

IA

Agentes IA

Base de conhecimento

Copiloto

----------------------

ADMINISTRAÇÃO

Equipe

Configurações

----------------------

Perfil do usuário

==================================================

13. SIDEBAR

==================================================

A sidebar deve ser elegante.

Permitir:

- expandir/recolher

- ícones

- tooltips

- item ativo

- navegação real

Em telas pequenas:

abrir como drawer.

Não deixar a sidebar ocupar espaço excessivo.

==================================================

14. DASHBOARD

==================================================

Criar:

/dashboard

O dashboard deve parecer um verdadeiro centro de comando do escritório.

Header:

"Bom dia, [nome]."

"Veja o que está acontecendo no seu escritório."

Criar cards:

NOVOS LEADS

LEADS QUALIFICADOS

CONSULTAS

CLIENTES

Nesta primeira etapa utilizar:

0

Não criar dados falsos.

Criar empty states elegantes.

==================================================

15. DASHBOARD FUTURO

==================================================

Preparar visualmente espaço para futuramente apresentar:

- leads recebidos

- conversão

- consultas

- contratos

- receita

- origem dos leads

- desempenho da IA

- atendimento humano

- tempo de resposta

Não implementar os dados agora.

==================================================

16. CENTRAL DE ATENDIMENTO

==================================================

Criar rota:

/atendimento

Criar uma tela placeholder profissional.

O layout futuro deverá suportar:

lista de conversas

+

conversa aberta

+

informações do cliente

Estrutura visual:

COLUNA 1:

Conversas

COLUNA 2:

Chat

COLUNA 3:

Perfil do cliente

Não criar mensagens falsas.

Mostrar:

"Suas conversas aparecerão aqui quando o atendimento estiver conectado."

==================================================

17. PERFIL DO CLIENTE

==================================================

Preparar o terceiro painel da Central de Atendimento para futuramente mostrar:

Nome

Telefone

E-mail

Origem

Área jurídica

Lead Score

Status

Tags

Último contato

Documentos

Agendamentos

Histórico

Responsável

Isso deve orientar a arquitetura visual.

==================================================

18. CRM

==================================================

Criar rota:

/crm

Criar uma tela inicial de CRM.

A ideia futura será um pipeline Kanban.

Estrutura:

NOVO LEAD

↓

EM TRIAGEM

↓

QUALIFICADO

↓

EM CONTATO

↓

AGENDADO

↓

PROPOSTA

↓

CONTRATADO

Nesta primeira etapa:

não criar leads fictícios.

Criar estado vazio:

"Seu pipeline está vazio."

"Quando novos leads forem captados, eles aparecerão aqui."

Criar estrutura visual do Kanban.

==================================================

19. LEADS

==================================================

Criar:

/leads

Tela preparada para futuramente mostrar:

Nome

Telefone

Origem

Área jurídica

Status

Lead Score

Responsável

Último contato

Data de criação

Adicionar:

Busca

Filtros

Ordenação

Sem dados falsos.

==================================================

20. CLIENTES

==================================================

Criar:

/clientes

Preparar tabela de clientes.

Filtros:

Nome

Área

Responsável

Status

Empty state profissional.

==================================================

21. AGENDA

==================================================

Criar:

/agenda

Preparar visual para integração futura com:

Google Calendar

Outlook

Calendário interno

Mostrar calendário vazio.

Mensagem:

"Sua agenda aparecerá aqui quando você conectar seu calendário."

==================================================

22. INTELIGÊNCIA ARTIFICIAL

==================================================

Criar:

/ia

A tela deve ser a Central de Inteligência do JurisIA.

Mostrar futuramente:

🤖 Atendimento IA

🧠 Agentes IA

📚 Base de conhecimento

🎙️ Voz

📄 Análise de documentos

⚡ Automações

🧑‍⚖️ Copiloto jurídico

Nesta etapa NÃO conectar nenhuma API de IA.

Criar apenas a estrutura visual.

==================================================

23. DOCUMENTOS

==================================================

Criar:

/documentos

Preparar interface para futuramente armazenar:

RG

CPF

Contratos

Comprovantes

Processos

PDFs

Imagens

Documentos enviados pelo cliente

Criar:

Pastas

Busca

Filtros

Nesta etapa sem documentos fictícios.

==================================================

24. PROCESSOS

==================================================

Criar:

/processos

Criar placeholder profissional.

Futuramente será utilizado para:

Processos

Movimentações

Prazos

Alertas

Resumo por IA

Não criar processos fictícios.

==================================================

25. FINANCEIRO

==================================================

Criar:

/financeiro

Preparar dashboard para futuramente apresentar:

Receita

Despesas

Honorários

Consultas

Inadimplência

Não criar números fictícios.

Mostrar estado:

"Seu financeiro será exibido aqui."

==================================================

26. RELATÓRIOS

==================================================

Criar:

/relatorios

Preparar estrutura para:

Leads

Conversão

Origem

Atendimento

Agendamentos

Clientes

Financeiro

Performance da IA

Nesta etapa não gerar dados falsos.

==================================================

27. EQUIPE

==================================================

Criar:

/equipe

Mostrar membros reais do escritório.

Colunas:

Nome

E-mail

Cargo

Status

Último acesso

Botão:

"+ Adicionar membro"

Roles:

Owner

Administrador

Advogado

Assistente

Apenas usuários do mesmo office_id podem aparecer.

==================================================

28. CONFIGURAÇÕES

==================================================

Criar:

/configuracoes

Abas:

Meu perfil

Escritório

Equipe

Notificações

Segurança

Integrações

Nesta primeira etapa:

Perfil:

editar nome

telefone

avatar

Escritório:

editar nome

telefone

cidade

estado

site

logo

==================================================

29. PERFIL

==================================================

Menu no avatar:

Meu perfil

Configurações

Sair

Implementar logout REAL.

==================================================

30. NOTIFICAÇÕES

==================================================

Criar estrutura para futuramente receber:

Novo lead

Lead qualificado

Consulta agendada

Novo documento

Prazo

Mensagem aguardando resposta

Transferência para advogado

Nesta etapa apenas criar a interface.

==================================================

31. COMPONENTES

==================================================

Criar componentes reutilizáveis:

Button

Input

Select

Modal

Drawer

Card

Badge

Avatar

Tooltip

Dropdown

Table

Tabs

Calendar

Sidebar

Header

Toast

EmptyState

LoadingState

ErrorState

ConfirmDialog

SearchInput

FilterBar

Evitar duplicação de código.

==================================================

32. RESPONSIVIDADE

==================================================

A plataforma precisa funcionar perfeitamente em:

Desktop

Notebook

Tablet

iPhone

Android

No mobile:

- sidebar vira drawer

- cards ficam empilhados

- tabelas ficam adaptadas

- CRM pode permitir rolagem horizontal

- botões permanecem acessíveis

- textos não podem ser cortados

==================================================

33. SEGURANÇA

==================================================

Implementar:

Supabase Auth

RLS

isolamento por office_id

proteção de rotas

sessões

logout

recuperação de senha

Criar também estrutura de:

audit_logs

para futuramente registrar ações importantes.

==================================================

34. LGPD

==================================================

A arquitetura deve estar preparada para:

consentimento

controle de acesso

exclusão de dados

exportação

logs

retenção

controle de usuários

Não criar textos jurídicos definitivos de LGPD sem revisão profissional.

==================================================

35. EXPERIÊNCIA DO USUÁRIO

==================================================

O produto deve ser simples para um advogado que não entende de tecnologia.

Evitar:

- excesso de menus

- excesso de configurações

- telas confusas

- informações desnecessárias

Priorizar:

clareza

velocidade

hierarquia

ações óbvias

O advogado deve entender rapidamente:

"Quem entrou em contato?"

"O que esse cliente quer?"

"Em que etapa ele está?"

"Quem está atendendo?"

"O que preciso fazer agora?"

==================================================

36. EMPTY STATES

==================================================

Não deixar telas vazias.

Criar empty states úteis.

Exemplo:

"Você ainda não possui leads."

"Assim que um novo contato chegar, ele aparecerá automaticamente nesta área."

Botão quando fizer sentido:

"Configurar atendimento"

Mas não implementar essa funcionalidade ainda.

==================================================

37. LOADING STATES

==================================================

Utilizar skeleton loading onde apropriado.

Evitar telas brancas durante carregamento.

==================================================

38. ERROR HANDLING

==================================================

Criar tratamento profissional de erros.

Nunca mostrar erros técnicos diretamente para o usuário final.

Exemplo:

"Não foi possível carregar essas informações."

"Verifique sua conexão e tente novamente."

==================================================

39. BANCO E SEGURANÇA

==================================================

Criar migrations organizadas.

Criar índices quando necessário.

Criar foreign keys.

Criar timestamps.

Criar RLS.

Garantir que todas as queries relacionadas ao escritório respeitem office_id.

Não permitir vazamento de dados entre tenants.

==================================================

40. ESTRUTURA DE CÓDIGO

==================================================

Organizar:

src/

  components/

  pages/

  layouts/

  hooks/

  services/

  lib/

  types/

  utils/

  integrations/

Não colocar toda a lógica em App.tsx.

Não criar arquivos gigantes.

Utilizar TypeScript corretamente.

Evitar any desnecessário.

==================================================

41. PREPARAÇÃO PARA INTEGRAÇÕES

==================================================

A arquitetura deverá estar preparada para:

Meta WhatsApp Cloud API

OpenAI API

Google Calendar

Microsoft Outlook

Google OAuth

serviços de e-mail

serviços de pagamento

monitoramento processual

Supabase Storage

NÃO conectar essas APIs nesta etapa.

==================================================

42. FUTURO SISTEMA DE PLANOS

==================================================

Preparar conceitualmente a arquitetura para o JurisIA ser vendido como SaaS.

Futuramente teremos:

Plano Starter

Plano Professional

Plano Business

Plano Enterprise

O sistema deverá futuramente controlar:

usuários

conversas

mensagens

IA

armazenamento

número de WhatsApp

automações

funcionalidades

Não implementar cobrança agora.

==================================================

43. PRINCÍPIO DE ESCALABILIDADE

==================================================

Não criar uma aplicação pensando em apenas um escritório.

Pensar desde agora em:

10 escritórios

100 escritórios

1.000 escritórios

10.000 escritórios

A arquitetura deve separar:

dados

configurações

usuários

permissões

integrações

por office_id.

==================================================

44. O QUE NÃO FAZER AGORA

==================================================

NÃO criar:

WhatsApp falso.

NÃO criar:

chat IA falso.

NÃO criar:

clientes fictícios.

NÃO criar:

processos fictícios.

NÃO criar:

métricas falsas.

NÃO simular APIs externas.

NÃO usar dados fake para dar aparência de sistema funcionando.

NÃO criar integrações falsas.

NÃO implementar monitoramento processual agora.

NÃO implementar financeiro agora.

NÃO implementar cobrança agora.

NÃO implementar IA agora.

Tudo isso será construído nas próximas etapas.

==================================================

45. RESULTADO FINAL DESTA PRIMEIRA ETAPA

==================================================

Ao terminar esta etapa eu quero ter:

1. Login funcional

2. Cadastro funcional

3. Recuperação de senha

4. Criação de escritório

5. Usuário owner

6. Onboarding

7. Dashboard

8. Sidebar

9. Header

10. Perfil

11. Configurações

12. Equipe

13. CRM estrutural

14. Leads estrutural

15. Clientes estrutural

16. Atendimento estrutural

17. Agenda estrutural

18. IA estrutural

19. Documentos estrutural

20. Processos estrutural

21. Financeiro estrutural

22. Relatórios estrutural

23. Sistema multi-tenant

24. RLS

25. Responsividade

26. Estados vazios

27. Loading states

28. Error states

Tudo conectado ao Supabase.

==================================================

46. REVISÃO OBRIGATÓRIA

==================================================

Depois de construir:

Verifique todo o projeto.

Corrija:

- erros TypeScript

- erros de build

- erros de navegação

- problemas de autenticação

- problemas de RLS

- problemas de responsividade

- problemas de layout

- componentes quebrados

- links quebrados

- estados inconsistentes

Teste:

Cadastro

Login

Logout

Recuperação de senha

Criação de escritório

Onboarding

Dashboard

Navegação

Equipe

Configurações

Não considere a tarefa concluída apenas porque a interface visual está pronta.

A fundação precisa estar funcional.

==================================================

47. IMPORTANTE SOBRE O DESIGN

==================================================

Quero que o JurisIA seja VISUALMENTE SUPERIOR ao sistema mostrado nas imagens de referência.

Não quero simplesmente reproduzir o visual do Sábio Adv.

Quero:

mais organizado

mais limpo

mais moderno

mais intuitivo

mais premium

melhor experiência mobile

melhor hierarquia de informações

melhor experiência de atendimento

melhor organização das informações do cliente

O produto deve parecer algo que uma empresa de tecnologia cobraria uma assinatura mensal premium.

Priorize qualidade visual e UX.

==================================================

48. ENTREGA

==================================================

Construa agora somente esta Fundação.

Não avance automaticamente para as próximas funcionalidades.

Ao terminar, apresente um resumo de:

- páginas criadas

- tabelas criadas

- políticas RLS criadas

- autenticação implementada

- componentes criados

- pendências

- possíveis problemas encontrados

E aguarde minha próxima instrução. Mas já faz essa daí

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a4683a46-b762-4522-a013-ddb91517bb1e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
