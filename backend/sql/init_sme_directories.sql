CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(120) NOT NULL,
  CONSTRAINT uix_department_user_name UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(120) NOT NULL,
  CONSTRAINT uix_project_user_name UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS operation_dimensions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  transaction_type VARCHAR(10) NOT NULL,
  transaction_id INTEGER NOT NULL,
  department_id INTEGER NULL REFERENCES departments(id),
  project_id INTEGER NULL REFERENCES projects(id),
  CONSTRAINT uix_operation_dimension UNIQUE (transaction_type, transaction_id)
);
