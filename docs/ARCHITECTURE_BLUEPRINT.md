# VOLT OS — Complete Architecture Blueprint & Development Roadmap

> Version: 1.0 · Generated 2026-07-09
> Status: Living Document — Updated with each release
> Baseline refs: SYSTEM_ARCHITECTURE.md, AGENT_SPECIFICATION.md, IMPLEMENTATION_ROADMAP.md, DECISION_LOG.md

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Design Principles](#2-design-principles)
3. [Architecture Diagram](#3-architecture-diagram)
4. [Runtime Boundary](#4-runtime-boundary)
5. [Subsystem Specifications](#5-subsystem-specifications)
6. [Data Model](#6-data-model)
7. [Agent System](#7-agent-system)
8. [Pipeline & Orchestration](#8-pipeline--orchestration)
9. [Event System](#9-event-system)
10. [Security Architecture](#10-security-architecture)
11. [Memory Architecture](#11-memory-architecture)
12. [Frontend Architecture](#12-frontend-architecture)
13. [Infrastructure & Deployment](#13-infrastructure--deployment)
14. [Technology Stack](#14-technology-stack)
15. [Development Roadmap](#15-development-roadmap)
16. [Release Criteria](#16-release-criteria)

---

## 1. System Overview

VOLT OS is an AI Workforce Operating System — a modular platform where specialized AI agents independently own every stage of the software lifecycle: requirements → architecture → code → test → deploy.

**Core value proposition:** A user describes what they want in natural language. The platform decomposes the task, dispatches AI agents through a phase-gated pipeline, and produces production-ready code with full observability.

**Current version:** v0.2.1-alpha
**Architecture status:** PROVEN (vertical slice validated)

---

## 2. Design Principles

| # | Principle | Enforcement |
|---|---|---|
| 1 | **Plugin-first** | Every agent, skill, tool, integration is a plugin. Zero core changes to add capability. |
| 2 | **Structured artifact exchange** | Agents receive structured input, return structured output. No free-form inter-agent communication. |
| 3 | **Enforced phase gates** | No code generation without Discovery → Architecture → Approval. Hard constraint, not soft guideline. |
| 4 | **Domain-agnostic core** | The platform doesn't know what software it's building. Agents bring domain knowledge. |
| 5 | **Progressive complexity** | Simple tasks use simple paths. Full agent teams activate only when the task demands it. |
| 6 | **Event-driven** | All inter-module communication via Event Bus. No direct module coupling. |
| 7 | **Observable** | Every action auditable. Every metric tracked. Every decision recorded. |

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                                 │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Mission Control  │  │  @volt/sdk   │  │  REST/WS Clients │  │
│  │ (Next.js)        │  │  (TypeScript)│  │  (Any Language)  │  │
│  └────────┬─────────┘  └──────┬───────┘  └────────┬─────────┘  │
└───────────┼───────────────────┼───────────────────┼─────────────┘
            │ REST/WS           │ Import             │ HTTP/WS
┌───────────▼───────────────────▼───────────────────▼─────────────┐
│                    TS RUNTIME (TypeScript)                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     API Gateway (Fastify)                    ││
│  │  Auth · Rate Limiting · WebSocket Hub · Request Routing      ││
│  └──┬──────────┬──────────┬──────────┬──────────┬──────────────┘│
│     │          │          │          │          │                 │
│  ┌──▼───┐  ┌──▼────┐  ┌──▼────┐  ┌──▼────┐  ┌──▼─────┐       │
│  │Agent │  │Pipe-  │  │Plugin │  │Memory │  │Model   │       │
│  │Run-  │  │line   │  │Run-   │  │Engine │  │Router  │       │
│  │time  │  │Engine │  │time   │  │(6 lyr)│  │        │       │
│  └──┬───┘  └──┬────┘  └──┬────┘  └──┬────┘  └──┬─────┘       │
│     │         │          │          │          │                 │
│  ┌──▼─────────▼──────────▼──────────▼──────────▼─────────────┐│
│  │              Event Bus (Redis Streams)                      ││
│  │  Schema Registry · DLQ · Outbox · Sequencing                ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Security Engine                           │  │
│  │  JWT · API Key · RBAC · Secrets · Policy · Prompt Guard  │  │
│  │  Supply Chain · Audit Hooks                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Redis Streams / gRPC / REST
┌──────────────────────▼──────────────────────────────────────────┐
│                  PY RUNTIME (Python + FastAPI)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Orchestration Engine                         │  │
│  │  Pipeline DAG · Stage Execution · Gate Evaluation         │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                          │                                       │
│  ┌──────────────────────▼───────────────────────────────────┐  │
│  │              Agent Registry                               │  │
│  │  Researcher · Architect · Frontend Dev · Backend Dev      │  │
│  │  QA · Memory Manager · Sentinel                           │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                          │                                       │
│  ┌──────────────────────▼───────────────────────────────────┐  │
│  │              Model Router (Python)                         │  │
│  │  Provider Abstraction · Cost Tracking · Fallback Chain    │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                   INFRASTRUCTURE                                 │
│  ┌────────────┐  ┌───────┐  ┌───────┐  ┌──────────────────┐   │
│  │ PostgreSQL │  │ Redis │  │ MinIO │  │ Docker Compose   │   │
│  │ +pgvector  │  │ 7     │  │ (S3)  │  │ (dev environment)│   │
│  └────────────┘  └───────┘  └───────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Runtime Boundary

Per `docs/architecture/RUNTIME-BOUNDARY.md` (LOCKED):

### TypeScript Runtime owns:
- All user-facing HTTP/WebSocket endpoints
- All pipeline orchestration (DAG, state machine, retry, rollback)
- All plugin lifecycle management
- All event publishing/subscribing
- All security enforcement (auth, RBAC, secrets)
- All dashboard/visualization
- Memory metadata and vector operations

### Python Runtime owns:
- All AI model API calls (OpenAI, Anthropic, local)
- All embedding operations
- All text/code generation
- All heavy computation

### Communication: TS → Python via Redis Streams (Event Bus), gRPC, REST, or BullMQ.

---

## 5. Subsystem Specifications

### 5.1 Pipeline Engine (`packages/pipeline-engine/`)

| Aspect | Detail |
|---|---|
| Language | TypeScript |
| Test Coverage | 90%+ |
| State Machine | 10 states: created → validated → queued → running → waiting → completed/failed/cancelled/timed_out/rolled_back |
| DAG Resolution | Topological sort with dependency layers |
| Retry | Exponential backoff (configurable maxRetries, delayMs, backoffMultiplier, maxDelayMs) |
| Rollback | `RollbackManager` — undo completed tasks on failure |
| Approval | `ApprovalManager` — human-in-the-loop gates |
| Metrics | `PipelineMetrics` — duration, success rate, token usage |
| Scheduler | `TaskScheduler` — ready-task detection and dispatch |
| Events | 10 canonical events (PIPELINE_CREATED through PIPELINE_ROLLED_BACK) |

### 5.2 Agent Runtime (`packages/agent-runtime/`)

| Aspect | Detail |
|---|---|
| Language | TypeScript |
| Test Coverage | 90%+ |
| Interface | `IAgent` v1.0 (FROZEN) — initialize, execute, validate, heartbeat, shutdown |
| States | 13: discovered → verified → registered → loaded → ready → assigned → running → waiting → completed/failed/paused/restarting/disabled |
| Registry | `AgentRegistry` — manifest loading, capability scoring |
| Scheduler | `AgentScheduler` — priority-based task assignment |
| Executor | `AgentExecutor` — timeout enforcement, health monitoring |
| Recovery | `RecoveryManager` — auto-restart on failure |
| Memory Binding | `MemoryBinder` — context assembly from memory layers |
| Model Binding | `ModelBinder` — LLM provider selection per agent |
| Capabilities | `CapabilityResolver` — match task requirements to agent capabilities |

### 5.3 Model Router (`packages/model-router/`)

| Aspect | Detail |
|---|---|
| Language | TypeScript |
| Test Coverage | 90%+ |
| Providers | OpenAI, Anthropic, Google, DeepSeek, Qwen, Mistral, Llama, Custom, Local |
| Routing | `ProviderScorer` — cost, latency, capability, availability scoring |
| Failover | `FailoverManager` — automatic provider fallback on failure |
| Budget | `BudgetManager` — per-task, per-project, per-org cost limits |
| Streaming | `StreamHandler` — real-time token streaming |
| BYOK | Bring Your Own Key support |
| Metrics | `RouterMetrics` — per-provider, per-model cost and latency tracking |

### 5.4 Memory Engine (`packages/memory-engine/`)

| Aspect | Detail |
|---|---|
| Language | TypeScript |
| Test Coverage | 90%+ |
| Layers | 6: User, Project, Agent, Knowledge Base, Vector Store, Decision History |
| Query Engine | `MemoryQueryEngine` — cross-layer search with filtering |
| Semantic Search | `VectorStoreLayer` — pgvector-backed embedding similarity |
| Isolation | `MemoryIsolation` — per-agent, per-project data boundaries |
| Retention | `RetentionPolicy` — TTL, pruning, archival rules |
| Operations | read, write, delete, query, semanticSearch, getAgentContext |

### 5.5 Plugin Runtime (`packages/plugin-runtime/`)

| Aspect | Detail |
|---|---|
| Language | TypeScript |
| Test Coverage | 90%+ |
| Loader | `PluginLoader` — manifest validation, dependency resolution |
| Sandbox | `PluginSandbox` — resource limits, permission enforcement |
| Manager | `PluginManager` — lifecycle (install → activate → deactivate → upgrade → remove) |
| Verifier | `PluginVerifier` — security scanning, compatibility checks |
| SDK | `VoltSDK` — plugin API surface (logger, events, memory, config, storage, tasks) |
| Dependencies | `DependencyResolver` — topological sort, conflict detection |
| Metrics | `PluginMetrics` — resource usage, execution stats |

### 5.6 Security Engine (`packages/security-engine/`)

| Aspect | Detail |
|---|---|
| Language | TypeScript |
| Test Coverage | 90%+ |
| JWT Auth | `JWTAuth` — token issuance, verification, JWKS |
| API Key Auth | `APIKeyAuth` — key storage, hash verification |
| RBAC | `RBACManager` — role-based access control |
| Authorization | `Authorizer` — policy-based authorization engine |
| Secrets | `SecretsManager` — AES-256 encryption, key rotation |
| Encryption | `EncryptionService` — symmetric/asymmetric crypto |
| Policy Engine | `PolicyEngine` — rule evaluation, condition matching |
| Prompt Guard | `PromptGuard` — injection detection, sanitization |
| Supply Chain | `SupplyChainScanner` — dependency audit, license check |
| Audit | `AuditHooks` — event-driven audit trail |

### 5.7 Event Bus (`packages/event-bus/`)

| Aspect | Detail |
|---|---|
| Language | TypeScript |
| Test Coverage | 90%+ |
| Transports | In-process (dev), Redis Streams (production) |
| Features | Schema registry, DLQ (dead letter queue), outbox pattern, sequencing |
| Interface | `EventBus` — emit, on, off |

### 5.8 SDK (`packages/sdk/`)

| Aspect | Detail |
|---|---|
| Language | TypeScript |
| Package | `@volt/sdk` |
| Interface | `Volt` class — single import, unified API |
| APIs | Pipeline, Agent, Plugin, Memory, Model, Security, Event, Config |
| Usage | `const volt = new Volt(); await volt.pipeline.start(...);` |

### 5.9 Mission Control (`packages/mission-control/`)

| Aspect | Detail |
|---|---|
| Framework | Next.js (App Router) |
| Pages | Dashboard, Agents, Pipelines, Events, Memory, Models, Logs, Security |
| Components | Sidebar, StatCard, StatusBadge, DataTable, EventStream, ErrorBoundary, LoadingSpinner |
| Data | REST API + WebSocket real-time updates |
| State | Zustand store (`dashboard-store.ts`) |
| Hooks | `use-websocket.ts` — WebSocket connection management |

### 5.10 Python Backend (`backend/`)

| Aspect | Detail |
|---|---|
| Framework | FastAPI |
| ORM | SQLAlchemy + Alembic |
| API Endpoints | 25 (Plugins: 7, Pipelines: 6, Memory: 6, Observability: 5, Health: 1) |
| Agents | 7 (Researcher, Architect, Frontend Dev, Backend Dev, QA, Memory Manager, Sentinel) |
| Auth | Clerk JWT + RBAC |
| Event Bus | Redis Streams |
| Test Coverage | 89.72% (308 tests) |
| Test Framework | pytest + httpx (FastAPI TestClient) |

---

## 6. Data Model

### 6.1 TypeScript Packages (In-Memory / Delegated)

| Entity | Store | Notes |
|---|---|---|
| PipelineInstance | In-memory + persisted | DAG state machine |
| AgentInstance | In-memory + Registry | Lifecycle managed by AgentManager |
| PluginInstance | In-memory + Registry | Lifecycle managed by PluginManager |
| MemoryEntry | PostgreSQL + pgvector | 6-layer architecture |
| ModelCall | In-memory + Metrics | Cost tracking per call |
| SecurityEvent | Event Bus + Audit | Hash-chained audit trail |

### 6.2 Python Backend (PostgreSQL)

| Table | Purpose |
|---|---|
| `plugins` | Installed plugin records |
| `plugin_audit_log` | Plugin lifecycle audit trail |
| `agent_executions` | Agent dispatch history |
| `artifacts` | Generated artifacts (requirements, code, reports) |
| `memory_entries` | Memory layer storage |
| `decision_history` | Append-only decision log |
| `audit_log` | System-wide audit trail |
| `metric_snapshots` | Observability metrics |

---

## 7. Agent System

### 7.1 Agent Lifecycle

```
discovered → verified → registered → loaded → ready → assigned → running → completed
                                                                        → failed → restarting
                                                                        → paused
                                                                        → disabled
```

### 7.2 Agent Definitions (YAML Manifests)

| Agent | Role | Model Preference | Skills |
|---|---|---|---|
| Researcher | Requirements, research, feasibility | Claude Sonnet → GPT-4o → DeepSeek | requirements_gathering, market_research, technical_research |
| Architect | System design, ADRs, task breakdown | Claude Sonnet → GPT-4o | system_design, tech_selection, task_planning, risk_assessment |
| Frontend Dev | React/Next.js code generation | Claude Sonnet → GPT-4o → DeepSeek Coder | react, nextjs, tailwind, shadcn, responsive_design |
| Backend Dev | API, database, service code | Claude Sonnet → GPT-4o → DeepSeek Coder | python, fastapi, nodejs, postgresql, redis, docker |
| QA | Testing, validation, UX review | GPT-4o → Claude Sonnet | unit_testing, integration_testing, e2e_testing, security_testing |
| Memory Manager | Context management, knowledge retrieval | GPT-4o → Claude Sonnet → Qwen | context_management, rag_retrieval, memory_organization |
| Sentinel | Error handling, security scanning, auto-fix | GPT-4o → Claude Sonnet | sast, secret_scanning, dependency_audit, auto_fix |

### 7.3 Agent Interface (IAgent v1.0 — FROZEN)

```typescript
interface IAgent {
  initialize(context: AgentContext): Promise<void>;
  execute(task: AgentTask): Promise<AgentResult>;
  validate(input: unknown): ValidationResult;
  heartbeat(): HealthCheckResult;
  shutdown(): Promise<void>;
}
```

### 7.4 Vertical Slice Agents (TypeScript)

The vertical slice implements 4 lightweight agents for the end-to-end workflow:

| Agent | File | Purpose |
|---|---|---|
| Researcher | `packages/vertical-slice/src/agents/researcher-agent.ts` | Produces requirements document |
| Architect | `packages/vertical-slice/src/agents/architect-agent.ts` | Produces system design + ADR |
| Frontend Engineer | `packages/vertical-slice/src/agents/frontend-agent.ts` | Produces Next.js code |
| QA | `packages/vertical-slice/src/agents/qa-agent.ts` | Produces validation report |

---

## 8. Pipeline & Orchestration

### 8.1 Pipeline Engine (TypeScript)

**State Machine:**
```
created → validated → queued → running → completed
                                        → failed → rolled_back
                                        → waiting (approval)
                                        → timed_out → rolled_back
                                        → cancelled
```

**Components:**
- `DAG` — Directed acyclic graph representation
- `getExecutionLayers` — Topological sort for parallel execution
- `PipelineStateMachine` — Enforced transition validation
- `TaskScheduler` — Ready-task detection
- `ApprovalManager` — Human-in-the-loop gates
- `RetryPolicyManager` — Exponential backoff
- `RollbackManager` — Undo completed tasks
- `PipelineMetrics` — Performance tracking
- `DependencyResolver` — Input/output validation
- `PipelineExecutor` — Full lifecycle execution

### 8.2 Orchestration Engine (Python)

**Pipeline:** `SOFTWARE_ENGINEERING_PIPELINE` (11 stages, 2 gates)

```
discovery → research → architecture → planning → [pre_dev_gate]
    → frontend_dev + backend_dev (parallel) → testing → security_review
    → [pre_deploy_gate] → deployment
```

**Gates:**
- `gate-1` (Pre-Development): Requires requirements, architecture_spec, task_breakdown, risk_assessment, tech_selection. Requires explicit approval.
- `gate-2` (Pre-Deployment): Requires test coverage ≥70%, zero critical test failures, max security risk "medium", zero critical findings, build success.

### 8.3 Vertical Slice Workflow

```
User → createProject(desc)
  → Research Agent → Requirements
  → Architect Agent → Design + ADR
  → Frontend Agent → Code
  → QA Agent → Validation Report
  → Memory Engine (store all artifacts)
  → Event Bus (stream to Mission Control)
  → User (download artifacts)
```

---

## 9. Event System

### 9.1 Event Bus Events

| Category | Events |
|---|---|
| Pipeline | PIPELINE_CREATED, PIPELINE_VALIDATED, PIPELINE_QUEUED, PIPELINE_STARTED, PIPELINE_WAITING, PIPELINE_COMPLETED, PIPELINE_FAILED, PIPELINE_CANCELLED, PIPELINE_TIMED_OUT, PIPELINE_ROLLED_BACK |
| Agent | agent:dispatch, agent:status, agent:health |
| Workflow | workflow:started, workflow:step.started, workflow:step.completed, workflow:artifact.stored, workflow:completed, workflow:failed |
| Memory | memory:read, memory:written, memory:deleted |
| Security | auth.login.success, auth.login.failure, authz.permission.granted, authz.permission.denied |
| Plugin | plugin:installed, plugin:activated, plugin:deactivated, plugin:removed |

### 9.2 Event Envelope

```json
{
  "eventId": "uuid",
  "type": "workflow:step.completed",
  "timestamp": "ISO-8601",
  "source": "workflow-orchestrator",
  "payload": { ... },
  "correlationId": "workflowExecutionId",
  "sequence": 42
}
```

---

## 10. Security Architecture

### 10.1 Authentication

| Method | Implementation | Status |
|---|---|---|
| JWT (Clerk) | `backend/src/auth/clerk.py` | ✅ Implemented |
| API Key | `packages/security-engine/src/auth/api-key.ts` | ✅ Implemented |
| OAuth | Planned (Auth.js) | ⬜ Not started |
| Passkeys | Planned | ⬜ Not started |

### 10.2 Authorization

- RBAC: `RBACManager` with role-permission mapping
- Policy Engine: `PolicyEngine` with rule evaluation
- Agent permissions: Declared in YAML manifests, enforced at runtime

### 10.3 Secrets Management

- AES-256 encryption via `EncryptionService`
- `SecretsManager` with provider abstraction
- Key rotation support
- No plaintext storage

### 10.4 Audit Trail

- `AuditHooks` — event-driven, hash-chained
- Every auth, authz, and significant action logged
- Append-only, tamper-evident

### 10.5 Prompt Security

- `PromptGuard` — injection detection and sanitization
- Applied before model calls

### 10.6 Supply Chain

- `SupplyChainScanner` — dependency audit, license check
- CI integration via `pnpm audit` and CodeQL

---

## 11. Memory Architecture

### 11.1 Six-Layer System

| Layer | Scope | Storage | TTL | Purpose |
|---|---|---|---|---|
| User | Per-user | PostgreSQL | Permanent | User preferences, settings |
| Project | Per-project | PostgreSQL | Permanent | Architecture decisions, code patterns |
| Agent | Per-agent | Redis | Session | Working context, scratch space |
| Knowledge Base | Cross-project | PostgreSQL | Permanent (pruned) | Reusable knowledge, common patterns |
| Vector Store | Cross-layer | pgvector | Permanent | Semantic search embeddings |
| Decision History | Global | PostgreSQL | Permanent (append-only) | Every decision recorded |

### 11.2 Operations

- **Read:** `memory.read(layer, scopeId, key)`
- **Write:** `memory.write(layer, scopeId, key, content, metadata)`
- **Delete:** `memory.delete(layer, id)`
- **Query:** `memory.query(filter)` — cross-layer search
- **Semantic Search:** `memory.semanticSearch(queryText, topK)` — vector similarity
- **Agent Context:** `memory.getAgentContext(agentId, projectId)` — consolidated context

### 11.3 Isolation

- `MemoryIsolation` — per-agent, per-project data boundaries
- Agents cannot access other agents' memory
- Cross-project queries require explicit promotion

---

## 12. Frontend Architecture

### 12.1 Mission Control (Operational Dashboard)

| Page | Purpose | Status |
|---|---|---|
| Dashboard | Platform health, stat cards, recent events | ✅ Implemented |
| Agents | Agent status, health, execution history | ✅ Implemented |
| Pipelines | Pipeline status, stage progress, gate status | ✅ Implemented |
| Events | Real-time event stream with filtering | ✅ Implemented |
| Memory | Memory layer browser | 🔲 Stub |
| Models | Model provider status, cost tracking | 🔲 Stub |
| Logs | System logs viewer | 🔲 Stub |
| Security | Security events, audit trail | 🔲 Stub |

### 12.2 Components

| Component | Purpose |
|---|---|
| `Sidebar` | Navigation + agent health indicators |
| `StatCard` | Metric display card |
| `StatusBadge` | Status indicator (healthy/degraded/unhealthy) |
| `DataTable` | Sortable, filterable data table |
| `EventStream` | Real-time event list |
| `ErrorBoundary` | React error boundary |
| `LoadingSpinner` | Loading state indicator |

### 12.3 Data Flow

```
Mission Control → REST API (useQuery hooks) → Python FastAPI
Mission Control → WebSocket (useWebSocket hook) → Event Bus
```

---

## 13. Infrastructure & Deployment

### 13.1 Development Environment (Docker Compose)

| Service | Image | Port | Purpose |
|---|---|---|---|
| PostgreSQL | pgvector/pgvector:pg16 | 5432 | Database + vector search |
| Redis | redis:7-alpine | 6379 | Event Bus + cache + queues |
| MinIO | minio/minio | 9000/9001 | S3-compatible artifact storage |

### 13.2 CI/CD (GitHub Actions)

| Pipeline | Trigger | Purpose |
|---|---|---|
| Unit Tests | PR + push to main | vitest (TS) + pytest (Python) |
| Architecture Fitness | PR + push to main | Dependency graph, boundary checks |
| ESLint | PR + push to main | Code quality |
| Prettier | PR + push to main | Formatting |
| TypeScript | PR + push to main | Type safety |
| Dependency Audit | PR + push + weekly | Security vulnerabilities |
| CodeQL | PR + push + weekly | Static analysis |
| Secret Scan | PR + push | Hardcoded secrets |
| License Check | PR + push | Copyleft detection |

### 13.3 Deployment Targets

| Phase | Target | Status |
|---|---|---|
| Alpha | Docker Compose (local) | ✅ |
| Beta | Cloud deployment (Vercel + Railway or equivalent) | ⬜ |
| Stable | Production Docker + CDN | ⬜ |
| Enterprise | Kubernetes + multi-region | ⬜ |

---

## 14. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14, React 18, TypeScript | Dashboard UI |
| Styling | Tailwind CSS | Design system |
| Backend | Python 3.12, FastAPI | API Gateway (Python) |
| API (TS) | Fastify | API Gateway (TypeScript) |
| Real-time | Socket.io / WebSocket | Live updates |
| Database | PostgreSQL 16 + pgvector | Persistence + vector search |
| Cache/Queue | Redis 7 + BullMQ | Event Bus + task queues |
| ORM | SQLAlchemy (Python), Drizzle (TS) | Database access |
| Auth | Clerk (JWT) | Authentication |
| Testing | vitest (TS), pytest (Python) | Unit + integration tests |
| Build | pnpm + Turborepo | Monorepo management |
| CI/CD | GitHub Actions | Automated pipelines |
| Containers | Docker + Docker Compose | Development environment |
| LLM SDK | Vercel AI SDK / provider APIs | Model integration |

---

## 15. Development Roadmap

### Phase 0: Foundation ✅ COMPLETE

- [x] Architecture documents (PRD, System Architecture, Agent Spec)
- [x] Monorepo scaffold (pnpm workspaces + Turborepo)
- [x] Docker Compose (PostgreSQL, Redis, MinIO)
- [x] CI/CD pipelines (GitHub Actions)
- [x] Architecture fitness tests (10 automated rules)
- [x] Development standards and templates

### Phase 1: Platform Core ✅ COMPLETE

- [x] Event Bus (in-process + Redis Streams, outbox, schema registry, DLQ)
- [x] API Gateway (Fastify, REST + WebSocket, auth, rate limiting)
- [x] Pipeline Engine (11-stage state machine, DAG, retry, rollback, approval)
- [x] Plugin Runtime (loader, sandbox, lifecycle, hot reload)
- [x] Agent Runtime (manifest loading, lifecycle, scheduling, health, recovery)
- [x] Memory Engine (6-layer architecture, semantic search, isolation, retention)
- [x] Model Router (multi-provider, failover, BYOK, budget, streaming)
- [x] Security Engine (JWT, API key, RBAC, secrets, policy, prompt guard, supply chain, audit)
- [x] SDK (`@volt/sdk` — unified developer interface)

### Phase 2: Agent Runtime ✅ COMPLETE

- [x] 7 Python agents implementing AgentInterface ABC
- [x] Agent Registry with YAML manifest loading
- [x] AgentContext/AgentResult typed exchange
- [x] Model Router with provider abstraction and cost tracking
- [x] Memory System with 5 layers + decision history

### Phase 3: Core Workforce ✅ COMPLETE

- [x] Researcher Agent
- [x] Architect Agent
- [x] Frontend Engineer Agent
- [x] Backend Engineer Agent
- [x] QA Agent
- [x] Memory Manager Agent
- [x] Sentinel Agent

### Phase 4: Security & Observability ✅ COMPLETE

- [x] Security Engine (8 modules)
- [x] Observability (audit log, metric snapshots, cost breakdown, latency stats)
- [x] Cost tracking (per-task, per-project, per-org)

### Phase 5: Frontend ✅ COMPLETE (v0)

- [x] Mission Control Dashboard (8 pages)
- [x] Real-time event streaming
- [x] Agent health monitoring
- [ ] Browser IDE (Phase 6)
- [ ] Visual Canvas (Phase 7)

### Phase 6: Vertical Slice ✅ COMPLETE (v0.2.0-alpha)

- [x] End-to-end workflow: User → Research → Architecture → Frontend → QA → Memory → Mission Control
- [x] 4 TypeScript agents (researcher, architect, frontend-engineer, qa)
- [x] WorkflowOrchestrator coordinating all 8 subsystems
- [x] PerformanceTracker for metrics
- [x] E2E test suite
- [x] Architecture validation report

### Phase 7: Hardening (v0.2.1-alpha → v1.0.0-beta) 🚧 IN PROGRESS

- [x] Python backend tests (89.72% coverage, 308 tests)
- [x] Reliability testing (8 failure scenarios)
- [x] Runtime boundary documentation
- [ ] Auth middleware wired to all Python API routes
- [ ] PostgreSQL integration tests in CI
- [ ] Agent JSON Schema validation
- [ ] Temporal workflow integration
- [ ] Frontend connected to real backend API
- [ ] Performance benchmarks (k6/locust)

### Phase 8: Beta Preparation (v1.0.0-beta) ⬜ PLANNED

- [ ] All P0 defects resolved
- [ ] E2E test coverage for all major flows
- [ ] Load testing (100 concurrent pipelines)
- [ ] Security audit (penetration test)
- [ ] OpenAPI documentation
- [ ] Production Docker configuration
- [ ] Monitoring (Prometheus + Grafana)

### Phase 9: Stable (v1.0.0) ⬜ PLANNED

- [ ] All Beta gates pass
- [ ] WCAG 2.1 AA accessibility
- [ ] Chaos testing (Redis/DB/pipeline failure recovery)
- [ ] Deployment adapters (Vercel, Cloudflare, GCP, AWS, Azure)
- [ ] Documentation complete

### Phase 10: Public Beta (v2.0.0) ⬜ PLANNED

- [ ] Onboarding flow
- [ ] Plugin marketplace
- [ ] Billing integration
- [ ] Multi-tenant support

### Phase 11: Enterprise (v3.0.0) ⬜ PLANNED

- [ ] SSO/SAML
- [ ] SOC2 compliance
- [ ] GDPR compliance
- [ ] On-premise deployment
- [ ] Compliance audit trail

---

## 16. Release Criteria

### Alpha (v0.1.x) — Internal Development
- TS packages: ≥90% test coverage ✅
- Python backend: ≥50% test coverage ✅ (89.72%)
- CI: All pipelines passing ✅
- Architecture fitness: 10/10 rules ✅
- Secret scan: Zero findings ✅

### Beta (v0.2.x) — Closed Testing
- All alpha gates ✅
- Auth wired to all routes ⬜
- Integration tests (DB, Redis) ⬜
- 1 critical E2E flow ⬜
- Agent schema validation ⬜

### Stable (v1.0.0) — Production
- All beta gates ⬜
- Python coverage ≥80% ✅ (89.72%)
- All major E2E flows ⬜
- Performance: API <200ms p95 ⬜
- Load: 100 concurrent pipelines ⬜
- Chaos: Recovery verified ⬜
- Accessibility: WCAG 2.1 AA ⬜

### Enterprise (v2.0.0+)
- All stable gates ⬜
- Multi-tenant isolation ⬜
- SSO/SAML ⬜
- SOC2/GDPR compliance ⬜

---

*This document is the single source of truth for VOLT OS architecture and development progress. Update with each release.*
