import { FARM_ROLES_KEY } from '../auth/farm-access/farm-access.decorator';
import { StoreAdminController } from './store-admin.controller';

describe('StoreAdminController roles', () => {
  const roles = (handler: keyof StoreAdminController) =>
    Reflect.getMetadata(
      FARM_ROLES_KEY,
      Object.getOwnPropertyDescriptor(StoreAdminController.prototype, handler)!
        .value as object,
    ) as string[];

  // AC29 / D09: the delivery fee table is shared by every farm.
  it('lets only ADMIN change the shared delivery fees', () => {
    expect(roles('updateShippingFees')).toEqual(['ADMIN']);
  });

  it('still lets FARM_OWNER configure the sales of their own farm', () => {
    expect(roles('updateSettings')).toEqual(['ADMIN', 'FARM_OWNER']);
  });
});
