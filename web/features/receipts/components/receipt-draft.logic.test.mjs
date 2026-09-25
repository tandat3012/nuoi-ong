import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  supportsQuantityDraftConfirm,
  supportsQuantityDraftEdit,
  validateReceiptDraft,
} from './receipt-draft.logic.ts';

const draft = () => ({
  warehouseId: 'warehouse-a',
  receiptCode: 'PN-01',
  items: [{ itemId: 'item-a', quantity: '1.001', unitPrice: '0' }],
});

test('requires warehouse, nonblank code, and at least one identified item', () => {
  for (const patch of [
    { warehouseId: '' },
    { receiptCode: '   ' },
    { receiptCode: 'a'.repeat(51) },
    { items: [] },
    { items: [{ itemId: '', quantity: '1' }] },
    { note: 'x'.repeat(4001) },
  ]) {
    assert.equal(
      typeof validateReceiptDraft({ ...draft(), ...patch }),
      'string',
    );
  }
  assert.equal(validateReceiptDraft(draft()), null);
});

test('validates exact quantity and price boundaries without floating-point coercion', () => {
  const value = draft();
  value.items[0] = {
    itemId: 'item-a',
    quantity: '999999999999999.999',
    unitPrice: '9999999999999999.99',
  };
  assert.equal(validateReceiptDraft(value), null);
  for (const quantity of [
    '0',
    '0.000',
    '-1',
    '1e3',
    '1,5',
    '01',
    '1.0001',
    '1000000000000000',
    'NaN',
    '',
  ]) {
    assert.ok(
      validateReceiptDraft({
        ...draft(),
        items: [{ itemId: 'item-a', quantity }],
      }),
      quantity,
    );
  }
  for (const unitPrice of ['-0.01', '1.001', '10000000000000000', '1e2', '']) {
    assert.ok(
      validateReceiptDraft({
        ...draft(),
        items: [{ itemId: 'item-a', quantity: '0.001', unitPrice }],
      }),
      unitPrice,
    );
  }
  assert.equal(
    validateReceiptDraft({
      ...draft(),
      items: [{ itemId: 'item-a', quantity: '0.001' }],
    }),
    null,
  );
});

test('permits quantity and valid LOT drafts without losing line metadata', () => {
  const detail = {
    receipt: { status: 'DRAFT' },
    items: [
      {
        itemId: 'item-a',
        lotId: null,
        lotNumber: null,
        manufacturedDate: null,
        expiryDate: null,
        assetId: null,
        assetCode: null,
        serialNumber: null,
        note: null,
      },
    ],
  };
  const references = {
    'item-a': { item: { trackingMode: 'QUANTITY' } },
  };
  assert.equal(supportsQuantityDraftEdit(detail, references), true);
  assert.equal(supportsQuantityDraftEdit(detail, undefined), false);
  assert.equal(
    supportsQuantityDraftEdit(detail, {
      'item-a': { item: { trackingMode: 'LOT' } },
    }),
    true,
  );
  for (const patch of [
    { receipt: { status: 'CONFIRMED' } },
    { items: [] },
    { items: [{ ...detail.items[0], lotNumber: 'LOT-1' }] },
    { items: [{ ...detail.items[0], assetCode: 'ASSET-1' }] },
  ]) {
    assert.equal(
      supportsQuantityDraftEdit({ ...detail, ...patch }, references),
      false,
    );
  }
  assert.equal(
    supportsQuantityDraftEdit(
      { ...detail, items: [{ ...detail.items[0], note: 'keep this' }] },
      references,
    ),
    true,
  );
  const lot = {
    ...detail,
    items: [
      {
        ...detail.items[0],
        lotNumber: 'LOT-1',
        manufacturedDate: '2026-01-01',
        expiryDate: '2027-01-01',
      },
    ],
  };
  const lotReferences = {
    'item-a': { item: { trackingMode: 'LOT' } },
  };
  assert.equal(supportsQuantityDraftEdit(lot, lotReferences), true);
  assert.equal(supportsQuantityDraftConfirm(lot, lotReferences), true);
  assert.equal(
    supportsQuantityDraftConfirm(
      { ...lot, items: [{ ...lot.items[0], lotNumber: null }] },
      lotReferences,
    ),
    false,
  );
  assert.equal(
    supportsQuantityDraftEdit(
      { ...lot, items: [{ ...lot.items[0], lotNumber: null }] },
      lotReferences,
    ),
    true,
  );
  assert.equal(
    supportsQuantityDraftConfirm(
      { ...lot, items: [{ ...lot.items[0], assetCode: 'ASSET-1' }] },
      lotReferences,
    ),
    false,
  );
});

test('validates LOT number and dates before saving a draft', () => {
  const withLot = (line) => ({
    ...draft(),
    items: [{ ...draft().items[0], ...line }],
  });
  assert.equal(
    validateReceiptDraft(
      withLot({
        lotNumber: 'LOT-1',
        manufacturedDate: '2026-01-01',
        expiryDate: '2027-01-01',
      }),
    ),
    null,
  );
  for (const line of [
    { lotNumber: '' },
    { lotNumber: 'a'.repeat(101) },
    { lotNumber: 'LOT-1', manufacturedDate: '2026-02-30' },
    { lotNumber: 'LOT-1', expiryDate: '2026-13-01' },
    {
      lotNumber: 'LOT-1',
      manufacturedDate: '2027-01-01',
      expiryDate: '2026-01-01',
    },
    { expiryDate: '2027-01-01' },
  ]) {
    assert.ok(validateReceiptDraft(withLot(line)));
  }
  assert.ok(
    validateReceiptDraft({
      ...draft(),
      items: [
        { itemId: 'item-a', quantity: '1', lotNumber: 'LOT-1' },
        { itemId: 'item-a', quantity: '2', lotNumber: 'LOT-1' },
      ],
    }),
  );
});

test('validates and allows draft edits for ASSET lines', () => {
  const detail = {
    receipt: { status: 'DRAFT' },
    items: [
      {
        itemId: 'asset-a',
        quantity: '1.000',
        lotId: null,
        lotNumber: null,
        manufacturedDate: null,
        expiryDate: null,
        assetId: null,
        assetCode: 'SMOKER-001',
        serialNumber: 'SERIAL-001',
        locationId: 'location-a',
        note: 'new asset',
      },
    ],
  };
  const references = {
    'asset-a': { item: { trackingMode: 'ASSET' } },
  };
  assert.equal(supportsQuantityDraftEdit(detail, references), true);
  assert.equal(supportsQuantityDraftConfirm(detail, references), true);
  for (const quantity of ['1', '1.0', '1.000']) {
    const value = { ...detail, items: [{ ...detail.items[0], quantity }] };
    assert.equal(supportsQuantityDraftEdit(value, references), true);
    assert.equal(supportsQuantityDraftConfirm(value, references), true);
  }
  for (const quantity of ['0', '2', '1.001', 'NaN', '', '1e0', ' 1 ']) {
    const value = { ...detail, items: [{ ...detail.items[0], quantity }] };
    assert.equal(supportsQuantityDraftEdit(value, references), false);
    assert.equal(supportsQuantityDraftConfirm(value, references), false);
  }
  for (const patch of [{ assetCode: '' }, { lotNumber: 'LOT-1' }]) {
    assert.equal(
      supportsQuantityDraftConfirm(
        { ...detail, items: [{ ...detail.items[0], ...patch }] },
        references,
      ),
      false,
    );
  }
  assert.equal(
    supportsQuantityDraftConfirm(
      { ...detail, items: [{ ...detail.items[0], quantity: '2' }] },
      references,
    ),
    false,
  );

  const assetInput = {
    ...draft(),
    items: [
      {
        itemId: 'asset-a',
        quantity: '1',
        assetCode: 'SMOKER-001',
        serialNumber: 'SERIAL-001',
        locationId: 'location-a',
        note: 'new asset',
      },
    ],
  };
  assert.equal(validateReceiptDraft(assetInput), null);
  assert.equal(
    validateReceiptDraft({
      ...assetInput,
      items: [{ ...assetInput.items[0], quantity: '1.000' }],
    }),
    null,
  );
  assert.ok(
    validateReceiptDraft({
      ...assetInput,
      items: [{ ...assetInput.items[0], quantity: '2' }],
    }),
  );
  assert.ok(
    validateReceiptDraft({
      ...assetInput,
      items: [
        assetInput.items[0],
        { ...assetInput.items[0], itemId: 'asset-b' },
      ],
    }),
  );
});

test('only exposes quantity confirmation for quantity tracked lines', () => {
  const detail = {
    receipt: { status: 'DRAFT' },
    items: [
      {
        itemId: 'item-a',
        lotId: null,
        lotNumber: null,
        manufacturedDate: null,
        expiryDate: null,
        assetId: null,
        assetCode: null,
        serialNumber: null,
        note: null,
      },
    ],
  };
  assert.equal(
    supportsQuantityDraftConfirm(detail, {
      'item-a': { item: { trackingMode: 'QUANTITY' } },
    }),
    true,
  );
  assert.equal(
    supportsQuantityDraftConfirm(detail, {
      'item-a': { item: { trackingMode: 'LOT' } },
    }),
    false,
  );
  assert.equal(
    supportsQuantityDraftConfirm({ ...detail, items: [] }, {}),
    false,
  );
});
