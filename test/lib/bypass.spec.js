'use strict';

const helper = require('../helper');
const fs = require('fs');
const mock = require('../../lib/index');
const path = require('path');
const withPromise = helper.withPromise;

const assert = helper.assert;

describe('mock.bypass()', () => {
  afterEach(mock.restore);

  it('runs a synchronous function using the real filesystem', () => {
    mock({'/path/to/file': 'content'});

    assert.equal(fs.readFileSync('/path/to/file', 'utf8'), 'content');
    assert.isNotOk(fs.existsSync(__filename));
    assert.isOk(mock.bypass(() => fs.existsSync(__filename)));

    assert.isNotOk(fs.existsSync(__filename));
  });

  it('handles functions that throw', () => {
    mock({'/path/to/file': 'content'});

    const error = new Error('oops');

    assert.throws(() => {
      mock.bypass(() => {
        assert.isFalse(fs.existsSync('/path/to/file'));
        throw error;
      });
    }, error);

    assert.equal(fs.readFileSync('/path/to/file', 'utf8'), 'content');
  });

  it('bypasses patched process.cwd() and process.chdir()', () => {
    const originalCwd = process.cwd();
    mock({
      dir: {}
    });

    process.chdir('dir');
    assert.equal(process.cwd(), path.join(originalCwd, 'dir'));

    mock.bypass(() => {
      assert.equal(process.cwd(), originalCwd);
      process.chdir('lib');
      assert.equal(process.cwd(), path.join(originalCwd, 'lib'));
      process.chdir('..');
      assert.equal(process.cwd(), originalCwd);
    });
    assert.equal(process.cwd(), path.join(originalCwd, 'dir'));
    mock.restore();

    assert.equal(process.cwd(), originalCwd);
  });

  withPromise.it('runs an async function using the real filesystem', done => {
    mock({'/path/to/file': 'content'});

    assert.equal(fs.readFileSync('/path/to/file', 'utf8'), 'content');
    assert.isFalse(fs.existsSync(__filename));

    const promise = mock.bypass(() => fs.promises.stat(__filename));
    assert.instanceOf(promise, Promise);

    promise
      .then(stat => {
        assert.isTrue(stat.isFile());
        assert.isFalse(fs.existsSync(__filename));
        done();
      })
      .catch(done);
  });

  withPromise.it('handles promise rejection', done => {
    mock({'/path/to/file': 'content'});

    assert.equal(fs.readFileSync('/path/to/file', 'utf8'), 'content');
    assert.isFalse(fs.existsSync(__filename));

    const error = new Error('oops');

    const promise = mock.bypass(() => {
      assert.isTrue(fs.existsSync(__filename));
      return Promise.reject(error);
    });
    assert.instanceOf(promise, Promise);

    promise
      .then(() => {
        done(new Error('expected rejection'));
      })
      .catch(err => {
        assert.equal(err, error);

        assert.equal(fs.readFileSync('/path/to/file', 'utf8'), 'content');
        done();
      });
  });
});
