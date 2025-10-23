from alembic import op

revision = "622834b995a6"
down_revision = "d407c89bd3a6"
branch_labels = None
depends_on = None

def upgrade():
    # clients
    op.execute('CREATE INDEX IF NOT EXISTS ix_clients_full_name ON clients (full_name)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_clients_email ON clients (email)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_clients_join_date ON clients (join_date)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_clients_is_active ON clients (is_active)')

    # payments
    op.execute('CREATE INDEX IF NOT EXISTS ix_payments_client_id ON payments (client_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_payments_created_at ON payments (created_at)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_payments_period ON payments (period_year, period_month)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_payments_method ON payments (method)')

def downgrade():
    # payments
    op.execute('DROP INDEX IF EXISTS ix_payments_method')
    op.execute('DROP INDEX IF EXISTS ix_payments_period')
    op.execute('DROP INDEX IF EXISTS ix_payments_created_at')
    op.execute('DROP INDEX IF EXISTS ix_payments_client_id')

    # clients
    op.execute('DROP INDEX IF EXISTS ix_clients_is_active')
    op.execute('DROP INDEX IF EXISTS ix_clients_join_date')
    op.execute('DROP INDEX IF EXISTS ix_clients_email')
    op.execute('DROP INDEX IF EXISTS ix_clients_full_name')
