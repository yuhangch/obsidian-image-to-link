# Obsidian Plugin: Image to Link

### Why this Plugin?

This plugin was inspired by the [obsidian-image-uploader](https://github.com/Creling/obsidian-image-uploader), but it adds a key feature: managing images in your notes using readable links while organizing them according to your vault's actual file structure.

### What Does This Plugin Do?

When you paste an image into your note, the plugin automatically converts it into a Markdown image link. Here’s how it works:

1. You have an image file (e.g., `image.png`) copied to your clipboard.
2. You paste the image into your note.
3. A modal dialog prompts you to fill in the image caption and a unique image slug.
4. The plugin uploads the image to a remote API and replaces it with a Markdown link:  
   `![{caption}](https://remote-api/{slug}.png)`
5. Optionally, the plugin can retrieve the file path relative to the vault root, referred to as the `key`.

### How to Use It

#### Available Settings:

```typescript
const DEFAULT_SETTINGS: ImageToLinkSettings = {
	api_url: 'https://localhost/upload/image',
	headers: `{"Authorization": "Bearer obsidian-image-to-link"}`,
	body : `{"key": "$KEY", "image": "$IMAGE"}`,
	target: 'url'
}
```

- **`api_url`**: The URL of the remote API for image uploads.
- **`headers`**: Authentication headers for the remote API (typically a token).
- **`body`**: The request body for the API, with `$KEY` and `$IMAGE` replaced by the actual key and image content.
- **`target`**: The field in the API response that contains the image URL, used to update the note's image link.

### Example Use Case: Image Server with Cloudflare Workers and R2 Storage

You can easily set up an image server using Cloudflare Workers and R2 Storage. Here’s an example using the `honojs` framework. Make sure to implement authentication for production use.

```typescript
import { Context, Env } from 'hono';

export const uploadImageHandler = async (c: Context<Env, '/v1/image'>) => {
	const { image, key } = await c.req.parseBody<{ image: File, key: string }>();

	// Validate that the image exists
	if (!image) return c.text('Missing image for new post');

	// Upload image to the R2 bucket
	const bucket = c.env!.MyBucket as R2Bucket;
	const imgFile = await bucket.put(key, image);

	// Return the URL for the uploaded image
	const url = `https://localhost/${key}`;
	if (imgFile) {
		c.status(201);
		return c.json({ url });
	} else {
		c.status(500);
		return c.text('Something went wrong');
	}
};
```

Alternatively, you can integrate this plugin with a SaaS service.

### References:
- [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [obsidian-image-uploader](https://github.com/Creling/obsidian-image-uploader)
- [obsidian-cloudinary-uploader](https://github.com/jordanhandy/obsidian-cloudinary-uploader)

---

This revision simplifies the structure while making the plugin's purpose, functionality, and use cases clearer.
