import fluorite from '../services/fluorite';

export default class Foo extends fluorite.Model<Foo> {
  static table = 'foo';
  static scopes = {
    firstOne: q => q.limit(1),
    lastFew: (q, amount) => q.limit(amount).query(knex => knex.orderBy(Foo.idAttribute, 'desc')),
  };
  static columns = ['id', 'name', 'age'];
}