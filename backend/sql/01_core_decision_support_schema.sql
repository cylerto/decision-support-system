-- Core schema for Decision Support System (Step 1)
-- Domain: management financial accounting and analytics for a small enterprise

CREATE TYPE pnl_item_type AS ENUM ('income', 'expense');

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pnl_items (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(120) NOT NULL,
  item_type  pnl_item_type NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uix_pnl_item_user_name_type UNIQUE (user_id, name, item_type),
  CONSTRAINT uix_pnl_item_id_user UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS departments (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(120) NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uix_department_user_name UNIQUE (user_id, name),
  CONSTRAINT uix_department_id_user UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(120) NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uix_project_user_name UNIQUE (user_id, name),
  CONSTRAINT uix_project_id_user UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS operations (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_date DATE NOT NULL,
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  pnl_item_id    BIGINT NOT NULL,
  department_id  BIGINT NOT NULL,
  project_id     BIGINT NULL,
  note           VARCHAR(255) NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_operations_pnl
    FOREIGN KEY (pnl_item_id, user_id)
    REFERENCES pnl_items(id, user_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_operations_department
    FOREIGN KEY (department_id, user_id)
    REFERENCES departments(id, user_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_operations_project
    FOREIGN KEY (project_id, user_id)
    REFERENCES projects(id, user_id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_operations_user_date
  ON operations(user_id, operation_date);
CREATE INDEX IF NOT EXISTS idx_operations_user_department
  ON operations(user_id, department_id);
CREATE INDEX IF NOT EXISTS idx_operations_user_project
  ON operations(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_operations_user_pnl
  ON operations(user_id, pnl_item_id);

CREATE TABLE IF NOT EXISTS budgets (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_month   DATE NOT NULL CHECK (
    period_month = date_trunc('month', period_month)::date
  ),
  pnl_item_id    BIGINT NOT NULL,
  planned_amount NUMERIC(14,2) NOT NULL CHECK (planned_amount >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_budgets_pnl
    FOREIGN KEY (pnl_item_id, user_id)
    REFERENCES pnl_items(id, user_id)
    ON DELETE RESTRICT,
  CONSTRAINT uix_budget_user_month_pnl UNIQUE (user_id, period_month, pnl_item_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action      VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id   BIGINT NULL,
  old_data    JSONB NULL,
  new_data    JSONB NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_created_at
  ON audit_logs(user_id, created_at DESC);

