import { ServiceUnavailableException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { FARM_ROLES_KEY } from '../auth/farm-access/farm-access.decorator';
import { FarmAccessGuard } from '../auth/farm-access/farm-access.guard';
import { WAREHOUSE_MANAGE_ROLES } from '../auth/farm-access/farm-role-groups';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { parseReportFilters, reportFilterInstruction } from './report-filters';

const answer = (filters: object) =>
  new Response(
    JSON.stringify({
      steps: [
        { type: 'thought' },
        {
          type: 'model_output',
          content: [{ type: 'text', text: JSON.stringify(filters) }],
        },
      ],
    }),
    { status: 200 },
  );

const filters = {
  metric: 'STOCK_MOVEMENT',
  warehouse: 'Cà Phê',
  item: 'mật ong hoa cà phê',
  dateFrom: '2026-11-01',
  dateTo: '2026-11-27',
};

describe('parseReportFilters', () => {
  it('keeps a valid answer', () => {
    expect(parseReportFilters(JSON.stringify(filters))).toEqual(filters);
  });

  it('drops a period with a day that does not exist', () => {
    expect(
      parseReportFilters(
        JSON.stringify({
          ...filters,
          dateFrom: '2026-02-01',
          dateTo: '2026-02-30',
        }),
      ),
    ).toMatchObject({ dateFrom: null, dateTo: null, item: filters.item });
  });

  it('drops a reversed, half-open or longer than 366 days period', () => {
    for (const [dateFrom, dateTo] of [
      ['2026-11-27', '2026-11-01'],
      ['2026-11-01', null],
      ['2025-01-01', '2026-11-27'],
    ])
      expect(
        parseReportFilters(JSON.stringify({ ...filters, dateFrom, dateTo })),
      ).toMatchObject({ dateFrom: null, dateTo: null });
    expect(
      parseReportFilters(
        JSON.stringify({
          ...filters,
          dateFrom: '2025-11-27',
          dateTo: '2026-11-27',
        }),
      ),
    ).toMatchObject({ dateFrom: '2025-11-27' });
  });

  it('turns blank names into null and rejects other shapes', () => {
    expect(
      parseReportFilters(JSON.stringify({ ...filters, warehouse: '  ' })),
    ).toMatchObject({ warehouse: null });
    expect(parseReportFilters('not json')).toBeNull();
    expect(
      parseReportFilters(JSON.stringify({ ...filters, metric: 'DROP' })),
    ).toBeNull();
  });

  it('tells the model today in Vietnam', () => {
    expect(reportFilterInstruction('2026-11-27')).toContain(
      'Hôm nay là 2026-11-27',
    );
  });
});

describe('AssistantService.reportFilters', () => {
  const service = new AssistantService();
  let fetchMock: jest.SpyInstance<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >;
  const env = { ...process.env };
  beforeEach(() => {
    process.env.AI_API_KEY = 'test_key';
    delete process.env.AI_MODEL;
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });

  it('sends the question with the Vietnam date and reads the model output', async () => {
    fetchMock.mockResolvedValueOnce(answer(filters));
    // 18:00 UTC on 26/11 is already 27/11 in Vietnam.
    await expect(
      service.reportFilters('hỏi', new Date('2026-11-26T18:00:00Z')),
    ).resolves.toEqual(filters);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init!.body as string) as Record<string, unknown>;
    expect(body.model).toBe('gemini-3.5-flash-lite');
    expect(body.input).toBe('hỏi');
    expect(body.system_instruction).toContain('2026-11-27');
    expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe(
      'test_key',
    );
  });

  it('uses AI_MODEL when set', async () => {
    process.env.AI_MODEL = 'gemini-3.6-flash';
    fetchMock.mockResolvedValueOnce(answer(filters));
    await service.reportFilters('hỏi');
    expect(
      (
        JSON.parse(fetchMock.mock.calls[0][1]!.body as string) as {
          model: string;
        }
      ).model,
    ).toBe('gemini-3.6-flash');
  });

  it('retries once on 503, not on 429', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(answer(filters));
    await expect(service.reportFilters('hỏi')).resolves.toEqual(filters);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    await expect(service.reportFilters('hỏi')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('answers 503 AI_UNAVAILABLE without a key, on network errors and on bad output', async () => {
    const code = async () => {
      try {
        await service.reportFilters('hỏi');
      } catch (error) {
        return (
          (error as ServiceUnavailableException).getResponse() as {
            code: string;
          }
        ).code;
      }
    };
    delete process.env.AI_API_KEY;
    expect(await code()).toBe('AI_UNAVAILABLE');
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.AI_API_KEY = 'test_key';
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    expect(await code()).toBe('AI_UNAVAILABLE');
    fetchMock.mockResolvedValueOnce(answer({ metric: 'X' }));
    expect(await code()).toBe('AI_UNAVAILABLE');
    fetchMock.mockResolvedValueOnce(new Response('{"steps":[]}'));
    expect(await code()).toBe('AI_UNAVAILABLE');
  });
});

describe('AssistantController access', () => {
  const handler = Object.getOwnPropertyDescriptor(
    AssistantController.prototype,
    'reportFilters',
  )!.value as object;

  // The guard runs before the handler, so a caller without report access never reaches Gemini.
  it('needs the stock report roles', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(
      FarmAccessGuard,
    );
    expect(Reflect.getMetadata(FARM_ROLES_KEY, handler)).toEqual([
      ...WAREHOUSE_MANAGE_ROLES,
    ]);
  });
});
