## REMOVED Requirements

### Requirement: El tema visual se aplica en toda la app y persiste
**Reason**: el modo de tema pasó a ser una preferencia por usuario, no de configuración del
negocio — ver el requirement equivalente en `session-state`.
**Migration**: ninguna — el campo `app_settings.theme_preference` queda sin usar (deuda
declarada en `design.md`), no se borra en este change.
