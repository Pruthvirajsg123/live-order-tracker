INSERT INTO users (name, email, password_hash, role)
VALUES
    (
        'Warehouse User',
        'warehouse@example.com',
        'TEMP_HASH_WILL_BE_REPLACED',
        'warehouse'
    ),
    (
        'Delivery User',
        'delivery@example.com',
        'TEMP_HASH_WILL_BE_REPLACED',
        'delivery'
    ),
    (
        'Admin User',
        'admin@example.com',
        'TEMP_HASH_WILL_BE_REPLACED',
        'admin'
    );

INSERT INTO orders (
    customer_name,
    address,
    items,
    total_amount,
    status,
    assigned_agent_id
)
VALUES (
    'Test Customer',
    'Bengaluru',
    '[{"product":"Keyboard","quantity":1,"price":1200}]',
    1200.00,
    'PLACED',
    (
        SELECT id
        FROM users
        WHERE email = 'delivery@example.com'
    )
);

INSERT INTO order_status_logs (
    order_id,
    from_status,
    to_status,
    changed_by
)
VALUES (
    (
        SELECT id
        FROM orders
        WHERE customer_name = 'Test Customer'
    ),
    NULL,
    'PLACED',
    (
        SELECT id
        FROM users
        WHERE email = 'admin@example.com'
    )
);