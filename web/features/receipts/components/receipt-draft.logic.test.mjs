import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  receiptSaveErrorMessage,
  supportsQuantityDraftConfirm as confirmable,
  supportsQuantityDraftEdit as editable,
  validateReceiptDraft,
} from './receipt-draft.logic.ts';

// Older cases describe tracking modes per item; the API now returns it on each line.
const withModes = (detail, references) => ({
  ...detail,
  items: detail.items.map((line) => ({
    ...line,
    trackingMode: references?.[line.itemId]?.item.trackingMode ?? null,
  })),
});
const supportsQuantityDraftEdit = (detail, references) =>
  editable(withModes(detail, references));
const supportsQuantityDraftConfirm = (detail, references) =>
  confirmable(withModes(detail, references));

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
  const submitted = {
    ...detail,
    receipt: { ...detail.receipt, status: 'PENDING_APPROVAL' },
  };
  // A submitted receipt can be confirmed by an approver but no longer edited.
  assert.equal(supportsQuantityDraftConfirm(submitted, references), true);
  assert.equal(supportsQuantityDraftEdit(submitted, references), false);
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

test('existing-lot lines send only lotId and confirm without a lot number', () => {
  const line = (patch) => ({
    ...draft(),
    items: [{ itemId: 'item-a', quantity: '2', ...patch }],
  });
  assert.equal(validateReceiptDraft(line({ lotId: 'lot-a' })), null);
  for (const patch of [
    { lotId: '' },
    { lotId: 'lot-a', lotNumber: 'LOT-1' },
    { lotId: 'lot-a', manufacturedDate: '2026-01-01' },
    { lotId: 'lot-a', expiryDate: '2027-01-01' },
  ])
    assert.ok(validateReceiptDraft(line(patch)), JSON.stringify(patch));

  const detail = {
    receipt: { status: 'DRAFT' },
    items: [
      {
        itemId: 'item-a',
        quantity: '2',
        trackingMode: 'LOT',
        lotId: 'lot-a',
        lotNumber: null,
        manufacturedDate: null,
        expiryDate: null,
        assetId: null,
        assetCode: null,
        serialNumber: null,
        locationId: null,
      },
    ],
  };
  assert.equal(editable(detail), true);
  assert.equal(confirmable(detail), true);
  for (const patch of [
    { lotNumber: 'LOT-1' },
    { expiryDate: '2027-01-01' },
    { trackingMode: 'QUANTITY' },
    { trackingMode: 'ASSET', assetCode: 'A-1', quantity: '1' },
    { trackingMode: null },
  ]) {
    const value = { ...detail, items: [{ ...detail.items[0], ...patch }] };
    assert.equal(confirmable(value), false, JSON.stringify(patch));
  }
});

test('maps lot and validation rejections from the API', () => {
  assert.match(
    receiptSaveErrorMessage(404, 'Selected lot not found for this farm and item', 'tạo'),
    /Lô đã chọn không còn tồn tại/,
  );
  assert.match(
    receiptSaveErrorMessage(
      400,
      'lotId only selects an existing lot of a LOT item, without new lot metadata',
      'cập nhật',
    ),
    /chỉ dùng cho vật tư theo lô/,
  );
  assert.match(
    receiptSaveErrorMessage(400, 'Expiry date cannot be earlier than manufactured date', 'tạo'),
    /Hạn sử dụng phải từ ngày sản xuất/,
  );
  assert.match(receiptSaveErrorMessage(400, 'other', 'tạo'), /Dữ liệu không hợp lệ.*other/);
  assert.match(receiptSaveErrorMessage(403, '', 'cập nhật'), /không có quyền cập nhật/);
  assert.match(receiptSaveErrorMessage(409, 'x', 'tạo'), /Không thể tạo/);
  assert.match(receiptSaveErrorMessage(null, '', 'tạo'), /tải lại danh sách/);
});
