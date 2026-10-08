exports.up = async (knex) => {
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('name', 100).notNullable();
    t.string('email', 255).notNullable().unique();
    t.string('password', 255).notNullable(); // bcrypt hash, never plain text
    // text + CHECK constraint (portable and easy to extend, unlike a native enum)
    t.enu('role', ['user', 'admin'], { useNative: false, enumName: 'users_role_check' })
      .notNullable()
      .defaultTo('user');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = (knex) => knex.schema.dropTableIfExists('users');
