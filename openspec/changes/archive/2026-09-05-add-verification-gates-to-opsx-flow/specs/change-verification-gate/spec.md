## ADDED Requirements

### Requirement: Gate mecánico de lint y test antes de los roles de verificación
`verify-change` (el flujo detrás de `/opsx:verify`) SHALL correr `make lint` y `make test` como
paso 0, antes de lanzar a Code Reviewer y QA. Si `make lint` o `make test` terminan con código de
salida distinto de cero, `verify-change` SHALL registrar veredicto FALLA en `verification.md`
citando qué comando falló y su salida relevante, y MUST NOT lanzar a Code Reviewer ni a QA para
ese intento de verificación.

#### Scenario: Lint rojo bloquea antes de gastar un turno de agente
- **WHEN** se corre `/opsx:verify` sobre un change cuyo `make lint` termina con código de salida
  distinto de cero
- **THEN** `verification.md` registra veredicto FALLA citando la salida de `make lint` (archivo y
  regla de la offense)
- **THEN** el archivo no contiene hallazgos atribuidos a Code Reviewer ni a QA para ese intento

#### Scenario: Test rojo bloquea antes de gastar un turno de agente
- **WHEN** se corre `/opsx:verify` sobre un change cuyo `make test` termina con código de salida
  distinto de cero
- **THEN** `verification.md` registra veredicto FALLA citando qué test falló y en qué app
- **THEN** el archivo no contiene hallazgos atribuidos a Code Reviewer ni a QA para ese intento

#### Scenario: Lint y test en verde continúan el flujo
- **WHEN** se corre `/opsx:verify` sobre un change cuyo `make lint` y `make test` terminan ambos
  con código de salida 0
- **THEN** `verification.md` registra que el paso 0 pasó y el flujo continúa con Code Reviewer (y
  con QA salvo que aplique la omisión por riesgo bajo)

### Requirement: Plan de verificación obligatorio en el diseño
El `design.md` de todo change con tasks de código (`backend/` o `frontend/src/`) SHALL incluir una
sección `## Plan de verificación` con: (a) los invariantes que el change no puede romper, (b) los
tests por capa que `role-dev` debe escribir, cada uno identificado por archivo y nombre de caso
(pytest o Vitest), y (c) un nivel de riesgo declarado —bajo, medio o alto— con el criterio
explícito que lo determina. `verify-change` SHALL verificar que la sección existe y que cada test
nombrado existe realmente en el repo tras aplicar las tasks del change; si la sección falta o un
test nombrado no existe, `verify-change` SHALL registrar veredicto FALLA sin continuar con Code
Reviewer ni QA.

#### Scenario: Design sin Plan de verificación
- **WHEN** se corre `/opsx:verify` sobre un change con tasks de código cuyo `design.md` no tiene
  una sección `## Plan de verificación`
- **THEN** `verification.md` registra veredicto FALLA señalando la ausencia de la sección
- **THEN** el archivo no contiene hallazgos atribuidos a Code Reviewer ni a QA para ese intento

#### Scenario: Test nombrado en el plan que no existe en el repo
- **WHEN** el `## Plan de verificación` de un change nombra un caso de test (archivo + nombre de
  caso) que, tras aplicar todas las tasks del change, no existe en el repo
- **THEN** `verification.md` registra veredicto FALLA identificando el archivo y el caso de test
  faltante

#### Scenario: Plan completo con sus tres contenidos
- **WHEN** el `## Plan de verificación` de un change lista al menos un invariante, al menos un
  test nombrado por archivo/caso, y un nivel de riesgo con su criterio
- **THEN** `verify-change` continúa el flujo sin registrar un FALLA por esta causa

#### Scenario: Riesgo declarado no coincide con el diff
- **WHEN** el diff de un change modifica `backend/app/models.py`, autenticación o permisos por
  rol, pero el `## Plan de verificación` declara riesgo bajo o medio
- **THEN** el reporte de Code Reviewer incluido en `verification.md` señala el desacuerdo entre el
  riesgo declarado y el diff como hallazgo

### Requirement: Omisión de QA manual por riesgo bajo declarado
`verify-change` SHALL correr únicamente Code Reviewer y omitir la verificación manual de QA
cuando el `## Plan de verificación` del change declara riesgo bajo y el paso 0 (`make lint` +
`make test`) terminó en verde, y SHALL registrar en `verification.md` que la verificación manual
de QA se omitió por riesgo bajo, en vez de dejarlo implícito. Cuando el riesgo declarado es medio
o alto, `verify-change` SHALL correr QA manual igual que hoy; el riesgo alto MUST NOT omitirse
bajo ninguna circunstancia, ni siquiera si se solicita explícitamente saltearlo. El usuario SHALL
poder forzar que QA manual corra igual aunque el riesgo declarado sea bajo.

#### Scenario: Riesgo bajo con suite verde omite QA manual
- **WHEN** se corre `/opsx:verify` sobre un change con riesgo bajo declarado en su
  `## Plan de verificación` y con `make lint` + `make test` en verde
- **THEN** `verification.md` solo contiene el reporte de Code Reviewer
- **THEN** `verification.md` incluye explícitamente la frase "QA manual omitida por riesgo bajo"
  (o equivalente) en vez de dejar la ausencia de QA sin explicar

#### Scenario: Riesgo medio corre QA manual igual que hoy
- **WHEN** se corre `/opsx:verify` sobre un change con riesgo medio declarado
- **THEN** `verification.md` incluye el reporte de QA manual además del de Code Reviewer

#### Scenario: Riesgo alto nunca se saltea
- **WHEN** se corre `/opsx:verify` sobre un change con riesgo alto declarado, incluso si se pide
  explícitamente omitir la verificación manual de QA
- **THEN** `verification.md` incluye igual el reporte de QA manual, y no queda registrada ninguna
  omisión de QA por riesgo para ese change

#### Scenario: El usuario fuerza QA manual en un change de riesgo bajo
- **WHEN** el usuario pide explícitamente que QA manual corra en un change cuyo riesgo declarado
  es bajo
- **THEN** `verification.md` incluye el reporte de QA manual en vez de omitirlo
