CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('warehouse', 'delivery', 'admin'))
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    items JSONB NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(30) NOT NULL
        CHECK (
            status IN (
                'PLACED',
                'PACKED',
                'OUT_FOR_DELIVERY',
                'DELIVERED',
                'CANCELLED'
            )
        ),
    assigned_agent_id BIGINT
        REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_status_logs (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL
        REFERENCES orders(id),
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    changed_by BIGINT NOT NULL
        REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_status
    ON orders(status);

CREATE INDEX idx_orders_assigned_agent
    ON orders(assigned_agent_id);

CREATE INDEX idx_order_status_logs_order_id
    ON order_status_logs(order_id);

CREATE INDEX idx_order_status_logs_changed_at
    ON order_status_logs(changed_at);