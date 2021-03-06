/*
 * Copyright (c) 2017 Roman Lakhtadyr
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { pickBy, isNil, last, isEmpty, sortBy, mapValues, startsWith } from 'lodash';
import { MultipleRowsQuery } from './query';
import errors from './errors';
import { BelongsTo, BelongsToMany, HasMany } from './relations';

export default fluorite => class Model {
  static NotFoundError = class NotFoundError extends errors.NotFoundError { };
  static IntegrityError = class IntegrityError extends errors.IntegrityError { };

  static table = null;
  static idAttribute = 'id';
  static scopes = {};

  static get fluorite() {
    return fluorite;
  }

  static get knex() {
    return this.fluorite.knex;
  }

  static create(attrs) {
    return new this(attrs);
  }

  static objects() {
    return new MultipleRowsQuery(this);
  }

  static find(id) {
    return this.objects().first({ [this.idAttribute]: id });
  }

  constructor(attributes, previousAttributes = {}) {
    this.attributes = attributes;
    this.previousAttributes = previousAttributes;
    this.relatedModels = {};
  }

  get id() {
    return this.attributes[this.constructor.idAttribute];
  }

  get attributesWithoutId() {
    return pickBy(this.attributes, (value, key) => (
      key !== this.constructor.idAttribute
    ));
  }

  get updatedAttributes() {
    return pickBy(this.attributesWithoutId, (value, key) => (
      value !== this.previousAttributes[key]
    ));
  }

  get isNew() {
    return isNil(this.id);
  }

  createKnexQuery() {
    const { knex } = this.constructor;
    const { transaction } = this.constructor.fluorite;

    if (transaction.isTransacting()) {
      return knex.transacting(transaction.currentTransaction())
        .from(this.constructor.table);
    }

    return this.constructor.knex.from(this.constructor.table);
  }

  get(name) {
    return this.attributes[name];
  }

  related(name) {
    return this.relatedModels[name];
  }

  set(name, value) {
    if (name instanceof Object) {
      this.attributes = { ...this.attributes, ...name };
      return;
    }
    this.attributes[name] = value;
  }

  hasMany(
    relatedClass,
    foreignKey = `${this.constructor.name.toLowerCase()}_id`,
    foreignKeyTarget = this.constructor.idAttribute,
  ) {
    return new HasMany(this, relatedClass, foreignKey, foreignKeyTarget);
  }

  belongsTo(
    relatedClass,
    foreignKey = `${relatedClass.name.toLowerCase()}_id`,
    foreignKeyTarget = relatedClass.idAttribute,
  ) {
    return new BelongsTo(this, relatedClass, foreignKey, foreignKeyTarget);
  }

  belongsToMany(
    relatedClass,
    pivotTableName = sortBy([this.constructor.table, relatedClass.table]).join('_'),
    thisForeignKey = `${this.constructor.name.toLowerCase()}_id`,
    thatForeignKey = `${relatedClass.name.toLowerCase()}_id`,
    thisForeignKeyTarget = this.constructor.idAttribute,
    thatForeignKeyTarget = relatedClass.idAttribute,
  ) {
    return new BelongsToMany(
      this,
      relatedClass,
      pivotTableName,
      thisForeignKey,
      thatForeignKey,
      thisForeignKeyTarget,
      thatForeignKeyTarget,
    );
  }

  toJSON() {
    return {
      ...pickBy(
        this.attributes,
        (val, key) => !startsWith(key, '__'),
      ),
      ...mapValues(
        this.relatedModels,
        modelOrModels => (
          Array.isArray(modelOrModels)
            ? modelOrModels.map(m => m.toJSON())
            : modelOrModels.toJSON()
        ),
      ),
    };
  }

  setRelatedData(name, data) {
    this.relatedModels[name] = data;
  }

  /*
   * Methods that executes SQL statements
   */

  async save(name, value) {
    if (!isEmpty(name)) {
      this.set(name, value);
      return this.update();
    }

    if (this.isNew) {
      return this.insert();
    }

    return this.update();
  }

  async refresh() {
    const attributes = await this.createKnexQuery()
      .from(this.constructor.table)
      .where(this.constructor.idAttribute, this.id)
      .first();

    this.attributes = attributes;
    this.previousAttributes = Object.assign({}, attributes);
  }

  async remove() {
    if (this.isNew) {
      throw new this.constructor.NotFoundError('Can\'t remove new entity');
    }

    await this.createKnexQuery()
      .where(this.constructor.idAttribute, this.id)
      .delete();
  }

  async insert() {
    const ids = await this.createKnexQuery().insert(
      this.attributesWithoutId,
      this.constructor.idAttribute,
    );
    const lastId = last(ids);
    this.attributes[this.constructor.idAttribute] = lastId;
    this.previousAttributes = this.attributes;
    return lastId;
  }

  async update() {
    const { updatedAttributes } = this;
    if (isEmpty(updatedAttributes)) {
      return;
    }
    await this.createKnexQuery()
      .update(updatedAttributes)
      .where({ [this.constructor.idAttribute]: this.id });
    this.previousAttributes = this.attributes;
  }

  async load(relation) {
    const data = await this[relation]();
    this.setRelatedData(relation, data);
  }
};
