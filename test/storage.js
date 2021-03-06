/*global describe, it, before, after, beforeEach, afterEach */
'use strict';
var path = require('path');
var fs = require('fs');
var assert = require('assert');
var sinon = require('sinon');
var Storage = require('../lib/util/storage');
var os = require('os');

function rm(path) {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
}

describe('Storage', function () {
  beforeEach(function () {
    this.beforeDir = process.cwd();
    this.storePath = path.join(os.tmpdir(), 'new-config.json');
    this.store = new Storage('test', this.storePath);
    this.store.set('foo', 'bar');
    this.saveSpy = sinon.spy(this.store, 'save');
  });

  afterEach(function (done) {
    var teardown = function () {
      rm(this.storePath);
      process.chdir(this.beforeDir);
      done();
    }.bind(this);

    if (this.store.pending) {
      this.store.once('save', teardown);
    } else {
      teardown();
    }
  });

  describe('.constructor()', function () {
    it('require a name parameter', function () {
      assert.throws(function () { new Storage(); });
    });

    it('take a path parameter', function () {
      var store = new Storage('test', path.join(__dirname, './fixtures/config.json'));
      assert.equal(store.get('testFramework'), 'mocha');
      assert.ok(store.existed);
    });
  });

  it('namespace each store sharing the same store file', function () {
    var store = new Storage('foobar', this.storePath);
    store.set('foo', 'something else');
    assert.ok(this.store.get('foo') === 'bar');
  });

  it('defaults store path to `.yo-rc.json`', function (done) {
    var tmp = os.tmpdir();
    process.chdir(tmp);
    var store = new Storage('yo');

    store.on('save', function () {
      var fileContent = JSON.parse(fs.readFileSync(path.join(tmp, '.yo-rc.json')));
      assert.equal(fileContent.yo.foo, 'bar');
      done();
    });

    store.set('foo', 'bar');
  });

  describe('#get()', function () {
    beforeEach(function () {
      this.store.set('testFramework', 'mocha');
      this.store.set('name', 'test');
    });

    it('get values', function () {
      assert.equal(this.store.get('testFramework'), 'mocha');
      assert.equal(this.store.get('name'), 'test');
    });
  });

  describe('#set()', function () {
    it('set values', function () {
      this.store.set('name', 'Yeoman!');
      assert.equal(this.store.get('name'), 'Yeoman!');
    });

    it('set multipe values at once', function () {
      this.store.set({ foo: 'bar', john: 'doe' });
      assert.equal(this.store.get('foo'), 'bar');
      assert.equal(this.store.get('john'), 'doe');
    });

    it('throws when invalid JSON values are passed', function () {
      assert.throws(this.store.set.bind(this, 'foo', function () {}));
    });

    it('save on each changes', function () {
      this.store.set('foo', 'bar');
      assert.equal(this.saveSpy.callCount, 1);
      this.store.set('foo', 'oo');
      assert.equal(this.saveSpy.callCount, 2);
    });

    describe('@return', function () {
      beforeEach(function () {
        this.storePath = path.join(os.tmpdir(), 'setreturn.json');
        this.store = new Storage('test', this.storePath);
      });

      afterEach(function () {
        rm(this.storePath);
      });

      it('the saved value (with key)', function (done) {
        this.store.once('save', done);
        assert.equal(this.store.set('name', 'Yeoman!'), 'Yeoman!');
      });

      it('the saved value (without key)', function (done) {
        this.store.once('save', done);
        assert.deepEqual(
          this.store.set({ foo: 'bar', john: 'doe' }),
          { foo: 'bar', john: 'doe' }
        );
      });

      it('the saved value (update values)', function (done) {
        this.store.once('save', done);
        this.store.set({ foo: 'bar', john: 'doe' });
        assert.deepEqual(
          this.store.set({ foo: 'moo' }),
          { foo: 'moo', john: 'doe' }
        );
      });
    });
  });

  describe('#getAll()', function () {
    beforeEach(function () {
      this.store.set({ foo: 'bar', john: 'doe' });
    });

    it('get all values', function () {
      assert.deepEqual(this.store.getAll(), this.store._store);
    });

    it('does not return a reference to the inner store', function () {
      assert.notEqual(this.store.getAll(), this.store._store);
    });
  });

  describe('#delete()', function () {
    beforeEach(function () {
      this.store.set('name', 'test');
    });

    it('delete value', function () {
      this.store.delete('name');
      assert.equal(this.store.get('name'), undefined);
    });
  });

  describe('#save()', function () {
    beforeEach(function (done) {
      this.forceSaveSpy = sinon.spy(Storage.prototype, 'forceSave');
      this.saveStorePath = path.join(os.tmpdir(), 'save.json');
      rm(this.saveStorePath);
      this.store = new Storage('test', this.saveStorePath);
      this.store.set('foo', 'bar');
      this.saveSpy = sinon.spy(this.store, 'save');
      this.store.once('save', done);
    });

    afterEach(function (done) {
      var teardown = function () {
        rm(this.saveStorePath);
        this.forceSaveSpy.restore();
        done();
      }.bind(this);

      if (this.store.pending) {
        this.store.once('save', teardown);
      } else {
        teardown();
      }
    });

    it('create storage file if none existed', function () {
      var fileContent = JSON.parse(fs.readFileSync(this.saveStorePath));
      assert.equal(fileContent.test.foo, 'bar');
      assert.ok(!this.store.existed);
    });

    it('debounce multiple calls', function (done) {
      this.store.once('save', function () {
        assert.equal(this.forceSaveSpy.callCount, 2); // It is called once in the setup
        assert.equal(this.saveSpy.callCount, 3);
        assert(!this.store.pending);
        done();
      }.bind(this));

      this.store.save();
      assert(this.store.pending);
      this.store.save();
      this.store.save();
    });

    describe('when multiples instances sharing same file', function () {
      beforeEach(function () {
        this.store2 = new Storage('test2', this.saveStorePath);
      });

      it('only update modified namespace', function () {
        this.store2.set('bar', 'foo');
        this.store2.forceSave();
        this.store.set('foo', 'bar');
        this.store.forceSave();

        var json = require(this.saveStorePath);
        assert.equal(json.test.foo, 'bar');
        assert.equal(json.test2.bar, 'foo');
      });
    });
  });

  describe('#forceSave()', function () {
    it('save file immediatly', function () {
      this.store.forceSave();
      var fileContent = JSON.parse(fs.readFileSync(this.storePath));
      assert.equal(fileContent.test.foo, 'bar');
    });
  });

  describe('#defaults()', function () {
    beforeEach(function () {
      this.store.set('val1', 1);
    });

    it('set defaults values if not predefined', function () {
      this.store.defaults({ val1: 3, val2: 4 });

      assert.equal(this.store.get('val1'), 1);
      assert.equal(this.store.get('val2'), 4);
    });

    it('require an Object as argument', function () {
      assert.throws(this.store.defaults.bind(this.store, 'foo'));
    });

    describe('@return', function () {
      beforeEach(function (done) {
        this.storePath = path.join(os.tmpdir(), 'defaultreturn.json');
        this.store = new Storage('test', this.storePath);
        this.store.set('val1', 1);
        this.store.set('foo', 'bar');
        this.store.on('save', done);
      });

      afterEach(function () {
        this.store.removeAllListeners('save');
        rm(this.storePath);
      });

      it('the saved value when passed an empty object', function () {
        assert.deepEqual(this.store.defaults({}), { foo: 'bar', val1: 1 });
      });

      it('the saved value when passed the same key', function () {
        assert.deepEqual(
          this.store.defaults({ foo: 'baz' }),
          { foo: 'bar', val1: 1 }
        );
      });

      it('the saved value when passed new key', function () {
        assert.deepEqual(
          this.store.defaults({ food: 'pizza' }),
          { foo: 'bar', val1: 1, food: 'pizza' }
        );
      });
    });
  });

});
