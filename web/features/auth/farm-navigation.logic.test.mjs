import assert from 'node:assert/strict';
import { test } from 'node:test';
import { farmSelectionHref } from './farm-navigation.logic.ts';

const id = '123e4567-e89b-42d3-a456-426614174000';
const paths = ['/receipts', '/transfers', '/counts', '/requests'];

test('initial farm resolution and same-farm refresh preserve direct document links', () => {
  for (const path of paths) {
    const href = `https://farm.example${path}?id=${id}`;
    assert.equal(farmSelectionHref(null, 'farm-a', href), null, path);
    assert.equal(farmSelectionHref('farm-a', 'farm-a', href), null, path);
  }
});

test('farm changes clear document selections on every affected page and retain other query parameters', () => {
  for (const path of paths) {
    const href = `https://farm.example${path}?type=transfer&status=ALL&page=2&id=${id}&id=duplicate#list`;
    assert.equal(farmSelectionHref('farm-a', 'farm-b', href), `${path}?type=transfer&status=ALL&page=2#list`, path);
    assert.equal(farmSelectionHref('farm-b', 'farm-a', href), `${path}?type=transfer&status=ALL&page=2#list`, path);
    assert.equal(farmSelectionHref('farm-a', null, href), `${path}?type=transfer&status=ALL&page=2#list`, path);
    assert.equal(farmSelectionHref('farm-a', 'farm-b', `https://farm.example${path}?id=${id}`), path);
  }
  assert.equal(farmSelectionHref('farm-a', 'farm-b', `https://farm.example/requests?type=maintenance&id=${id}`), '/requests?type=maintenance');
});

test('farm navigation leaves unselected pages and unrelated routes untouched', () => {
  for (const path of paths) {
    assert.equal(farmSelectionHref('farm-a', 'farm-b', `https://farm.example${path}?page=2`), null, path);
  }
  for (const path of ['/assets', '/issues', '/orders', '/requests/other']) {
    assert.equal(farmSelectionHref('farm-a', 'farm-b', `https://farm.example${path}?id=${id}`), null, path);
  }
});
