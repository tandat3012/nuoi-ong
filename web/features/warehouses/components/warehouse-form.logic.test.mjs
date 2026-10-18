import assert from 'node:assert/strict';
import {
  buildWarehousePayload,
  getWarehouseFormInitialValues,
  validateWarehouseForm,
} from './warehouse-form.logic.ts';

const empty = getWarehouseFormInitialValues();
assert.deepEqual(Object.keys(validateWarehouseForm(empty)), ['code', 'name']);
const values = {
  code: ' kho-a ',
  name: ' Kho A ',
  address: ' Địa chỉ ',
  description: '',
};
assert.deepEqual(validateWarehouseForm(values), {});
assert.deepEqual(buildWarehousePayload(values), {
  code: 'KHO-A',
  name: 'Kho A',
  address: 'Địa chỉ',
  description: null,
});
const warehouse = {
  code: 'KHO-A',
  name: 'Kho A',
  address: 'Địa chỉ',
  description: null,
  status: 'INACTIVE',
};
assert.equal(buildWarehousePayload(values, warehouse), null);
assert.deepEqual(
  buildWarehousePayload({ ...values, address: '', name: 'Kho B' }, warehouse),
  { name: 'Kho B', address: null },
);
assert.deepEqual(
  Object.keys(
    validateWarehouseForm({
      code: 'x'.repeat(51),
      name: 'x'.repeat(256),
      address: 'x'.repeat(4001),
      description: 'x'.repeat(4001),
    }),
  ),
  ['code', 'name', 'address', 'description'],
);
assert.equal(
  'status' in buildWarehousePayload({ ...values, name: 'New name' }, warehouse),
  false,
);
console.log(
  'Warehouse form: required fields, bounds, normalization, nullable PATCH and status exclusion passed.',
);
