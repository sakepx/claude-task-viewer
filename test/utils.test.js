const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { readSessionInfoFromJsonl, getSessionDisplayName } = require('../server');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

describe('readSessionInfoFromJsonl', () => {
  it('extracts customTitle, slug, and projectPath from JSONL', () => {
    const jsonlPath = path.join(FIXTURES_DIR, 'projects', 'test-project', 'test-session-1.jsonl');
    const result = readSessionInfoFromJsonl(jsonlPath);

    assert.equal(result.customTitle, 'Test Session Alpha');
    assert.equal(result.slug, 'test-slug');
    assert.equal(result.projectPath, '/home/user/my-project');
  });

  it('returns nulls for non-existent file', () => {
    const result = readSessionInfoFromJsonl('/nonexistent/path.jsonl');

    assert.equal(result.customTitle, null);
    assert.equal(result.slug, null);
    assert.equal(result.projectPath, null);
  });

  it('returns partial results for JSONL with only slug', () => {
    const tmpPath = path.join(FIXTURES_DIR, 'projects', 'test-project', 'slug-only.jsonl');
    const fs = require('fs');
    fs.writeFileSync(tmpPath, '{"role":"user","slug":"only-slug","message":"hi"}\n');

    try {
      const result = readSessionInfoFromJsonl(tmpPath);
      assert.equal(result.customTitle, null);
      assert.equal(result.slug, 'only-slug');
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });
});

describe('getSessionDisplayName', () => {
  it('returns customTitle when available', () => {
    const name = getSessionDisplayName('id-1', { customTitle: 'My Session', slug: 'my-slug' });
    assert.equal(name, 'My Session');
  });

  it('falls back to slug when no customTitle', () => {
    const name = getSessionDisplayName('id-1', { slug: 'my-slug' });
    assert.equal(name, 'my-slug');
  });

  it('returns null when no metadata', () => {
    const name = getSessionDisplayName('id-1', null);
    assert.equal(name, null);
  });

  it('returns null when metadata has no title or slug', () => {
    const name = getSessionDisplayName('id-1', {});
    assert.equal(name, null);
  });
});
