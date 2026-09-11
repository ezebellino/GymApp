## ADDED Requirements

### Requirement: Un 401 en una vista pública no dispara el flujo de sesión expirada
El manejo global de errores 401 de la API SHALL distinguir si la vista actual es pública (por
ejemplo `/login` o `/invitacion/:channel/:token`) o requiere sesión. En una vista pública, un
401 devuelto por una llamada de fondo SHALL NOT mostrar el toast de "sesión expirada" ni
redirigir al usuario fuera de esa vista; el comportamiento de logout + toast + redirección a
`/login` que ya existe SHALL seguir aplicando sin cambios cuando el 401 ocurre en una vista que
sí requiere sesión.

#### Scenario: 401 de fondo en /login no muestra "sesión expirada"
- **WHEN** una persona sin sesión está en `/login` y una llamada de la app a la API responde 401
- **THEN** no se muestra el toast de "sesión expirada"
- **THEN** la persona sigue viendo el formulario de login, sin ser redirigida

#### Scenario: 401 de fondo en /invitacion no interrumpe el flujo
- **WHEN** un miembro sin sesión está completando su invitación en
  `/invitacion/:channel/:token` y una llamada de la app a la API responde 401
- **THEN** no se muestra el toast de "sesión expirada"
- **THEN** el miembro puede seguir completando la invitación en esa misma ruta

#### Scenario: 401 en una vista protegida sigue cerrando la sesión
- **WHEN** un usuario autenticado está en una vista protegida (por ejemplo `/payments`) y una
  llamada a la API responde 401 porque su token expiró
- **THEN** se muestra el toast de "sesión expirada", se cierra la sesión y el usuario es
  redirigido a `/login`, igual que antes de este change
