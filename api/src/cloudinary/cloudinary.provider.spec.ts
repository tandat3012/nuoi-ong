import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryProvider } from './cloudinary.provider';

describe('Cloudinary configuration', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [{}, 'url-cloud'],
    [{ CLOUDINARY_CLOUD_NAME: 'shared-cloud' }, 'shared-cloud'],
    [{ CLOUDINARY_NAME: 'legacy-cloud' }, 'legacy-cloud'],
    [
      {
        CLOUDINARY_NAME: 'legacy-cloud',
        CLOUDINARY_CLOUD_NAME: 'shared-cloud',
      },
      'legacy-cloud',
    ],
    [{ CLOUDINARY_NAME: '', CLOUDINARY_CLOUD_NAME: '' }, 'url-cloud'],
  ])('resolves the cloud name from %j', (env, cloudName) => {
    jest.replaceProperty(process, 'env', env);
    const config = jest.spyOn(cloudinary, 'config').mockReturnValue({
      cloud_name: 'url-cloud',
      api_key: 'url-key',
      api_secret: 'url-secret',
    });

    expect(CloudinaryProvider.useFactory()).toBe(cloudinary);
    expect(config).toHaveBeenLastCalledWith({
      cloud_name: cloudName,
      api_key: 'url-key',
      api_secret: 'url-secret',
      secure: true,
    });
  });

  it('preserves individual credential overrides', () => {
    jest.replaceProperty(process, 'env', {
      CLOUDINARY_API_KEY: 'individual-key',
      CLOUDINARY_API_SECRET: 'individual-secret',
    });
    const config = jest.spyOn(cloudinary, 'config').mockReturnValue({
      cloud_name: 'url-cloud',
      api_key: 'url-key',
      api_secret: 'url-secret',
    });

    CloudinaryProvider.useFactory();

    expect(config).toHaveBeenLastCalledWith({
      cloud_name: 'url-cloud',
      api_key: 'individual-key',
      api_secret: 'individual-secret',
      secure: true,
    });
  });
});
