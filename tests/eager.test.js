import knex from './services/knex';
import fluorite from './services/fluorite';

class Address extends fluorite.Model {
  static table = 'addresses';
  static columns = ['id', 'address'];
}

class Place extends fluorite.Model {
  static table = 'places';
  static columns = ['id', 'place', 'address_id'];

  address() {
    return this.belongsTo(Address);
  }
}

class Thing extends fluorite.Model {
  static table = 'things';
  static columns = ['id', 'title', 'user_id'];
}

class User extends fluorite.Model {
  static table = 'users';
  static columns = ['id', 'name', 'place_id'];

  things() {
    return this.hasMany(Thing);
  }

  place() {
    return this.belongsTo(Place);
  }
}

beforeEach(async () => {
  await knex.schema.createTable('addresses', (table) => {
    table.increments();
    table.string('address').notNullable();
  });

  await knex('addresses').insert({ id: 1, address: 'Peschanaya' });
  await knex('addresses').insert({ id: 2, address: 'Khreschatyk' });

  await knex.schema.createTable('places', (table) => {
    table.increments();
    table.string('place').notNullable();
    table.integer('address_id').unsigned().notNullable().references('addresses.id');
  });

  await knex('places').insert({ id: 1, place: 'Home', address_id: 1 });
  await knex('places').insert({ id: 2, place: 'Work', address_id: 2 });

  await knex.schema.createTable('users', (table) => {
    table.increments();
    table.string('name').notNullable();
    table.integer('place_id').unsigned().notNullable().references('places.id');
  });

  await knex('users').insert({ id: 1, name: 'John Doe', place_id: 1 });
  await knex('users').insert({ id: 2, name: 'Bob Marley', place_id: 1 });
  await knex('users').insert({ id: 3, name: 'Billy', place_id: 2 });

  await knex.schema.createTable('things', (table) => {
    table.increments();
    table.string('title').notNullable();
    table.integer('user_id').unsigned().notNullable().references('users.id');
  });

  await knex('things').insert({ id: 1, title: 'Book', user_id: 1 });
  await knex('things').insert({ id: 2, title: 'Pen', user_id: 1 });
  await knex('things').insert({ id: 3, title: 'Phone', user_id: 2 });
});

afterEach(async () => {
  await knex.schema.dropTable('things');
  await knex.schema.dropTable('users');
  await knex.schema.dropTable('places');
  await knex.schema.dropTable('addresses');
});


describe('Eager Function Tests', () => {
  it('Fetch user without relations', async () => {
    const user = await User.find(1);
    expect(user.toJSON()).toEqual({
      id: 1,
      name: 'John Doe',
      place_id: 1,
    });
  });

  it('Fetch user with single relation', async () => {
    const user = await User.find(1).including('place');
    expect(user.toJSON()).toEqual({
      id: 1,
      name: 'John Doe',
      place_id: 1,
      place: {
        address_id: 1,
        id: 1,
        place: 'Home',
      },
    });
  });

  it('Fetch user with nested relation', async () => {
    const user = await User.find(1).including('place.address', 'things');
    expect(user.toJSON()).toEqual({
      id: 1,
      name: 'John Doe',
      place_id: 1,
      place: {
        address_id: 1,
        id: 1,
        place: 'Home',
        address: {
          id: 1,
          address: 'Peschanaya',
        },
      },
      things: [
        { id: 1, title: 'Book', user_id: 1 },
        { id: 2, title: 'Pen', user_id: 1 },
      ],
    });
  });


  it('Fetch user with all relations', async () => {
    const user = await User.find(1).including('place.address');
    expect(user.toJSON()).toEqual({
      id: 1,
      name: 'John Doe',
      place_id: 1,
      place: {
        address_id: 1,
        id: 1,
        place: 'Home',
        address: {
          id: 1,
          address: 'Peschanaya',
        },
      },
    });
  });
});