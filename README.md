# Sistema de uma clínica médica

## Cenário

Nossa aplicação web consiste em um sistema de gerenciamento, agendamento, manutenção de pacientes, horários e consultas e seleção de áreas da saúde específicas.

O sistema possui três áreas distintas, sendo elas:

1. Área do paciente - onde o usuário poderá utilizar a agenda virtual para marcar seus compromissos com a clínica.
2. Área do funcionário - um espaço no qual os funcionários poderão realizar a organização e a gestão de seus serviços.
3. Área do médico - o ambiente em que os médicos poderão manusear de maneira complexa e facilitadora seus pacientes.
4. Área do admin - onde

## Problemas a serem resolvidos

A maneira de se organizar em compromissos com a sua saúde por meios considerados difíceis de se estruturar, vem sendo um constante problema na sociedade, pois papéis são descartáveis e facilmente podem se perder, por isso a nossa clínica tende a alterar este padrão através de uma agenda virtual.

## Escopo

Criar um sistema para gerenciar as principais áreas que um hospital pode oferecer para seus pacientes e funcionários, através de nossa aplicação

### Requisitos

1. Controle e fluxo de consultas/agendamentos
2. Controle de planos
3. Controle de hospitais que atendam
4. Controle de prontuários
5. Seleção de áreas que o paciente necessite
6. Seleção de doutores (caso o paciente tenha preferências)
7. Será algo mais cotidiano

### O que o sistema não precisa fazer:

1. Consultas online com médicos
2. Não obteremos a opção de agendamentos cirúrgicos
3. E também não teremos agendamentos a longa data, como nutricionistas e psicólogos (rotina)

### Backlog #01

---

# Tutorial: rodar e testar todo o sistema (frontend + backend)

Este tutorial cobre, em português, como **subir** a aplicação inteira e como
**testar** tudo (frontend e backend), usando os scripts prontos do repositório.

> Pré-requisitos (Windows): **Docker Desktop**, **Node.js + pnpm**
> (`npm install -g pnpm@9`) e **Supabase CLI** (`npm install -g supabase`).
> O primeiro uso sobe o Docker automaticamente (pode demorar ~90s).

---

## 1. Como RODAR tudo (stack completa)

`pnpm up:start` faz tudo em sequência: sobe o Docker → prepara o banco (Postgres +
Auth + REST + Edge Functions + Studio) → aplica as migrações 001–004 e o seed →
sobe o frontend Vue em `http://localhost:3000`.

```bash
pnpm up:start
```

Deve terminar com _"Backend ready."_ e o frontend aberto em `http://localhost:3000`.

### Rodar só o backend (banco + API Supabase)

```bash
pnpm up:backend
```

Sempre idempotente: reaplica as migrações 002/003/004 e o `seed.sql` a cada execução.

### Rodar só o frontend

```bash
pnpm up:frontend
```

### Verificar o estado da stack

```bash
pnpm up:check
```

Mostra Docker, Postgres, Auth, REST e frontend.

### Reiniciar tudo do zero (destrutivo)

```bash
pnpm up:reset
```

Apaga os volumes locais do Supabase, re-aplica as migrações **001 → 004** e o seed.
Pede confirmação (digite `RESET`).

### Parar o Supabase

```bash
pnpm up:stop          # mantém volumes
```

---

## 2. Como TESTAR tudo (testes do frontend + backend)

`pnpm up:test` roda a suíte completa:

| Etapa                 | O que executa                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1. Lint               | `pnpm lint` (ESLint em `@clinica/shared` e `@clinica/web`)                                                             |
| 2. Typecheck          | `pnpm typecheck` (vue-tsc / tsc)                                                                                       |
| 3. Testes do frontend | `vitest run` — 9 arquivos, **174 testes** (componentes, schemas, auth store, guards, integração, IDOR/segurança)       |
| 4. Testes do backend  | Suítes SQL contra o Postgres local: `business_rules.sql` (**12** asserções) e `rls_policies.sql` (**25** asserções)    |
| 5. Edge Functions     | Probe de roteamento nas 4 funções (`book-appointment`, `cancel-appointment`, `create-medical-record`, `assign-doctor`) |

### Rodar TUDO (precisa do backend de pé)

```bash
pnpm up:start     # sobe banco + API + frontend (uma vez)
pnpm up:test      # roda lint, typecheck, 174 testes web + 37 testes SQL + edge probe
```

### Testar só o frontend (não precisa do banco)

```bash
pnpm up:test -SkipSql -SkipEdge
```

### Testar só o backend (precisa do Supabase de pé)

```bash
pnpm up:backend   # garante migrações + seed
pnpm up:test -SkipWeb
```

### Execuções individuais (sem os scripts)

```bash
pnpm lint                     # ESLint (todo o monorepo)
pnpm typecheck                # TypeScript (todo o monorepo)
pnpm --filter @clinica/web test   # apenas os 174 testes do frontend
```

---

## 3. O que cada área testa

### Frontend (`apps/web/src/__tests__/`, 174 testes via vitest + happy-dom)

- **Componentes**: `AppButton`, `AppInput`
- **Schemas**: validação de `appointment`, `auth` (CPF, CRM, telefone, datas, enums)
- **Logic**: `scheduling`, `booking-flow` (agendamento/fluxo), guards de rota, auth store
- **Segurança**: testes de IDOR contra acesso cruzado de dados

### Backend (suites SQL em `supabase/tests/`)

| Suíte                | Asserções | Cobre                                                                                                                                                                                                             |
| -------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `business_rules.sql` | 12        | Triggers de vagas (decrementa ao agendar / restaura ao cancelar), CHECK constraints (`max_slots`, `end_time`, `coverage_percentage`, `monthly_price`, datas), status default `scheduled`                          |
| `rls_policies.sql`   | 25        | Isolamento por papel (patient/doctor/employee/admin): leitura própria, leitura de colegas de equipe, bloqueio de updates/deletes cruzados, acesso a `audit_logs` e `medical_records`, permissões de INSERT/POLICY |

Para inspecionar o resultado detalhado de cada suíte, os logs ficam em:

```
%TEMP%\sqlsuite-business_rules.log
%TEMP%\sqlsuite-rls_policies.log
```

---

## 4. Resumo rápido dos comandos

```bash
pnpm up:start     # sobe a aplicação inteira (backend + frontend)
pnpm up:backend   # só o Supabase (banco + auth + REST + edge)
pnpm up:frontend  # só o Vite (http://localhost:3000)
pnpm up:check     # status da stack
pnpm up:test      # roda TODOS os testes (web + SQL + edge)
pnpm up:reset     # apaga e recria o banco com seed (destrutivo)
pnpm up:stop      # para o Supabase (mantém os dados)
```

---

## 5. Logins de demonstração

| Email                    | Senha            | Papel       |
| ------------------------ | ---------------- | ----------- |
| `admin@clinica.local`    | `admin123456`    | admin       |
| `doctor@clinica.local`   | `doctor123456`   | médico      |
| `employee@clinica.local` | `employee123456` | funcionário |
| `patient@clinica.local`  | `patient123456`  | paciente    |

URLs após `pnpm up:start`: frontend `http://localhost:3000`, API `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`, Edge Functions `http://127.0.0.1:54321/functions/v1/*`.

> Mais detalhes técnicos: `scripts/README.md`, `docs/local-setup-guide.md` e `docs/PROJECT-STATUS.md`.
