exports.up = async (knex) => {
  await knex.schema.createTable('tasks', (t) => {
    t.increments('id').primary();
    t.integer('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE'); // deleting a user removes their tasks
    t.string('title', 200).notNullable();
    t.text('description');
    t.enu('status', ['Pending', 'In Progress', 'Testing', 'Completed'], {
      useNative: false,
      enumName: 'tasks_status_check',
    })
      .notNullable()
      .defaultTo('Pending');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index('user_id');
    t.index('status');
  });
};

exports.down = (knex) => knex.schema.dropTableIfExists('tasks');
