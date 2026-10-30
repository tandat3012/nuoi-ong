# Cloudinary

Đang dùng bởi: `modules/store-admin` (ảnh sản phẩm cửa hàng).

Import `CloudinaryModule` into the feature module that needs file storage, then
inject `CloudinaryService`.

Configure `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in
`api/.env`, or use `CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>`.
Individual non-empty environment variables take precedence over the URL.

```ts
const uploaded = await cloudinaryService.uploadFile(file.buffer, {
  folder: 'products',
});
// uploadFile also accepts a trusted local path, remote URL, or base64 data URI.

const info = await cloudinaryService.getFile(uploaded.public_id, {
  resource_type: uploaded.resource_type,
});
const url = cloudinaryService.getUrl(uploaded.public_id, {
  resource_type: uploaded.resource_type,
  width: 800,
  crop: 'limit',
  quality: 'auto',
  fetch_format: 'auto',
});
await cloudinaryService.deleteFile(uploaded.public_id, 'image');
```

Uploads detect the resource type automatically unless overridden in the options.
Keep `public_id`, `resource_type`, and `secure_url` from the upload response.
Lookups, URLs, and deletions default to images; pass `video` or `raw` for those
assets. Deletion invalidates the CDN cache and returns Cloudinary's result,
including `not found` when the asset was already deleted.

Empty files and public IDs produce HTTP 400 errors. Cloudinary API failures
produce HTTP 502 errors with the original error retained as the exception cause.
File size/type validation and authorization belong in the calling feature.

SDK references: [uploads](https://cloudinary.com/documentation/node_image_and_video_upload)
and [asset management](https://cloudinary.com/documentation/node_asset_administration).
