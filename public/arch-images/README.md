# Arch grid images

Drop your own images here (e.g. downloaded from [your Google Drive folder](https://drive.google.com/drive/folders/1GsE2PhaEIKKbB9eHWefcpS6YJScBAtLp?usp=sharing)), then in `app/lib/arch-images.ts` replace the placeholder URLs with paths like:

```ts
"/arch-images/your-photo.jpg"
```

Images are cropped proportionally to fit the arch shape (`object-fit: cover`).
